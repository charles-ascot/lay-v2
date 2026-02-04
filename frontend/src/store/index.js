/**
 * CHIMERA State Management
 * Zustand store for application state
 * UPDATED: Added Rules store for rule-based betting
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
      set({ 
        isAuthenticated: true, 
        isLoading: false,
        user: { username }
      });
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
      set({ 
        isAuthenticated: false, 
        user: null,
        error: null 
      });
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
      set({ 
        catalogue, 
        isLoading: false,
        lastUpdated: new Date().toISOString()
      });
      return catalogue;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch markets';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  selectMarket: async (market) => {
    set({ 
      selectedMarket: market,
      runners: market?.runners || [],
      marketBook: null 
    });
    
    if (market) {
      await get().fetchMarketBook(market.marketId);
    }
  },

  fetchMarketBook: async (marketId) => {
    if (!marketId) return;
    
    try {
      const books = await marketsAPI.getBook([marketId]);
      const book = books?.[0] || null;
      
      // Merge runner data with price data
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
      
      set({ 
        marketBook: book,
        lastUpdated: new Date().toISOString()
      });
      return book;
    } catch (error) {
      console.error('Failed to fetch market book:', error);
      throw error;
    }
  },

  clearSelection: () => set({ 
    selectedMarket: null, 
    marketBook: null,
    runners: [] 
  }),

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
    // Get best lay price
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

  clearSlip: () => set({ 
    selection: null, 
    stake: '', 
    odds: '',
    error: null,
    lastBetResult: null 
  }),

  placeBet: async () => {
    const { selection, stake, odds } = get();
    
    if (!selection || !stake || !odds) {
      set({ error: 'Please complete all bet details' });
      return;
    }

    const stakeNum = parseFloat(stake);
    const oddsNum = parseFloat(odds);

    // Validate bet sizing rules
    if (stakeNum < 1.0 && stakeNum * oddsNum < 10.0) {
      set({ error: 'Stakes below £1 require potential payout of £10 or greater' });
      return;
    }

    set({ isPlacing: true, error: null });
    
    try {
      const result = await ordersAPI.placeLay(
        selection.marketId,
        selection.selectionId,
        oddsNum,
        stakeNum
      );
      
      set({ 
        isPlacing: false,
        lastBetResult: result,
        selection: null,
        stake: '',
        odds: ''
      });
      
      return result;
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Failed to place bet';
      set({ error: message, isPlacing: false });
      throw error;
    }
  },

  // Calculate liability for lay bet
  getLiability: () => {
    const { stake, odds } = get();
    const s = parseFloat(stake) || 0;
    const o = parseFloat(odds) || 0;
    return s * (o - 1);
  },

  // Calculate potential profit
  getProfit: () => {
    const { stake } = get();
    return parseFloat(stake) || 0;
  },

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
      set({ 
        orders,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      });
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
      // Refresh orders after cancel
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
      set({ 
        balance,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      });
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
 * Rules Store - For rule-based automatic betting
 * Persisted to localStorage so settings survive page refresh
 */
export const useRulesStore = create(
  persist(
    (set, get) => ({
      // Master toggle for rule-based betting
      isEnabled: false,
      
      // List of active rule IDs
      activeRules: [],
      
      // Betting settings
      settings: {
        maxRaces: 10,           // Max number of races to bet on
        minStake: 1.00,         // Minimum stake per bet (£)
        maxStake: 10.00,        // Maximum stake per bet (£)
        totalLimit: 100.00,     // Total session budget (£)
        stopLoss: 50.00,        // Stop if losses exceed this
        onlyPreRace: true,      // Only bet within 5 mins of start
      },
      
      // Session tracking
      session: {
        betsPlaced: 0,
        totalStaked: 0,
        racesProcessed: 0,
        profitLoss: 0,
      },

      // Toggle master enable/disable
      toggleEnabled: () => set((state) => ({ 
        isEnabled: !state.isEnabled,
        // Reset session when enabling
        session: state.isEnabled ? state.session : {
          betsPlaced: 0,
          totalStaked: 0,
          racesProcessed: 0,
          profitLoss: 0,
        }
      })),

      // Toggle individual rule
      toggleRule: (ruleId) => set((state) => ({
        activeRules: state.activeRules.includes(ruleId)
          ? state.activeRules.filter(id => id !== ruleId)
          : [...state.activeRules, ruleId]
      })),

      // Update settings
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),

      // Update session stats
      updateSession: (updates) => set((state) => ({
        session: { ...state.session, ...updates }
      })),

      // Check if betting should continue
      canContinueBetting: () => {
        const { isEnabled, settings, session } = get();
        
        if (!isEnabled) return false;
        if (session.racesProcessed >= settings.maxRaces) return false;
        if (session.totalStaked >= settings.totalLimit) return false;
        if (session.profitLoss <= -settings.stopLoss) return false;
        
        return true;
      },

      // Reset session
      resetSession: () => set({
        session: {
          betsPlaced: 0,
          totalStaked: 0,
          racesProcessed: 0,
          profitLoss: 0,
        }
      }),

      // Clear all rules
      clearRules: () => set({ activeRules: [] }),
    }),
    {
      name: 'chimera-rules-storage',
      partialize: (state) => ({
        activeRules: state.activeRules,
        settings: state.settings,
        // Don't persist isEnabled - always start off
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
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter(t => t.id !== id)
        }));
      }, duration);
    }
    
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));
