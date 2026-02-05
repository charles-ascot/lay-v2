/**
 * Market List Component
 * Shows available racing markets - GB & IRE only
 */

import { useMemo } from 'react';
import { useMarketsStore } from '../store';

function MarketList({ markets, isLoading }) {
  const { selectedMarket, selectMarket } = useMarketsStore();

  // Group markets by venue - HARDCODED TO GB & IE ONLY
  const groupedMarkets = useMemo(() => {
    // Filter markets to GB and IE only
    const filteredMarkets = markets.filter(m => {
      const countryCode = m.event?.countryCode || 'GB';
      return countryCode === 'GB' || countryCode === 'IE';
    });

    // Group by venue
    const byVenue = {};
    filteredMarkets.forEach(market => {
      const venue = market.event?.venue || 'Unknown';
      if (!byVenue[venue]) {
        byVenue[venue] = [];
      }
      byVenue[venue].push(market);
    });

    // Sort venues alphabetically, sort races by time within each venue
    const sorted = Object.entries(byVenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([venue, races]) => ({
        venue,
        races: races.sort((a, b) =>
          new Date(a.marketStartTime) - new Date(b.marketStartTime)
        )
      }));

    return sorted;
  }, [markets]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-chimera-surface rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="p-4 text-center text-chimera-muted">
        <p>No markets available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Markets List - GB & IE only */}
      <div className="flex-1 overflow-y-auto">
        {groupedMarkets.length === 0 ? (
          <div className="p-4 text-center text-chimera-muted text-sm">
            No GB or IRE races available
          </div>
        ) : (
          groupedMarkets.map(({ venue, races }) => (
            <div key={venue} className="border-b border-chimera-border">
              {/* Venue Header */}
              <div className="px-4 py-2 bg-chimera-surface/30 sticky top-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{venue}</span>
                  <span className="text-xs text-chimera-muted">{races.length} races</span>
                </div>
              </div>

              {/* Race Times */}
              <div className="p-2 flex flex-wrap gap-1">
                {races.map(market => {
                  const time = new Date(market.marketStartTime).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const isSelected = selectedMarket?.marketId === market.marketId;
                  const isPast = new Date(market.marketStartTime) < new Date();
                  const isStartingSoon = !isPast && 
                    (new Date(market.marketStartTime) - new Date()) < 5 * 60 * 1000;

                  return (
                    <button
                      key={market.marketId}
                      onClick={() => selectMarket(market)}
                      className={`px-3 py-1.5 rounded text-sm font-mono transition-colors ${
                        isSelected
                          ? 'bg-chimera-accent text-white'
                          : isPast
                            ? 'bg-chimera-surface/50 text-chimera-muted/50'
                            : 'bg-chimera-surface text-white hover:bg-chimera-border'
                      }`}
                    >
                      {isStartingSoon && !isSelected && (
                        <span className="inline-block w-2 h-2 rounded-full bg-chimera-green mr-1 animate-pulse" />
                      )}
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MarketList;
