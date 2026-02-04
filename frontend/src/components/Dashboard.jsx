/**
 * CHIMERA Dashboard
 * Main trading interface with fixed sidebars
 */

import { useEffect, useState, useCallback } from 'react';
import { useMarketsStore, useBetSlipStore, useToastStore } from '../store';
import MarketList from './MarketList';
import MarketView from './MarketView';
import BetSlip from './BetSlip';
import AccountBalance from './AccountBalance';
import OpenOrders from './OpenOrders';
import RuleBasedBetting from './RuleBasedBetting';
import BettingHistory from './BettingHistory';

const PRICE_REFRESH_INTERVAL = 10000;

function Dashboard({ onLogout }) {
  const { 
    catalogue, selectedMarket, fetchCatalogue, fetchMarketBook, isLoading, lastUpdated
  } = useMarketsStore();
  
  const { selection } = useBetSlipStore();
  const { addToast } = useToastStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rightTab, setRightTab] = useState('account'); // account, auto, history

  useEffect(() => {
    fetchCatalogue().catch(() => {
      addToast('Failed to load markets', 'error');
    });
  }, [fetchCatalogue, addToast]);

  useEffect(() => {
    if (!selectedMarket) return;

    const refreshPrices = async () => {
      setIsRefreshing(true);
      try {
        await fetchMarketBook(selectedMarket.marketId);
      } catch (err) {
        console.error('Price refresh failed:', err);
      } finally {
        setIsRefreshing(false);
      }
    };

    const interval = setInterval(refreshPrices, PRICE_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [selectedMarket, fetchMarketBook]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCatalogue();
      if (selectedMarket) {
        await fetchMarketBook(selectedMarket.marketId);
      }
      addToast('Markets refreshed', 'success', 2000);
    } catch (err) {
      addToast('Refresh failed', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCatalogue, fetchMarketBook, selectedMarket, addToast]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 glass-card border-0 border-b rounded-none px-6 py-4 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">
              <span className="text-accent">CHIMERA</span>
              <span className="text-white ml-2">Lay Exchange</span>
            </h1>
            <div className="status-badge status-connected">
              <span className="w-2 h-2 rounded-full bg-chimera-green animate-pulse" />
              <span>Connected</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-chimera-muted font-mono">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary py-2 px-3 flex items-center gap-2"
            >
              <RefreshIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="btn-secondary py-2 px-3 flex items-center gap-2"
            >
              <LogoutIcon className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR - Markets */}
        <aside className="w-80 flex-shrink-0 border-r border-chimera-border flex flex-col bg-chimera-bg">
          <div className="flex-shrink-0 p-4 border-b border-chimera-border">
            <div className="flex items-center gap-2 text-white">
              <CalendarIcon className="w-4 h-4 text-chimera-accent" />
              <span className="font-semibold text-sm">Today's Racing</span>
            </div>
            <p className="text-xs text-chimera-muted mt-1">
              {catalogue.length} WIN markets available
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MarketList markets={catalogue} isLoading={isLoading} />
          </div>
        </aside>

        {/* CENTER - Market View */}
        <main className="flex-1 overflow-y-auto bg-chimera-bg/50">
          <div className="p-6">
            {selectedMarket ? (
              <MarketView isRefreshing={isRefreshing} />
            ) : (
              <EmptyState />
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="w-[420px] flex-shrink-0 border-l border-chimera-border flex flex-col bg-chimera-bg">
          {/* Tab Navigation */}
          <div className="flex-shrink-0 p-2 border-b border-chimera-border">
            <div className="flex gap-1 bg-chimera-surface rounded-lg p-1">
              {[
                { id: 'account', label: 'Account', icon: WalletIcon },
                { id: 'auto', label: 'Auto Bet', icon: BotIcon },
                { id: 'history', label: 'History', icon: HistoryIcon },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors ${
                    rightTab === tab.id
                      ? 'bg-chimera-accent text-white'
                      : 'text-chimera-muted hover:text-white'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {rightTab === 'account' && (
              <>
                <AccountBalance />
                <OpenOrders />
                {selection && (
                  <div className="animate-slideUp">
                    <BetSlip />
                  </div>
                )}
              </>
            )}
            
            {rightTab === 'auto' && (
              <RuleBasedBetting />
            )}
            
            {rightTab === 'history' && (
              <BettingHistory />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <HorseIcon className="w-16 h-16 text-chimera-muted mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-white mb-2">Select a Race</h3>
        <p className="text-sm text-chimera-muted max-w-sm">
          Choose a race from the sidebar to view runners and place lay bets
        </p>
      </div>
    </div>
  );
}

// Icons
function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function HorseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function WalletIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function BotIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function HistoryIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default Dashboard;
