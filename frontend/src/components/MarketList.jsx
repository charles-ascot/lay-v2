/**
 * Market List Component
 * Shows available racing markets with country filter tabs
 */

import { useState, useMemo } from 'react';
import { useMarketsStore } from '../store';

// Country groupings with flags
const COUNTRY_GROUPS = [
  { id: 'GB,IE', label: 'GB & IRE', flags: '🇬🇧🇮🇪', codes: ['GB', 'IE'] },
  { id: 'US', label: 'USA', flags: '🇺🇸', codes: ['US'] },
  { id: 'ZA', label: 'RSA', flags: '🇿🇦', codes: ['ZA'] },
  { id: 'FR', label: 'FRA', flags: '🇫🇷', codes: ['FR'] },
  { id: 'AU', label: 'AUS', flags: '🇦🇺', codes: ['AU'] },
  { id: 'NZ', label: 'NZL', flags: '🇳🇿', codes: ['NZ'] },
];

function MarketList({ markets, isLoading }) {
  const { selectedMarket, selectMarket } = useMarketsStore();
  const [selectedCountry, setSelectedCountry] = useState('GB,IE');

  // Group markets by venue and count by country
  const { groupedMarkets, countryCounts } = useMemo(() => {
    const counts = {};
    COUNTRY_GROUPS.forEach(g => counts[g.id] = 0);
    
    // Count markets per country group
    markets.forEach(m => {
      const countryCode = m.event?.countryCode || 'GB';
      COUNTRY_GROUPS.forEach(g => {
        if (g.codes.includes(countryCode)) {
          counts[g.id]++;
        }
      });
    });

    // Filter markets by selected country
    const selectedGroup = COUNTRY_GROUPS.find(g => g.id === selectedCountry);
    const filteredMarkets = selectedGroup 
      ? markets.filter(m => selectedGroup.codes.includes(m.event?.countryCode || 'GB'))
      : markets;

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

    return { groupedMarkets: sorted, countryCounts: counts };
  }, [markets, selectedCountry]);

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
      {/* Country Filter Tabs */}
      <div className="flex-shrink-0 p-2 border-b border-chimera-border bg-chimera-surface/50">
        <div className="flex flex-wrap gap-1">
          {COUNTRY_GROUPS.map(group => {
            const count = countryCounts[group.id] || 0;
            const isSelected = selectedCountry === group.id;
            
            return (
              <button
                key={group.id}
                onClick={() => setSelectedCountry(group.id)}
                disabled={count === 0}
                className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-chimera-accent text-white'
                    : count > 0
                      ? 'bg-chimera-bg text-chimera-muted hover:text-white hover:bg-chimera-border'
                      : 'bg-chimera-bg/50 text-chimera-muted/50 cursor-not-allowed'
                }`}
              >
                <span>{group.flags}</span>
                <span>{group.label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20' : 'bg-chimera-surface'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Markets List */}
      <div className="flex-1 overflow-y-auto">
        {groupedMarkets.length === 0 ? (
          <div className="p-4 text-center text-chimera-muted text-sm">
            No races in this region
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
