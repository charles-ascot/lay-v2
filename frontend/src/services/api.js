/**
 * CHIMERA API Client
 * Handles all communication with the FastAPI backend
 */

import axios from 'axios';

// API base URL - configured for Cloud Run deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session token storage key
const SESSION_TOKEN_KEY = 'chimera_session_token';
const SESSION_EXPIRY_KEY = 'chimera_session_expiry';

/**
 * Get stored session token
 */
export const getSessionToken = () => {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
};

/**
 * Store session token with expiry
 */
export const setSessionToken = (token, expiresAt) => {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
};

/**
 * Clear session data
 */
export const clearSession = () => {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
};

/**
 * Check if session is valid
 */
export const isSessionValid = () => {
  const token = getSessionToken();
  const expiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);
  
  if (!token || !expiry) return false;
  
  return new Date(expiry) > new Date();
};

// Request interceptor - add auth header
apiClient.interceptors.request.use(
  (config) => {
    const token = getSessionToken();
    if (token) {
      config.headers['X-Authentication'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login to Betfair Exchange
   */
  login: async (username, password) => {
    const response = await apiClient.post('/api/auth/login', {
      username,
      password,
    });
    
    const { session_token, expires_at } = response.data;
    setSessionToken(session_token, expires_at);
    
    return response.data;
  },

  /**
   * Keep session alive
   */
  keepAlive: async () => {
    const response = await apiClient.post('/api/auth/keepalive');
    
    if (response.data.expires_at) {
      const token = getSessionToken();
      setSessionToken(token, response.data.expires_at);
    }
    
    return response.data;
  },

  /**
   * Logout and terminate session
   */
  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      clearSession();
    }
  },
};

/**
 * Markets API
 */
export const marketsAPI = {
  /**
   * Get market catalogue for horse racing
   */
  getCatalogue: async (params = {}) => {
    const response = await apiClient.post('/api/markets/catalogue', {
      event_type_ids: params.eventTypeIds || ['7'],
      market_type_codes: params.marketTypeCodes || ['WIN'],
      max_results: params.maxResults || 100,
      from_time: params.fromTime,
      to_time: params.toTime,
    });
    return response.data;
  },

  /**
   * Get market book with prices
   */
  getBook: async (marketIds, options = {}) => {
    const response = await apiClient.post('/api/markets/book', {
      market_ids: Array.isArray(marketIds) ? marketIds : [marketIds],
      price_projection: options.priceProjection || ['EX_BEST_OFFERS'],
      virtualise: options.virtualise !== false,
    });
    return response.data;
  },
};

/**
 * Orders API
 */
export const ordersAPI = {
  /**
   * Place a lay bet
   */
  placeLay: async (marketId, selectionId, odds, stake) => {
    const response = await apiClient.post('/api/orders/place', {
      market_id: marketId,
      selection_id: selectionId,
      odds: parseFloat(odds),
      stake: parseFloat(stake),
      persistence_type: 'LAPSE',
    });
    return response.data;
  },

  /**
   * Cancel orders
   */
  cancel: async (marketId, betId = null) => {
    const response = await apiClient.post('/api/orders/cancel', null, {
      params: { market_id: marketId, bet_id: betId },
    });
    return response.data;
  },

  /**
   * Get current unmatched orders
   */
  getCurrent: async (marketIds = null) => {
    const response = await apiClient.get('/api/orders/current', {
      params: { market_ids: marketIds?.join(',') },
    });
    return response.data;
  },
};

/**
 * Health check
 */
export const healthCheck = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export default apiClient;
