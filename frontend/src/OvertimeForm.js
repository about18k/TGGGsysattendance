import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OvertimeForm({ token }) {
  const sigCanvasRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([
    {
      start_date: '',
      end_date: '',
      start_time: '',
      end_time: ''
    }
  ]);
  const [form, setForm] = useState({
    employee_name: '',
    job_position: '',
    date_completed: '',
    department: '',
    anticipated_hours: '',
    explanation: '',
    employee_signature: '',
    supervisor_signature: '',
    management_signature: '',
    approval_date: ''
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setForm(prev => ({
          ...prev,
          employee_name: data.full_name || prev.employee_name,
          job_position: data.role === 'coordinator' ? 'Head Coordinator' : 'Intern',
          employee_signature: data.full_name || prev.employee_signature
        }));
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [token]);

  const updateFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updatePeriod = (index, field, value) => {
    setPeriods(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setPeriods(prev => [...prev, { start_date: '', end_date: '', start_time: '', end_time: '' }]);
  };

  const removeRow = (index) => {
    setPeriods(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    try {
      const payload = {
        ...form,
        periods: periods.filter(p => p.start_date || p.end_date || p.start_time || p.end_time)
      };
      await axios.post(`${API}/overtime`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlert({ type: 'success', title: 'Submitted', message: 'Overtime request submitted successfully.' });
      // fully reset form and periods
      setPeriods([{
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: ''
      }]);
      setForm({
        employee_name: '',
        job_position: '',
        date_completed: '',
        department: '',
        anticipated_hours: '',
        explanation: '',
        employee_signature: '',
        supervisor_signature: '',
        management_signature: '',
        approval_date: ''
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit overtime request.';
      setAlert({ type: 'error', title: 'Error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const getPos = (event) => {
    const canvas = sigCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    setIsDrawing(true);
    const ctx = sigCanvasRef.current.getContext('2d');
    const { x, y } = getPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const ctx = sigCanvasRef.current.getContext('2d');
    const { x, y } = getPos(event);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    updateFormField('employee_signature', dataUrl);
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateFormField('employee_signature', '');
  };

  return (
    <div className="dashboard" style={{overflowX: 'hidden'}}>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="overtime-card" style={{boxSizing: 'border-box', maxWidth: '100%'}}>
        {loading ? (
          <CardSkeleton />
        ) : (
          <>
        <div className="overtime-heading">
          <h2>Overtime Request Form</h2>
          <p>Submit overtime details for approval.</p>
        </div>

        <form onSubmit={handleSubmit} className="overtime-form">
          <div className="overtime-grid">
            <div className="overtime-field">
              <label>Employee Name</label>
              <input
                type="text"
                value={form.employee_name}
                onChange={(e) => updateFormField('employee_name', e.target.value)}
                required
              />
            </div>
            <div className="overtime-field">
              <label>Job Position</label>
              <input
                type="text"
                value={form.job_position}
                onChange={(e) => updateFormField('job_position', e.target.value)}
                required
              />
            </div>
            <div className="overtime-field">
              <label>Date Form Completed</label>
              <input
                type="date"
                value={form.date_completed}
                onChange={(e) => updateFormField('date_completed', e.target.value)}
              />
            </div>
            <div className="overtime-field span-3">
              <label>Department</label>
              <select
                value={form.department}
                onChange={(e) => updateFormField('department', e.target.value)}
              >
                <option value="">Select department</option>
                <option value="IT Department">IT Department</option>
                <option value="HR Department">HR Department</option>
                <option value="Architecture Department">Architects Department</option>
                <option value="Engineering Department">Engineering Department</option>
              </select>
            </div>
          </div>

          <div className="overtime-section">
            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              {periods.map((p, idx) => (
                <div key={`period-${idx}`} style={{
                  background: '#00273C',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
                    <h4 style={{color: '#e8eaed', margin: 0, fontSize: '0.9rem'}}>Period {idx + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={periods.length <= 1}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 113, 32, 0.3)',
                        color: periods.length <= 1 ? '#6b7280' : '#FF7120',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        cursor: periods.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr', gap: '0.75rem'}}>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>Start Date</label>
                      <input
                        type="date"
                        value={p.start_date}
                        onChange={(e) => updatePeriod(idx, 'start_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>End Date</label>
                      <input
                        type="date"
                        value={p.end_date}
                        onChange={(e) => updatePeriod(idx, 'end_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>Start Time</label>
                      <input
                        type="time"
                        value={p.start_time}
                        onChange={(e) => updatePeriod(idx, 'start_time', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{display: 'block', color: '#a0a4a8', marginBottom: '0.4rem', fontSize: '0.85rem'}}>End Time</label>
                      <input
                        type="time"
                        value={p.end_time}
                        onChange={(e) => updatePeriod(idx, 'end_time', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#001a2b',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addRow} style={{
                width: '100%',
                background: '#FF7120',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}>
                Add Period
              </button>
            </div>
          </div>

          <div className="overtime-grid hours-explanation">
            <div className="overtime-field">
              <label>Anticipated Number of Overtime Hours</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.anticipated_hours}
                onChange={(e) => updateFormField('anticipated_hours', e.target.value)}
              />
            </div>
            <div className="overtime-field stretch">
              <label>Please provide an explanation of the work that requires overtime</label>
              <textarea
                rows="4"
                value={form.explanation}
                onChange={(e) => updateFormField('explanation', e.target.value)}
              />
            </div>
          </div>

              
          <div className="overtime-section">
            <h4>Approval</h4>
            <div className="overtime-grid">
              <div className="overtime-field">
                <label>Employee Signature</label>
                <div className="signature-pad">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={140}
                    style={{maxWidth: '100%', height: 'auto'}}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                  />
                  <div className="signature-actions">
                    <button type="button" className="ghost" onClick={clearSignature}>
                      Clear
                    </button>
                    <span className="signature-hint">Sign with mouse or finger</span>
                  </div>
                </div>
              </div>
              <div className="overtime-field">
                <label>Supervisor Signature</label>
                <input
                  type="text"
                  placeholder="To be signed"
                  disabled
                />
              </div>
              <div className="overtime-field">
                <label>Top Management Signature</label>
                <input
                  type="text"
                  placeholder="To be signed"
                  disabled
                />
              </div>
              <div className="overtime-field">
                <label>Date of Approval</label>
                <input
                  type="text"
                  placeholder="Wait for approval"
                  disabled
                />
              </div>
            </div>
          </div>

          <div className="overtime-instructions">
            <h4>Instructions</h4>
            <ul>
              <li>No overtime will be paid unless this form has been completed prior to overtime. In emergencies, complete within the same week.</li>
              <li>The employee must submit a signed timesheet for specific overtime work before payroll completion.</li>
              <li>The form will be returned to the immediate supervisor.</li>
            </ul>
          </div>

          <div className="overtime-submit">
            <button type="submit" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Overtime Request'}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );
}

export default OvertimeForm;
