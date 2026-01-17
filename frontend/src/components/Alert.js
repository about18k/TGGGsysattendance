import React from 'react';
import './Alert.css';

function Alert({ type, title, message, onClose, onConfirm, showCancel }) {
  const icons = {
    success: 'OK',
    error: 'X',
    warning: '!',
    info: 'i'
  };

  return (
    <div className="alert-overlay" onClick={onClose}>
      <div className="alert-box" onClick={(e) => e.stopPropagation()}>
        <div className={`alert-icon alert-icon-${type}`}>
          {icons[type]}
        </div>
        <h2 className="alert-title">{title}</h2>
        <p className="alert-message">{message}</p>
        <div className="alert-buttons">
          {showCancel && (
            <button className="alert-btn alert-btn-cancel" onClick={onClose}>
              Cancel
            </button>
          )}
          <button 
            className="alert-btn alert-btn-confirm" 
            onClick={onConfirm || onClose}
          >
            {showCancel ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Alert;
