/**
 * CHIMERA API Service
 * Betfair Exchange API client
 * UPDATED: Added account balance and orders endpoints
 */

import axios from 'axios';

// API Base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Session storage keys
const SESSION_TOKEN_KEY = 'chimera_session_token';
const SESSION_EXPIRY_KEY = 'chimera_session_expiry';

/**
 * Axios instance with interceptors
 */
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers['X-Authentication'] = token;
  }
  return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
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
 * Session Management
 */
export function getSessionToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSession(token, expiresAt) {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
  localStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
}

export function clearSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

export function isSessionValid() {
  const token = getSessionToken();
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  
  if (!token || !expiry) return false;
  
  const expiryDate = new Date(expiry);
  return expiryDate > new Date();
}

/**
 * Authentication API
 */
export const authAPI = {
  async login(username, password) {
    const response = await api.post('/api/auth/login', { username, password });
    const { session_token, expires_at } = response.data;
    setSession(session_token, expires_at);
    return response.data;
  },

  async logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      clearSession();
    }
  },

  async keepAlive() {
    const response = await api.post('/api/auth/keepalive');
    if (response.data.expires_at) {
      const token = getSessionToken();
      setSession(token, response.data.expires_at);
    }
    return response.data;
  },
};

/**
 * Markets API
 */
export const marketsAPI = {
  async getCatalogue(params = {}) {
    const response = await api.post('/api/markets/catalogue', {
      event_type_ids: params.eventTypeIds || ['7'], // Horse racing
      market_type_codes: params.marketTypeCodes || ['WIN'],
      max_results: params.maxResults || 100,
      from_time: params.fromTime,
      to_time: params.toTime,
    });
    return response.data;
  },

  async getBook(marketIds, priceProjection = ['EX_BEST_OFFERS']) {
    const response = await api.post('/api/markets/book', {
      market_ids: marketIds,
      price_projection: priceProjection,
      virtualise: true,
    });
    return response.data;
  },
};

/**
 * Orders API - UPDATED
 */
export const ordersAPI = {
  async placeLay(marketId, selectionId, odds, stake) {
    const response = await api.post('/api/orders/place', {
      market_id: marketId,
      selection_id: selectionId,
      odds: odds,
      stake: stake,
      persistence_type: 'LAPSE',
    });
    return response.data;
  },

  async getCurrentOrders(marketIds = null) {
    const params = marketIds && Array.isArray(marketIds) ? `?market_ids=${marketIds.join(',')}` : '';
    const response = await api.get(`/api/orders/current${params}`);
    return response.data;
  },

  async cancelOrder(marketId, betId = null) {
    const response = await api.post('/api/orders/cancel', null, {
      params: { market_id: marketId, bet_id: betId }
    });
    return response.data;
  },
};

/**
 * Account API - NEW
 */
export const accountAPI = {
  async getBalance() {
    const response = await api.get('/api/account/balance');
    return response.data;
  },
};

export default api;
