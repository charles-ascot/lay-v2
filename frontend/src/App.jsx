/**
 * CHIMERA Lay Betting App
 * Main Application Component
 * 
 * IMPORTANT: Background image requires chimera.png in frontend/public/ folder
 */

import { useEffect } from 'react';
import { useAuthStore, useToastStore } from './store';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';

const KEEPALIVE_INTERVAL = 30 * 60 * 1000;

function App() {
  const { isAuthenticated, checkSession, keepAlive, logout } = useAuthStore();
  const { toasts, removeToast, addToast } = useToastStore();

  useEffect(() => {
    checkSession();

    let keepAliveTimer;
    if (isAuthenticated) {
      keepAliveTimer = setInterval(() => {
        keepAlive().catch(() => {
          addToast('Session expired. Please login again.', 'error');
        });
      }, KEEPALIVE_INTERVAL);
    }

    return () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    };
  }, [isAuthenticated, checkSession, keepAlive, addToast]);

  useEffect(() => {
    const handleSessionExpired = () => {
      addToast('Session expired. Please login again.', 'error');
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, [addToast]);

  return (
    <div className="min-h-screen">
      {/* 
        Background with Chimera image 
        IMPORTANT: Place chimera.png in frontend/public/ folder
        The image will appear at 15% opacity as a background
      */}
      <div className="chimera-bg" />

      {/* Main Content */}
      {isAuthenticated ? (
        <Dashboard onLogout={logout} />
      ) : (
        <LoginPage />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
