/**
 * Account Balance Panel
 * Shows available funds, exposure, and account status
 */

import { useEffect } from 'react';
import { useAccountStore } from '../store';

function AccountBalance() {
  const { 
    balance, 
    isLoading, 
    error, 
    fetchBalance 
  } = useAccountStore();

  // Fetch balance on mount and every 30 seconds
  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  if (isLoading && !balance) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Account</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <WalletIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Account</h3>
        </div>
        <div className="text-sm text-red-400 py-2">
          {error}
        </div>
        <button 
          onClick={fetchBalance}
          className="text-xs text-chimera-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const availableToBet = balance?.availableToBetBalance || 0;
  const exposure = balance?.exposure || 0;
  const totalBalance = availableToBet + Math.abs(exposure);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WalletIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Account</h3>
        </div>
        <button 
          onClick={fetchBalance}
          disabled={isLoading}
          className="text-chimera-muted hover:text-white transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Balance */}
      <div className="mb-4">
        <div className="text-xs text-chimera-muted uppercase tracking-wider mb-1">
          Available to Bet
        </div>
        <div className="text-2xl font-bold text-white font-mono">
          £{availableToBet.toFixed(2)}
        </div>
      </div>

      {/* Balance Details */}
      <div className="space-y-2 pt-3 border-t border-chimera-border">
        {/* Exposure */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ExposureIcon className="w-4 h-4 text-chimera-pink" />
            <span className="text-xs text-chimera-muted">Exposure</span>
          </div>
          <span className={`text-sm font-mono ${exposure < 0 ? 'text-chimera-pink' : 'text-chimera-muted'}`}>
            £{Math.abs(exposure).toFixed(2)}
          </span>
        </div>

        {/* Retained Commission */}
        {balance?.retainedCommission > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CommissionIcon className="w-4 h-4 text-chimera-muted" />
              <span className="text-xs text-chimera-muted">Retained Commission</span>
            </div>
            <span className="text-sm font-mono text-chimera-muted">
              £{balance.retainedCommission.toFixed(2)}
            </span>
          </div>
        )}

        {/* Points Balance */}
        {balance?.pointsBalance > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PointsIcon className="w-4 h-4 text-chimera-accent" />
              <span className="text-xs text-chimera-muted">Points</span>
            </div>
            <span className="text-sm font-mono text-chimera-accent">
              {balance.pointsBalance}
            </span>
          </div>
        )}

        {/* Discount Rate */}
        {balance?.discountRate > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DiscountIcon className="w-4 h-4 text-chimera-green" />
              <span className="text-xs text-chimera-muted">Commission Discount</span>
            </div>
            <span className="text-sm font-mono text-chimera-green">
              {balance.discountRate}%
            </span>
          </div>
        )}
      </div>

      {/* Total Balance Indicator */}
      <div className="mt-4 pt-3 border-t border-chimera-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-chimera-muted">Total Balance</span>
          <span className="text-sm font-mono text-white font-medium">
            £{totalBalance.toFixed(2)}
          </span>
        </div>
        
        {/* Visual bar showing available vs exposure */}
        {totalBalance > 0 && (
          <div className="mt-2 h-2 bg-chimera-border rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-chimera-green"
              style={{ width: `${(availableToBet / totalBalance) * 100}%` }}
            />
            <div 
              className="h-full bg-chimera-pink"
              style={{ width: `${(Math.abs(exposure) / totalBalance) * 100}%` }}
            />
          </div>
        )}
        <div className="flex justify-between mt-1">
          <span className="text-xs text-chimera-green">Available</span>
          <span className="text-xs text-chimera-pink">At Risk</span>
        </div>
      </div>
    </div>
  );
}

// Icons
function WalletIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ExposureIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CommissionIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}

function PointsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function DiscountIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default AccountBalance;
