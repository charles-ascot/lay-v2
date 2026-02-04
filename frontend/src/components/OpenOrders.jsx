/**
 * Open Orders Panel
 * Shows current unmatched and matched bets with cancel functionality
 */

import { useEffect, useState } from 'react';
import { useOrdersStore, useToastStore } from '../store';

function OpenOrders() {
  const { 
    orders, 
    isLoading, 
    error,
    fetchOrders, 
    cancelOrder,
    isCancelling 
  } = useOrdersStore();
  const { addToast } = useToastStore();
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Fetch orders on mount and every 10 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCancel = async (marketId, betId) => {
    try {
      await cancelOrder(marketId, betId);
      addToast('Order cancelled successfully', 'success');
    } catch (err) {
      addToast('Failed to cancel order', 'error');
    }
  };

  const handleCancelAll = async (marketId) => {
    try {
      await cancelOrder(marketId);
      addToast('All orders cancelled for market', 'success');
    } catch (err) {
      addToast('Failed to cancel orders', 'error');
    }
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <OrdersIcon className="w-4 h-4" />
          Open Orders
        </h3>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <OrdersIcon className="w-4 h-4" />
          Open Orders
        </h3>
        <div className="text-sm text-red-400 py-4 text-center">
          {error}
        </div>
      </div>
    );
  }

  const unmatchedOrders = orders.filter(o => o.sizeRemaining > 0);
  const matchedOrders = orders.filter(o => o.sizeMatched > 0);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <OrdersIcon className="w-4 h-4" />
          Open Orders
          {orders.length > 0 && (
            <span className="bg-chimera-accent/20 text-chimera-accent text-xs px-2 py-0.5 rounded-full">
              {orders.length}
            </span>
          )}
        </h3>
        <button 
          onClick={fetchOrders}
          disabled={isLoading}
          className="text-xs text-chimera-muted hover:text-white transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-6">
          <EmptyIcon className="w-10 h-10 text-chimera-muted mx-auto mb-2 opacity-50" />
          <p className="text-sm text-chimera-muted">No open orders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unmatched Orders */}
          {unmatchedOrders.length > 0 && (
            <div>
              <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2">
                Unmatched ({unmatchedOrders.length})
              </div>
              <div className="space-y-2">
                {unmatchedOrders.map((order) => (
                  <OrderCard 
                    key={order.betId}
                    order={order}
                    type="unmatched"
                    onCancel={handleCancel}
                    isCancelling={isCancelling}
                    isExpanded={expandedOrder === order.betId}
                    onToggle={() => setExpandedOrder(
                      expandedOrder === order.betId ? null : order.betId
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Matched Orders */}
          {matchedOrders.length > 0 && (
            <div>
              <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2 mt-4">
                Matched ({matchedOrders.length})
              </div>
              <div className="space-y-2">
                {matchedOrders.map((order) => (
                  <OrderCard 
                    key={order.betId}
                    order={order}
                    type="matched"
                    isExpanded={expandedOrder === order.betId}
                    onToggle={() => setExpandedOrder(
                      expandedOrder === order.betId ? null : order.betId
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, type, onCancel, isCancelling, isExpanded, onToggle }) {
  const isLay = order.side === 'LAY';
  const liability = isLay ? order.sizeRemaining * (order.priceSize?.price - 1 || order.averagePriceMatched - 1) : 0;
  
  return (
    <div className="bg-chimera-surface border border-chimera-border rounded-lg overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-chimera-border/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              isLay ? 'bg-chimera-pink/20 text-chimera-pink' : 'bg-chimera-blue/20 text-chimera-blue'
            }`}>
              {order.side}
            </span>
            <span className="text-sm text-white font-medium truncate max-w-[120px]">
              {order.selectionName || `Selection ${order.selectionId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-white">
              £{(order.sizeRemaining || order.sizeMatched || 0).toFixed(2)}
            </span>
            <span className="text-xs text-chimera-muted">
              @ {order.priceSize?.price || order.averagePriceMatched || '-'}
            </span>
          </div>
        </div>
        
        {/* Progress bar for partially matched */}
        {order.sizeMatched > 0 && order.sizeRemaining > 0 && (
          <div className="mt-2">
            <div className="h-1 bg-chimera-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-chimera-green"
                style={{ 
                  width: `${(order.sizeMatched / (order.sizeMatched + order.sizeRemaining)) * 100}%` 
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-chimera-green">
                £{order.sizeMatched.toFixed(2)} matched
              </span>
              <span className="text-xs text-chimera-muted">
                £{order.sizeRemaining.toFixed(2)} remaining
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-chimera-border p-3 bg-chimera-bg/50">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="text-chimera-muted">Market:</span>
              <span className="text-white ml-1 truncate">{order.marketId}</span>
            </div>
            <div>
              <span className="text-chimera-muted">Bet ID:</span>
              <span className="text-white ml-1 font-mono">{order.betId}</span>
            </div>
            {isLay && (
              <div>
                <span className="text-chimera-muted">Liability:</span>
                <span className="text-chimera-pink ml-1">£{liability.toFixed(2)}</span>
              </div>
            )}
            <div>
              <span className="text-chimera-muted">Status:</span>
              <span className={`ml-1 ${
                order.status === 'EXECUTABLE' ? 'text-chimera-green' : 'text-chimera-muted'
              }`}>
                {order.status}
              </span>
            </div>
          </div>

          {/* Cancel button for unmatched */}
          {type === 'unmatched' && order.sizeRemaining > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel(order.marketId, order.betId);
              }}
              disabled={isCancelling}
              className="w-full btn-secondary py-2 text-xs text-red-400 hover:text-red-300 hover:border-red-400/50"
            >
              {isCancelling ? (
                <LoadingSpinner className="w-3 h-3" />
              ) : (
                'Cancel Order'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function OrdersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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

function EmptyIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function LoadingSpinner({ className = "w-5 h-5" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default OpenOrders;
