/**
 * CHIMERA State Management
 * Zustand stores for application state
 * UPDATED: Added History store with P/L tracking and CSV export
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, marketsAPI, ordersAPI, accountAPI, isSessionValid, clearSession } from '../services/api';

/**
 * Authentication Store
 */
export const useAuthStore = create((set, get) => ({
  isAuthenticated: isSessionValid(),
  isLoading: false,
  error: null,
  user: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authAPI.login(username, password);
      set({ isAuthenticated: true, isLoading: false, user: { username } });
      return result;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Login failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } finally {
      clearSession();
      set({ isAuthenticated: false, user: null, error: null });
    }
  },

  keepAlive: async () => {
    try {
      await authAPI.keepAlive();
    } catch (error) {
      if (error.response?.status === 401) {
        set({ isAuthenticated: false, user: null });
      }
    }
  },

  checkSession: () => {
    const valid = isSessionValid();
    if (!valid && get().isAuthenticated) {
      clearSession();
      set({ isAuthenticated: false, user: null });
    }
    return valid;
  },

  clearError: () => set({ error: null }),
}));

/**
 * Markets Store
 */
export const useMarketsStore = create((set, get) => ({
  catalogue: [],
  selectedMarket: null,
  marketBook: null,
  runners: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchCatalogue: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const catalogue = await marketsAPI.getCatalogue(params);
      set({ catalogue, isLoading: false, lastUpdated: new Date().toISOString() });
      return catalogue;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch markets';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  selectMarket: async (market) => {
    set({ selectedMarket: market, runners: market?.runners || [], marketBook: null });
    if (market) {
      await get().fetchMarketBook(market.marketId);
    }
  },

  fetchMarketBook: async (marketId) => {
    if (!marketId) return;
    try {
      const books = await marketsAPI.getBook([marketId]);
      const book = books?.[0] || null;
      
      const { selectedMarket } = get();
      if (book && selectedMarket) {
        const runnersWithPrices = selectedMarket.runners.map(runner => {
          const runnerBook = book.runners?.find(r => r.selectionId === runner.selectionId);
          return {
            ...runner,
            prices: runnerBook?.ex || null,
            status: runnerBook?.status || 'ACTIVE',
            lastPriceTraded: runnerBook?.lastPriceTraded,
            totalMatched: runnerBook?.totalMatched,
          };
        });
        set({ runners: runnersWithPrices });
      }
      
      set({ marketBook: book, lastUpdated: new Date().toISOString() });
      return book;
    } catch (error) {
      console.error('Failed to fetch market book:', error);
      throw error;
    }
  },

  clearSelection: () => set({ selectedMarket: null, marketBook: null, runners: [] }),
  clearError: () => set({ error: null }),
}));

/**
 * Bet Slip Store
 */
export const useBetSlipStore = create((set, get) => ({
  selection: null,
  stake: '',
  odds: '',
  isPlacing: false,
  error: null,
  lastBetResult: null,

  setSelection: (runner, market) => {
    const bestLay = runner.prices?.availableToLay?.[0];
    set({ 
      selection: { 
        ...runner, 
        marketId: market.marketId,
        marketName: market.event?.name || market.marketName 
      },
      odds: bestLay?.price?.toString() || '',
      stake: '',
      error: null
    });
  },

  setStake: (stake) => set({ stake }),
  setOdds: (odds) => set({ odds }),

  clearSlip: () => set({ selection: null, stake: '', odds: '', error: null, lastBetResult: null }),

  placeBet: async () => {
    const { selection, stake, odds } = get();
    
    if (!selection || !stake || !odds) {
      set({ error: 'Please complete all bet details' });
      return;
    }

    const stakeNum = parseFloat(stake);
    const oddsNum = parseFloat(odds);

    if (stakeNum < 1.0 && stakeNum * oddsNum < 10.0) {
      set({ error: 'Stakes below £1 require potential payout of £10 or greater' });
      return;
    }

    set({ isPlacing: true, error: null });
    
    try {
      const result = await ordersAPI.placeLay(selection.marketId, selection.selectionId, oddsNum, stakeNum);
      set({ isPlacing: false, lastBetResult: result, selection: null, stake: '', odds: '' });
      return result;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to place bet';
      set({ error: message, isPlacing: false });
      throw error;
    }
  },

  getLiability: () => {
    const { stake, odds } = get();
    return (parseFloat(stake) || 0) * ((parseFloat(odds) || 0) - 1);
  },

  getProfit: () => parseFloat(get().stake) || 0,

  clearError: () => set({ error: null }),
}));

/**
 * Orders Store
 */
export const useOrdersStore = create((set, get) => ({
  orders: [],
  isLoading: false,
  isCancelling: false,
  error: null,
  lastUpdated: null,

  fetchOrders: async (marketIds = null) => {
    set({ isLoading: true, error: null });
    try {
      const result = await ordersAPI.getCurrentOrders(marketIds);
      const orders = result?.currentOrders || [];
      set({ orders, isLoading: false, lastUpdated: new Date().toISOString() });
      return orders;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch orders';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  cancelOrder: async (marketId, betId = null) => {
    set({ isCancelling: true, error: null });
    try {
      const result = await ordersAPI.cancelOrder(marketId, betId);
      await get().fetchOrders();
      set({ isCancelling: false });
      return result;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to cancel order';
      set({ error: message, isCancelling: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

/**
 * Account Store
 */
export const useAccountStore = create((set) => ({
  balance: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchBalance: async () => {
    set({ isLoading: true, error: null });
    try {
      const balance = await accountAPI.getBalance();
      set({ balance, isLoading: false, lastUpdated: new Date().toISOString() });
      return balance;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch balance';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

/**
 * History Store - Betting history with P/L tracking and CSV export
 * Persisted to localStorage
 */
export const useHistoryStore = create(
  persist(
    (set, get) => ({
      bets: [], // Array of bet records
      
      // Add a bet record
      addBet: (bet) => {
        const newBet = {
          id: bet.betId || `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          betId: bet.betId,
          marketId: bet.marketId,
          marketName: bet.marketName || 'Unknown Market',
          selectionId: bet.selectionId,
          runnerName: bet.runnerName || 'Unknown',
          side: bet.side || 'LAY',
          stake: bet.stake || 0,
          odds: bet.odds || 0,
          liability: bet.side === 'LAY' ? bet.stake * (bet.odds - 1) : 0,
          placedAt: bet.placedAt || new Date().toISOString(),
          // Venue and race time for display
          venue: bet.venue || null,
          countryCode: bet.countryCode || null,
          raceTime: bet.raceTime || null,
          result: 'pending', // pending, won, lost, void
          returns: 0,
          profitLoss: 0,
          ruleId: bet.ruleId || null,
          settledAt: null,
        };
        set((state) => ({ bets: [...state.bets, newBet] }));
        return newBet;
      },

      // Update bet result (after race settles)
      settleBet: (betId, result, winnerSelectionId = null) => {
        set((state) => ({
          bets: state.bets.map(bet => {
            if (bet.id !== betId && bet.betId !== betId) return bet;
            
            let returns = 0;
            let profitLoss = 0;
            
            if (bet.side === 'LAY') {
              // LAY bet: we win if selection LOSES
              if (result === 'won') {
                // Selection lost, we win the stake
                returns = bet.stake;
                profitLoss = bet.stake;
              } else if (result === 'lost') {
                // Selection won, we lose the liability
                returns = 0;
                profitLoss = -bet.liability;
              }
            } else {
              // BACK bet: we win if selection WINS
              if (result === 'won') {
                returns = bet.stake * bet.odds;
                profitLoss = bet.stake * (bet.odds - 1);
              } else if (result === 'lost') {
                returns = 0;
                profitLoss = -bet.stake;
              }
            }
            
            return {
              ...bet,
              result,
              returns,
              profitLoss,
              settledAt: new Date().toISOString(),
            };
          })
        }));
      },

      // Get stats for a specific date
      getDailyStats: (date) => {
        const { bets } = get();
        const dayBets = bets.filter(b => b.placedAt.split('T')[0] === date);
        
        const totalStaked = dayBets.reduce((sum, b) => sum + b.stake, 0);
        const totalReturns = dayBets.reduce((sum, b) => sum + b.returns, 0);
        const profitLoss = dayBets.reduce((sum, b) => sum + b.profitLoss, 0);
        const wins = dayBets.filter(b => b.result === 'won').length;
        const losses = dayBets.filter(b => b.result === 'lost').length;
        const pending = dayBets.filter(b => b.result === 'pending').length;
        
        return { 
          date, 
          count: dayBets.length, 
          totalStaked, 
          totalReturns, 
          profitLoss, 
          wins, 
          losses, 
          pending 
        };
      },

      // Get all-time stats
      getTotalStats: () => {
        const { bets } = get();
        const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
        const totalReturns = bets.reduce((sum, b) => sum + b.returns, 0);
        const profitLoss = bets.reduce((sum, b) => sum + b.profitLoss, 0);
        const wins = bets.filter(b => b.result === 'won').length;
        const losses = bets.filter(b => b.result === 'lost').length;
        const pending = bets.filter(b => b.result === 'pending').length;
        
        return { count: bets.length, totalStaked, totalReturns, profitLoss, wins, losses, pending };
      },

      // Get date range of bets
      getDateRange: () => {
        const { bets } = get();
        if (bets.length === 0) return { earliest: null, latest: null };
        const dates = bets.map(b => b.placedAt.split('T')[0]).sort();
        return { earliest: dates[0], latest: dates[dates.length - 1] };
      },

      // Export to CSV
      exportToCSV: (filterDate = null) => {
        const { bets } = get();
        const filtered = filterDate 
          ? bets.filter(b => b.placedAt.split('T')[0] === filterDate)
          : bets;
        
        const headers = [
          'Date', 'Time', 'Venue', 'Race Time', 'Runner', 'Side', 'Stake', 'Odds', 
          'Liability', 'Result', 'Returns', 'P/L', 'Rule', 'Bet ID'
        ];
        
        const rows = filtered.map(b => {
          const raceTimeStr = b.raceTime 
            ? new Date(b.raceTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : '';
          return [
            b.placedAt.split('T')[0],
            b.placedAt.split('T')[1]?.split('.')[0] || '',
            `"${(b.venue || b.marketName || '').replace(/"/g, '""')}"`,
            raceTimeStr,
            `"${b.runnerName.replace(/"/g, '""')}"`,
            b.side,
            b.stake.toFixed(2),
            b.odds.toFixed(2),
            b.liability.toFixed(2),
            b.result,
            b.returns.toFixed(2),
            b.profitLoss.toFixed(2),
            b.ruleId || '',
            b.betId || b.id
          ];
        });
        
        // Add summary row
        const stats = filterDate ? get().getDailyStats(filterDate) : get().getTotalStats();
        rows.push([]);
        rows.push(['Summary']);
        rows.push(['Total Bets', stats.count]);
        rows.push(['Total Staked', `£${stats.totalStaked.toFixed(2)}`]);
        rows.push(['Total Returns', `£${stats.totalReturns.toFixed(2)}`]);
        rows.push(['Profit/Loss', `£${stats.profitLoss.toFixed(2)}`]);
        rows.push(['Win Rate', stats.count > 0 ? `${((stats.wins / (stats.wins + stats.losses)) * 100 || 0).toFixed(1)}%` : '0%']);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      },

      // Clear all history
      clearHistory: () => set({ bets: [] }),
      
      // Remove a single bet
      removeBet: (betId) => set((state) => ({
        bets: state.bets.filter(b => b.id !== betId && b.betId !== betId)
      })),
    }),
    {
      name: 'chimera-betting-history',
    }
  )
);

/**
 * Rules Store - For rule-based automatic betting
 * Persisted to localStorage
 */
export const useRulesStore = create(
  persist(
    (set, get) => ({
      isEnabled: false,
      isRunning: false, // Whether auto-betting is actively running
      activeRules: [],
      
      settings: {
        maxRaces: 10,
        minStake: 1.00,
        maxStake: 10.00,
        totalLimit: 100.00,
        stopLoss: 50.00,
        onlyPreRace: true,
      },
      
      session: {
        betsPlaced: 0,
        totalStaked: 0,
        racesProcessed: 0,
        profitLoss: 0,
        processedMarkets: [],
      },

      toggleEnabled: () => set((state) => ({ 
        isEnabled: !state.isEnabled,
        isRunning: false, // Stop running when toggling
        session: !state.isEnabled ? {
          betsPlaced: 0,
          totalStaked: 0,
          racesProcessed: 0,
          profitLoss: 0,
          processedMarkets: [],
        } : state.session
      })),

      toggleRule: (ruleId) => set((state) => ({
        activeRules: state.activeRules.includes(ruleId)
          ? state.activeRules.filter(id => id !== ruleId)
          : [...state.activeRules, ruleId]
      })),

      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      updateSession: (updates) => set((state) => ({
        session: { ...state.session, ...updates }
      })),

      startAutoBetting: () => set({ isRunning: true }),
      stopAutoBetting: () => set({ isRunning: false }),

      canContinueBetting: () => {
        const { isEnabled, isRunning, settings, session } = get();
        if (!isEnabled || !isRunning) return false;
        if (session.racesProcessed >= settings.maxRaces) return false;
        if (session.totalStaked >= settings.totalLimit) return false;
        if (session.profitLoss <= -settings.stopLoss) return false;
        return true;
      },

      resetSession: () => set({
        session: {
          betsPlaced: 0,
          totalStaked: 0,
          racesProcessed: 0,
          profitLoss: 0,
          processedMarkets: [],
        }
      }),

      clearRules: () => set({ activeRules: [] }),
    }),
    {
      name: 'chimera-rules-storage',
      partialize: (state) => ({
        activeRules: state.activeRules,
        settings: state.settings,
      }),
    }
  )
);

/**
 * Toast Notifications Store
 */
export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}));
