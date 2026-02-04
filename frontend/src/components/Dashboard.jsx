/**
 * CHIMERA Dashboard
 * Main trading interface
 * UPDATED: Added Account Balance and Open Orders panels
 */

import { useEffect, useState, useCallback } from 'react';
import { useMarketsStore, useBetSlipStore, useToastStore } from '../store';
import MarketList from './MarketList';
import MarketView from './MarketView';
import BetSlip from './BetSlip';
import AccountBalance from './AccountBalance';
import OpenOrders from './OpenOrders';

// Refresh interval for prices (10 seconds for delayed data)
const PRICE_REFRESH_INTERVAL = 10000;

function Dashboard({ onLogout }) {
  const { 
    catalogue, 
    selectedMarket, 
    fetchCatalogue, 
    fetchMarketBook,
    isLoading,
    lastUpdated
  } = useMarketsStore();
  
  const { selection } = useBetSlipStore();
  const { addToast } = useToastStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Fetch market catalogue on mount
  useEffect(() => {
    fetchCatalogue().catch((err) => {
      addToast('Failed to load markets', 'error');
    });
  }, [fetchCatalogue, addToast]);

  // Auto-refresh prices for selected market
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

  // Manual refresh handler
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-card border-0 border-b rounded-none px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">
              <span className="text-accent">CHIMERA</span>
              <span className="text-white ml-2">Lay Exchange</span>
            </h1>
            
            {/* Connection Status */}
            <div className="status-badge status-connected">
              <span className="w-2 h-2 rounded-full bg-chimera-green animate-pulse" />
              <span>Connected</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Last Updated */}
            {lastUpdated && (
              <span className="text-xs text-chimera-muted font-mono">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary py-2 px-3 flex items-center gap-2"
            >
              <RefreshIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>

            {/* Logout */}
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
        {/* Market List Sidebar */}
        <aside className="w-80 border-r border-chimera-border overflow-y-auto">
          <MarketList 
            markets={catalogue} 
            isLoading={isLoading}
          />
        </aside>

        {/* Market View */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedMarket ? (
            <MarketView isRefreshing={isRefreshing} />
          ) : (
            <EmptyState />
          )}
        </main>

        {/* Right Panel - Account, Orders, BetSlip */}
        <aside className="w-96 border-l border-chimera-border overflow-y-auto flex flex-col">
          {/* Toggle Button */}
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="md:hidden absolute right-0 top-1/2 transform -translate-y-1/2 bg-chimera-surface p-2 rounded-l-lg"
          >
            {showRightPanel ? '→' : '←'}
          </button>

          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${showRightPanel ? '' : 'hidden md:block'}`}>
            {/* Account Balance */}
            <AccountBalance />

            {/* Open Orders */}
            <OpenOrders />

            {/* Bet Slip - shows when selection is made */}
            {selection && (
              <div className="animate-slideUp">
                <BetSlip />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <HorseIcon className="w-16 h-16 text-chimera-muted mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-white mb-2">
          Select a Race
        </h3>
        <p className="text-sm text-chimera-muted max-w-sm">
          Choose a race from the sidebar to view runners and lay prices
        </p>
      </div>
    </div>
  );
}

// Icons
function RefreshIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function HorseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

export default Dashboard;
