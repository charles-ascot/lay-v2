/**
 * CHIMERA Login Page
 * Betfair Exchange Authentication
 */

import { useState } from 'react';
import { useAuthStore, useToastStore } from '../store';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const { addToast } = useToastStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password.trim()) {
      addToast('Please enter username and password', 'error');
      return;
    }

    try {
      await login(username, password);
      addToast('Successfully connected to Betfair Exchange', 'success');
    } catch (err) {
      // Error is already handled in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-accent">CHIMERA</span>
          </h1>
          <p className="text-chimera-muted text-sm">
            Horse Racing Lay Exchange
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-1">
              Connect to Exchange
            </h2>
            <p className="text-sm text-chimera-muted">
              Enter your Betfair credentials
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="input-label">
                Betfair Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter username"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="input-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <ExchangeIcon />
                  <span>Connect to Exchange</span>
                </>
              )}
            </button>
          </form>

          {/* Info Notice */}
          <div className="mt-6 p-4 rounded-lg bg-chimera-surface border border-chimera-border">
            <div className="flex items-start gap-3">
              <InfoIcon className="w-5 h-5 text-chimera-accent flex-shrink-0 mt-0.5" />
              <div className="text-xs text-chimera-muted">
                <p className="mb-1">
                  <span className="text-white font-medium">Delayed Data Mode</span>
                </p>
                <p>
                  Using delayed API key. Prices refresh every 1-60 seconds with 
                  top 3 price levels available.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-chimera-muted mt-6">
          Powered by Betfair Exchange API
        </p>
      </div>
    </div>
  );
}

// Icons
function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ExchangeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

function InfoIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default LoginPage;
