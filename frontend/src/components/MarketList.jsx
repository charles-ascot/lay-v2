/**
 * Market List Component
 * Shows available racing markets grouped by venue
 * UPDATED: Removed header (now in Dashboard)
 */

import { useMemo } from 'react';
import { useMarketsStore } from '../store';

function MarketList({ markets, isLoading }) {
  const { selectedMarket, selectMarket } = useMarketsStore();

  // Group markets by venue/competition
  const groupedMarkets = useMemo(() => {
    const groups = {};
    
    markets.forEach(market => {
      const venue = market.competition?.name || market.event?.venue || 'Other';
      if (!groups[venue]) {
        groups[venue] = [];
      }
      groups[venue].push(market);
    });

    // Sort each group by start time
    Object.values(groups).forEach(group => {
      group.sort((a, b) => new Date(a.marketStartTime) - new Date(b.marketStartTime));
    });

    return groups;
  }, [markets]);

  if (isLoading && markets.length === 0) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-chimera-border rounded w-24 mb-2" />
              <div className="h-16 bg-chimera-surface rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-chimera-muted">No markets available</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {Object.entries(groupedMarkets).map(([venue, venueMarkets]) => (
        <div key={venue} className="mb-2">
          {/* Venue Header */}
          <div className="px-4 py-2 sticky top-0 bg-chimera-bg/95 backdrop-blur-sm z-10">
            <h3 className="text-xs font-semibold text-chimera-accent uppercase tracking-wider">
              {venue}
            </h3>
          </div>

          {/* Markets */}
          <div className="space-y-1 px-2">
            {venueMarkets.map(market => (
              <MarketCard
                key={market.marketId}
                market={market}
                isSelected={selectedMarket?.marketId === market.marketId}
                onSelect={() => selectMarket(market)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketCard({ market, isSelected, onSelect }) {
  const startTime = new Date(market.marketStartTime);
  const now = new Date();
  const minutesToStart = Math.round((startTime - now) / 60000);
  
  // Format time
  const timeStr = startTime.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Time until start badge
  const getTimeBadge = () => {
    if (minutesToStart < 0) {
      return { text: 'Started', color: 'bg-red-500/20 text-red-400' };
    } else if (minutesToStart <= 5) {
      return { text: `${minutesToStart}m`, color: 'bg-red-500/20 text-red-400' };
    } else if (minutesToStart <= 30) {
      return { text: `${minutesToStart}m`, color: 'bg-yellow-500/20 text-yellow-400' };
    } else if (minutesToStart <= 60) {
      return { text: `${minutesToStart}m`, color: 'bg-chimera-green/20 text-chimera-green' };
    } else {
      const hours = Math.floor(minutesToStart / 60);
      const mins = minutesToStart % 60;
      return { 
        text: `${hours}h ${mins}m`, 
        color: 'bg-chimera-accent/20 text-chimera-accent' 
      };
    }
  };

  const timeBadge = getTimeBadge();

  // Race name formatting
  const raceName = market.event?.name || market.marketName || 'Unknown Race';
  const raceType = market.description?.raceType || '';
  const runnerCount = market.runners?.length || 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected 
          ? 'bg-chimera-accent/20 border border-chimera-accent/50' 
          : 'bg-chimera-surface hover:bg-chimera-border/50 border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {timeStr}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${timeBadge.color}`}>
              {timeBadge.text}
            </span>
          </div>
          <p className="text-xs text-chimera-muted mt-1 truncate">
            {raceName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-chimera-muted">
              🐎 {runnerCount} runners
            </span>
            {raceType && (
              <span className="text-xs text-chimera-muted">
                • {raceType}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default MarketList;
