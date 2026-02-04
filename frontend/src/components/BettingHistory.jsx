/**
 * Betting History Component
 * Shows all placed bets, P/L tracking, daily statements, CSV export
 */

import { useState, useMemo } from 'react';
import { useHistoryStore } from '../store';

function BettingHistory() {
  const { bets, getDailyStats, getTotalStats, getDateRange, exportToCSV, clearHistory } = useHistoryStore();
  
  const [view, setView] = useState('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredBets = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    switch (view) {
      case 'today':
        return bets.filter(b => b.placedAt.split('T')[0] === today);
      case 'week':
        return bets.filter(b => new Date(b.placedAt) >= weekAgo);
      case 'statement':
        return bets.filter(b => b.placedAt.split('T')[0] === selectedDate);
      default:
        return bets;
    }
  }, [bets, view, selectedDate]);

  const stats = useMemo(() => {
    const viewBets = filteredBets;
    const totalStaked = viewBets.reduce((sum, b) => sum + b.stake, 0);
    const profitLoss = viewBets.reduce((sum, b) => sum + b.profitLoss, 0);
    const wins = viewBets.filter(b => b.result === 'won').length;
    const losses = viewBets.filter(b => b.result === 'lost').length;
    const pending = viewBets.filter(b => b.result === 'pending').length;
    
    return { totalStaked, profitLoss, wins, losses, pending, count: viewBets.length };
  }, [filteredBets]);

  const totalStats = getTotalStats();
  const dateRange = getDateRange();

  const handleExport = () => {
    const csv = exportToCSV(view === 'statement' ? selectedDate : null);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chimera-bets-${view === 'statement' ? selectedDate : 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Betting History</h3>
          {bets.length > 0 && (
            <span className="bg-chimera-surface text-chimera-muted text-xs px-2 py-0.5 rounded-full">
              {bets.length}
            </span>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 mb-4 bg-chimera-surface rounded-lg p-1">
        {['today', 'week', 'all', 'statement'].map(tab => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`flex-1 text-xs py-1.5 rounded capitalize transition-colors ${
              view === tab 
                ? 'bg-chimera-accent text-white' 
                : 'text-chimera-muted hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Date Picker for Statement */}
      {view === 'statement' && (
        <div className="mb-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={dateRange.earliest || undefined}
            max={dateRange.latest || undefined}
            className="input-field text-sm py-1.5 w-full"
          />
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-chimera-surface rounded-lg p-2">
          <div className="text-xs text-chimera-muted">Staked</div>
          <div className="text-sm font-mono text-white">£{stats.totalStaked.toFixed(2)}</div>
        </div>
        <div className={`rounded-lg p-2 ${stats.profitLoss >= 0 ? 'bg-chimera-green/10' : 'bg-chimera-pink/10'}`}>
          <div className="text-xs text-chimera-muted">P/L</div>
          <div className={`text-sm font-mono font-bold ${stats.profitLoss >= 0 ? 'text-chimera-green' : 'text-chimera-pink'}`}>
            {stats.profitLoss >= 0 ? '+' : ''}£{stats.profitLoss.toFixed(2)}
          </div>
        </div>
        <div className="bg-chimera-surface rounded-lg p-2">
          <div className="text-xs text-chimera-muted">Record</div>
          <div className="text-sm font-mono">
            <span className="text-chimera-green">{stats.wins}W</span>
            <span className="text-chimera-muted">/</span>
            <span className="text-chimera-pink">{stats.losses}L</span>
            {stats.pending > 0 && (
              <span className="text-yellow-400 ml-1">({stats.pending}P)</span>
            )}
          </div>
        </div>
        <div className="bg-chimera-surface rounded-lg p-2">
          <div className="text-xs text-chimera-muted">ROI</div>
          <div className={`text-sm font-mono ${stats.profitLoss >= 0 ? 'text-chimera-green' : 'text-chimera-pink'}`}>
            {stats.totalStaked > 0 ? ((stats.profitLoss / stats.totalStaked) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      {/* All Time Summary */}
      {view !== 'all' && totalStats.count > 0 && (
        <div className="mb-4 p-2 bg-chimera-bg rounded border border-chimera-border text-xs">
          <div className="flex justify-between">
            <span className="text-chimera-muted">All Time: {totalStats.count} bets</span>
            <span className={totalStats.profitLoss >= 0 ? 'text-chimera-green' : 'text-chimera-pink'}>
              {totalStats.profitLoss >= 0 ? '+' : ''}£{totalStats.profitLoss.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Bets List */}
      <div className="mb-4">
        <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2">
          {view === 'statement' ? `Statement: ${selectedDate}` : `${stats.count} Bets`}
        </div>
        
        {filteredBets.length === 0 ? (
          <div className="text-center py-8 text-chimera-muted text-sm">
            No bets found
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filteredBets.slice().reverse().map(bet => (
              <BetCard key={bet.id} bet={bet} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={filteredBets.length === 0}
          className="flex-1 btn-secondary py-2 text-xs flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <ExportIcon className="w-3 h-3" />
          Export CSV
        </button>
        {bets.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="btn-secondary py-2 px-3 text-xs text-red-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-chimera-surface border border-chimera-border rounded-lg p-4 max-w-sm">
            <h4 className="text-white font-medium mb-2">Clear All History?</h4>
            <p className="text-sm text-chimera-muted mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 btn-secondary py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { clearHistory(); setShowClearConfirm(false); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BetCard({ bet }) {
  const colors = {
    won: 'border-chimera-green/30 bg-chimera-green/5',
    lost: 'border-chimera-pink/30 bg-chimera-pink/5',
    pending: 'border-yellow-500/30 bg-yellow-500/5',
  };

  const time = new Date(bet.placedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = new Date(bet.placedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  return (
    <div className={`p-2 rounded-lg border ${colors[bet.result] || colors.pending}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-1.5 py-0.5 rounded ${
              bet.side === 'LAY' ? 'bg-chimera-pink/30 text-chimera-pink' : 'bg-chimera-blue/30 text-chimera-blue'
            }`}>
              {bet.side}
            </span>
            <span className="text-chimera-muted">{date} {time}</span>
          </div>
          <p className="text-sm text-white truncate mt-1">{bet.runnerName}</p>
          <p className="text-xs text-chimera-muted truncate">{bet.marketName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-chimera-muted">£{bet.stake.toFixed(2)} @ {bet.odds}</div>
          {bet.result !== 'pending' ? (
            <div className={`text-sm font-mono font-bold ${bet.profitLoss >= 0 ? 'text-chimera-green' : 'text-chimera-pink'}`}>
              {bet.profitLoss >= 0 ? '+' : ''}£{bet.profitLoss.toFixed(2)}
            </div>
          ) : (
            <div className="text-xs text-yellow-400">Pending</div>
          )}
        </div>
      </div>
      {bet.ruleId && (
        <div className="mt-1 text-xs text-chimera-accent">Auto: {bet.ruleId}</div>
      )}
    </div>
  );
}

function HistoryIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExportIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export default BettingHistory;
