/**
 * CHIMERA Toast Notification
 * Displays feedback messages
 */

import { useEffect } from 'react';

function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    // Auto-dismiss is handled by the store, but we can add
    // animation cleanup here if needed
  }, []);

  const typeStyles = {
    success: 'toast-success',
    error: 'toast-error',
    info: 'toast-info',
  };

  const icons = {
    success: <SuccessIcon />,
    error: <ErrorIcon />,
    info: <InfoIcon />,
  };

  return (
    <div className={`toast ${typeStyles[type]} flex items-start gap-3 min-w-[300px] max-w-md`}>
      <div className={`
        flex-shrink-0 mt-0.5
        ${type === 'success' ? 'text-green-400' : ''}
        ${type === 'error' ? 'text-red-400' : ''}
        ${type === 'info' ? 'text-chimera-accent' : ''}
      `}>
        {icons[type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{message}</p>
      </div>
      
      <button
        onClick={onClose}
        className="flex-shrink-0 text-chimera-muted hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function SuccessIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default Toast;
