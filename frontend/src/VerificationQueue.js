import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function VerificationQueue({ token }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [department, setDepartment] = useState('');

  const departments = [
    'IT Department',
    'Design Department',
    'Engineering Department',
    'Accounting Department',

  ];

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API}/verifications/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pending verifications.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openDepartmentModal = (req) => {
    setSelectedRequest(req);
    setDepartment('');
    setShowDepartmentModal(true);
  };

  const handleDecision = async (id, action) => {
    if (action === 'approved') {
      openDepartmentModal(requests.find(r => r.id === id));
      return;
    }

    // Decline
    setActionLoading(`${id}-declined`);
    setError('');
    try {
      await axios.post(`${API}/verifications/${id}/decision`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update verification status.');
    } finally {
      setActionLoading('');
    }
  };

  const confirmApproval = async () => {
    if (!department.trim()) {
      setError('Please select a department.');
      return;
    }

    setActionLoading(`${selectedRequest.id}-approved`);
    setError('');
    try {
      await axios.post(`${API}/verifications/${selectedRequest.id}/decision`, 
        { action: 'approved', department }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setShowDepartmentModal(false);
      setSelectedRequest(null);
      setDepartment('');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update verification status.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#FF7120', fontSize: '1.25rem' }}>Pending Verifications</h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280' }}>Approve or decline employee/trainee signups.</p>
        </div>
        <button
          onClick={loadRequests}
          style={{
            background: '#FF7120',
            color: '#fff',
            border: 'none',
            padding: '0.55rem 0.9rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            boxShadow: '0 8px 20px rgba(255, 113, 32, 0.25)'
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', background: '#0b1220', borderRadius: '14px', border: '1px solid rgba(255, 113, 32, 0.15)' }}>
          No pending verification requests.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                background: '#0b1220',
                border: '1px solid rgba(255, 113, 32, 0.15)',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.75rem',
                alignItems: 'center'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#e5e7eb', fontSize: '1rem' }}>{req.full_name}</span>
                  <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>•</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.95rem' }}>{req.email}</span>
                </div>
                <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                  Requested: {new Date(req.created_at).toLocaleString()}
                </div>
                {req.reason_for_request && (
                  <div style={{ marginTop: '0.35rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
                    {req.reason_for_request}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleDecision(req.id, 'declined')}
                  disabled={!!actionLoading}
                  style={{
                    background: 'transparent',
                    color: '#f87171',
                    border: '1px solid rgba(248, 113, 113, 0.35)',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    minWidth: '88px'
                  }}
                >
                  {actionLoading === `${req.id}-declined` ? 'Declining...' : 'Decline'}
                </button>
                <button
                  onClick={() => handleDecision(req.id, 'approved')}
                  disabled={!!actionLoading}
                  style={{
                    background: '#FF7120',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    minWidth: '88px',
                    boxShadow: '0 8px 20px rgba(255, 113, 32, 0.25)'
                  }}
                >
                  {actionLoading === `${req.id}-approved` ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDepartmentModal && selectedRequest && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem'
            }}
            onClick={() => !actionLoading && setShowDepartmentModal(false)}
          >
            <div
              style={{
                background: '#0b1220',
                border: '1px solid rgba(255, 113, 32, 0.25)',
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.5rem', color: '#e5e7eb', fontSize: '1.25rem' }}>
                Assign Department
              </h3>
              <p style={{ margin: '0 0 1.5rem', color: '#9ca3af' }}>
                Select a department for {selectedRequest.full_name}
              </p>

              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1.5rem',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid rgba(255, 113, 32, 0.25)',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Select a department --</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => !actionLoading && setShowDepartmentModal(false)}
                  disabled={!!actionLoading}
                  style={{
                    background: 'transparent',
                    color: '#9ca3af',
                    border: '1px solid rgba(255, 113, 32, 0.25)',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApproval}
                  disabled={!department.trim() || !!actionLoading}
                  style={{
                    background: '#FF7120',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    cursor: !department.trim() || actionLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: !department.trim() || actionLoading ? 0.6 : 1,
                    boxShadow: '0 8px 20px rgba(255, 113, 32, 0.25)'
                  }}
                >
                  {actionLoading ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VerificationQueue;
