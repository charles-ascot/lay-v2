/**
 * CHIMERA Bet Slip
 * Lay bet placement interface
 */

import { useMemo, useCallback } from 'react';
import { useBetSlipStore, useToastStore } from '../store';

function BetSlip() {
  const {
    selection,
    stake,
    odds,
    isPlacing,
    error,
    setStake,
    setOdds,
    clearSlip,
    placeBet,
    getLiability,
    getProfit,
    clearError,
  } = useBetSlipStore();

  const { addToast } = useToastStore();

  // Calculate values
  const liability = useMemo(() => getLiability(), [stake, odds, getLiability]);
  const profit = useMemo(() => getProfit(), [stake, getProfit]);

  // Validate inputs
  const isValid = useMemo(() => {
    const s = parseFloat(stake);
    const o = parseFloat(odds);
    
    if (!s || !o || s <= 0 || o <= 1.01) return false;
    
    // Bet sizing rule
    if (s < 1.0 && s * o < 10.0) return false;
    
    return true;
  }, [stake, odds]);

  // Handle bet placement
  const handlePlaceBet = useCallback(async () => {
    clearError();
    
    try {
      const result = await placeBet();
      
      if (result?.status === 'SUCCESS' || result?.instructionReports?.[0]?.status === 'SUCCESS') {
        addToast('Lay bet placed successfully!', 'success');
      } else if (result?.instructionReports?.[0]?.status === 'FAILURE') {
        const errorCode = result.instructionReports[0].errorCode;
        addToast(`Bet failed: ${errorCode}`, 'error');
      }
    } catch (err) {
      addToast('Failed to place bet', 'error');
    }
  }, [placeBet, clearError, addToast]);

  if (!selection) {
    return null;
  }

  return (
    <div className="bet-slip animate-slideUp">
      {/* Header */}
      <div className="bet-slip-header">
        <div className="flex items-center gap-2">
          <LayIcon className="w-5 h-5 text-red-400" />
          <span className="font-semibold text-white">Lay Bet</span>
        </div>
        <button
          onClick={clearSlip}
          className="text-chimera-muted hover:text-white transition-colors"
          aria-label="Clear bet slip"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Selection Info */}
      <div className="mb-6 p-4 rounded-lg bg-chimera-surface border border-chimera-border">
        <p className="text-xs text-chimera-accent uppercase tracking-wider mb-1">
          Laying against
        </p>
        <p className="font-semibold text-white text-lg">
          {selection.runnerName}
        </p>
        <p className="text-sm text-chimera-muted mt-1">
          {selection.marketName}
        </p>
      </div>

      {/* Input Fields */}
      <div className="space-y-4 mb-6">
        {/* Odds Input */}
        <div>
          <label className="input-label flex justify-between">
            <span>Lay Odds</span>
            <span className="text-chimera-accent font-mono">
              Min 1.01
            </span>
          </label>
          <input
            type="number"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            className="input-field"
            placeholder="0.00"
            step="0.01"
            min="1.01"
            max="1000"
            disabled={isPlacing}
          />
        </div>

        {/* Stake Input */}
        <div>
          <label className="input-label flex justify-between">
            <span>Backer's Stake (£)</span>
            <span className="text-chimera-accent font-mono">
              Your profit if loses
            </span>
          </label>
          <input
            type="number"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="input-field"
            placeholder="0.00"
            step="0.01"
            min="0.01"
            disabled={isPlacing}
          />
        </div>
      </div>

      {/* Liability & Profit Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="liability-display">
          <p className="text-xs text-red-400 mb-1">Liability</p>
          <p className="text-xl font-mono font-bold text-red-400">
            £{liability.toFixed(2)}
          </p>
          <p className="text-xs text-chimera-muted mt-1">
            If horse wins
          </p>
        </div>
        <div className="profit-display">
          <p className="text-xs text-green-400 mb-1">Profit</p>
          <p className="text-xl font-mono font-bold text-green-400">
            £{profit.toFixed(2)}
          </p>
          <p className="text-xs text-chimera-muted mt-1">
            If horse loses
          </p>
        </div>
      </div>

      {/* Bet Sizing Warning */}
      {stake && parseFloat(stake) < 1.0 && parseFloat(stake) * parseFloat(odds) < 10.0 && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-400">
            <WarningIcon className="w-4 h-4 inline mr-1" />
            Stakes below £1 require potential payout of £10 or greater
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Place Bet Button */}
      <button
        onClick={handlePlaceBet}
        disabled={!isValid || isPlacing}
        className="btn-danger w-full flex items-center justify-center gap-2"
      >
        {isPlacing ? (
          <>
            <LoadingSpinner />
            <span>Placing Bet...</span>
          </>
        ) : (
          <>
            <LayIcon className="w-5 h-5" />
            <span>Place Lay Bet</span>
          </>
        )}
      </button>

      {/* Info */}
      <div className="mt-4 p-3 rounded-lg bg-chimera-surface border border-chimera-border">
        <p className="text-xs text-chimera-muted">
          <InfoIcon className="w-4 h-4 inline mr-1 text-chimera-accent" />
          Persistence: <span className="text-white">LAPSE</span> — Unmatched bets 
          will be cancelled at race start
        </p>
      </div>
    </div>
  );
}

// Icons
function LayIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function WarningIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
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

export default BetSlip;
