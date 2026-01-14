import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Alert from './components/Alert';

const API = 'http://localhost:5000/api';

function Dashboard({ token, user, onLogout }) {
  const [attendance, setAttendance] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [alert, setAlert] = useState(null);
  const [workDoc, setWorkDoc] = useState('');
  const [modalDoc, setModalDoc] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState('all');
  const [loading, setLoading] = useState(true);
  const [buttonLoading, setButtonLoading] = useState(false);

  const showAlert = (type, title, message) => {
    setAlert({ type, title, message });
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const maxWidth = 600;
        const maxHeight = 400;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', 0.6);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const truncateText = (text, maxLength = 8) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '-') return '-';
    
    // If already in AM/PM format, return as is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      return timeStr;
    }
    
    // Convert 24-hour to 12-hour format
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const promises = [fetchAttendance(), fetchUserProfile()];
      if (user.role === 'coordinator') {
        promises.push(fetchInterns());
      }
      await Promise.all(promises);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const fetchAttendance = async () => {
    const endpoint = user.role === 'coordinator' ? '/attendance/all' : '/attendance/my';
    const { data } = await axios.get(`${API}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setAttendance(data);
  };

  const fetchInterns = async () => {
    try {
      const { data } = await axios.get(`${API}/interns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched interns:', data);
      setInterns(data);
    } catch (err) {
      console.error('Failed to fetch interns:', err);
    }
  };

  const checkIn = async () => {
    const today = new Date().toISOString().split('T')[0];
    const hasCheckedInToday = attendance.some(a => a.date === today && a.time_in);
    
    if (hasCheckedInToday) {
      showAlert('warning', 'Already Checked In', 'You have already checked in today!');
      return;
    }

    if (!photo) {
      showAlert('error', 'Photo Required', 'Please upload a photo before checking in!');
      return;
    }

    setButtonLoading(true);
    try {
      const now = new Date();
      const timeIn = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
      const formData = new FormData();
      formData.append('time_in', timeIn);
      
      const compressedPhoto = await compressImage(photo);
      formData.append('photo', compressedPhoto, 'photo.jpg');

      const { data } = await axios.post(`${API}/attendance/checkin`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      if (data.lateDeduction > 0) {
        showAlert('warning', 'Late Check-In', 
          `You are late by ${data.lateMinutes} minutes. You have been deducted ${data.lateDeduction} hour today.`);
      } else {
        showAlert('success', 'Checked In!', 'Your attendance has been recorded successfully.');
      }
      
      fetchAttendance();
      setPhoto(null);
    } finally {
      setButtonLoading(false);
    }
  };

  const checkOut = async (id) => {
    if (!workDoc.trim()) {
      showAlert('error', 'Work Documentation Required', 'Please describe your work before checking out!');
      return;
    }

    setButtonLoading(true);
    try {
      const timeOut = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
      await axios.put(`${API}/attendance/checkout/${id}`, { 
        time_out: timeOut,
        work_documentation: workDoc 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('success', 'Checked Out!', 'You have successfully checked out.');
      fetchAttendance();
      setWorkDoc('');
    } finally {
      setButtonLoading(false);
    }
  };

  const overtimeCheckIn = async (id) => {
    setButtonLoading(true);
    try {
      await axios.put(`${API}/attendance/overtime-in/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('success', 'OT Check-In!', 'Your overtime check-in has been recorded.');
      fetchAttendance();
    } finally {
      setButtonLoading(false);
    }
  };

  const overtimeCheckOut = async (id) => {
    setButtonLoading(true);
    try {
      await axios.put(`${API}/attendance/overtime-out/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('success', 'OT Check-Out!', 'Your overtime check-out has been recorded.');
      fetchAttendance();
    } finally {
      setButtonLoading(false);
    }
  };

  return (
    <div>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="dashboard">
        <div className="welcome">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>Welcome, {user.name}</h2>
              <p>Role: {user.role === 'coordinator' ? 'Head Coordinator' : 'Intern'}</p>
            </div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: '3px solid #FF7120',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: '#00273C'
            }}>
              {userProfile?.profile_picture ? (
                <img 
                  src={userProfile.profile_picture} 
                  alt="Profile" 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#FF7120" 
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
          </div>
        </div>

        {user.role === 'intern' && (
          <div className="intern-grid">
            <div className="checkin-form">
              <h3>Check In / Out</h3>
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem'}}>
                  Upload Photo (Required)
                </label>
                <div style={{position: 'relative'}}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setPhoto(e.target.files[0])}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer'
                    }}
                    id="photo-upload"
                  />
                  <label 
                    htmlFor="photo-upload"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '0.75rem 1rem',
                      background: photo ? 'rgba(255, 113, 32, 0.1)' : '#00273C',
                      border: `2px dashed ${photo ? '#FF7120' : 'rgba(255, 113, 32, 0.3)'}`,
                      borderRadius: '8px',
                      color: photo ? '#FF7120' : '#a0a4a8',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => {
                      if (!photo) {
                        e.target.style.borderColor = '#FF7120';
                        e.target.style.background = 'rgba(255, 113, 32, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!photo) {
                        e.target.style.borderColor = 'rgba(255, 113, 32, 0.3)';
                        e.target.style.background = '#00273C';
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                    {photo ? `Selected: ${photo.name}` : 'Choose Photo File'}
                  </label>
                </div>
              </div>
              <button 
                onClick={checkIn}
                disabled={buttonLoading || (attendance[0] && attendance[0].date === new Date().toISOString().split('T')[0] && attendance[0].time_in)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {buttonLoading ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Processing...
                  </>
                ) : 'Check In'}
              </button>
              {attendance[0] && !attendance[0].time_out && attendance[0].date === new Date().toISOString().split('T')[0] && (
                <button 
                  onClick={() => checkOut(attendance[0].id)}
                  disabled={buttonLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {buttonLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : 'Check Out'}
                </button>
              )}
              {attendance[0] && attendance[0].time_out && !attendance[0].ot_time_in && attendance[0].date === new Date().toISOString().split('T')[0] && (
                <button 
                  onClick={() => overtimeCheckIn(attendance[0].id)}
                  disabled={buttonLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {buttonLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : 'OT Check In'}
                </button>
              )}
              {attendance[0] && attendance[0].ot_time_in && !attendance[0].ot_time_out && attendance[0].date === new Date().toISOString().split('T')[0] && (
                <button 
                  onClick={() => overtimeCheckOut(attendance[0].id)}
                  disabled={buttonLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {buttonLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Processing...
                    </>
                  ) : 'OT Check Out'}
                </button>
              )}
            </div>

            <div className="checkin-form">
              <h3>Work Documentation</h3>
              <label style={{display: 'block', marginBottom: '0.5rem', color: '#a0a4a8', fontSize: '0.9rem'}}>
                What did you accomplish today?
              </label>
              <textarea
                value={workDoc}
                onChange={(e) => setWorkDoc(e.target.value)}
                placeholder="Example: Completed database design, attended team meeting, fixed bug #123..."
                disabled={!attendance[0] || attendance[0].date !== new Date().toISOString().split('T')[0] || attendance[0].time_out}
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  opacity: (!attendance[0] || attendance[0].date !== new Date().toISOString().split('T')[0] || attendance[0].time_out) ? 0.5 : 1
                }}
              />
              <p style={{color: '#6b7280', fontSize: '0.8rem', marginTop: '0.5rem'}}>
                {attendance[0] && !attendance[0].time_out && attendance[0].date === new Date().toISOString().split('T')[0] 
                  ? 'Required before checking out' 
                  : 'Check in first to document your work'}
              </p>
            </div>
          </div>
        )}

        <div className="attendance-table">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.75rem 2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)'}}>
            <h3 style={{margin: 0}}>{user.role === 'coordinator' ? 'All Interns Attendance' : 'My Attendance History'}</h3>
            {user.role === 'coordinator' && (
              <select
                value={selectedIntern}
                onChange={(e) => setSelectedIntern(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 113, 32, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Interns</option>
                {interns.map(intern => (
                  <option key={intern.id} value={intern.id}>
                    {intern.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="table-wrapper">
            <table>
            <thead>
              <tr>
                {user.role === 'coordinator' && <th>Intern Name</th>}
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
                <th>Deduction</th>
                <th>OT In</th>
                <th>OT Out</th>
                <th>Work Done</th>
                <th>Photo</th>
              </tr>
            </thead>
            <tbody>
              {attendance
                .filter(a => selectedIntern === 'all' || a.user_id === selectedIntern)
                .map((a) => (
                <tr key={a.id}>
                  {user.role === 'coordinator' && <td>{a.full_name}</td>}
                  <td>{a.date}</td>
                  <td>{formatTime(a.time_in)}</td>
                  <td>{formatTime(a.time_out)}</td>
                  <td>
                    <span className={`status-badge ${a.status === 'On-Time' ? 'status-ontime' : 'status-late'}`}>
                      {a.status || '-'}
                    </span>
                  </td>
                  <td>
                    {a.late_deduction_hours > 0 ? (
                      <span style={{color: '#ff9d5c', fontWeight: '600'}}>-{a.late_deduction_hours}hr</span>
                    ) : '-'}
                  </td>
                  <td>{formatTime(a.ot_time_in)}</td>
                  <td>{formatTime(a.ot_time_out)}</td>
                  <td>
                    {a.work_documentation ? (
                      <div>
                        {truncateText(a.work_documentation)}
                        {a.work_documentation.length > 20 && (
                          <button 
                            onClick={() => setModalDoc(a.work_documentation)}
                            style={{
                              marginLeft: '8px',
                              background: '#FF7120',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.7rem',
                              cursor: 'pointer'
                            }}
                          >
                            ...
                          </button>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {a.photo_path && (
                      <img src={a.photo_path} alt="Attendance" className="photo-thumb" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      
      {modalDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#001f35',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 113, 32, 0.2)'
          }}>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Work Documentation</h3>
            <p style={{ color: '#e8eaed', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              {modalDoc}
            </p>
            <button 
              onClick={() => setModalDoc(null)}
              style={{
                background: '#FF7120',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
