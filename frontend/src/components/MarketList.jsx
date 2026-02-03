/**
 * CHIMERA Market List
 * Displays available horse racing markets
 */

import { useMemo } from 'react';
import { useMarketsStore } from '../store';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

function MarketList({ markets, isLoading }) {
  const { selectedMarket, selectMarket } = useMarketsStore();

  // Group markets by venue
  const groupedMarkets = useMemo(() => {
    if (!markets?.length) return {};
    
    return markets.reduce((acc, market) => {
      const venue = market.event?.venue || market.competition?.name || 'Unknown';
      if (!acc[venue]) {
        acc[venue] = [];
      }
      acc[venue].push(market);
      return acc;
    }, {});
  }, [markets]);

  // Sort venues alphabetically
  const sortedVenues = useMemo(() => {
    return Object.keys(groupedMarkets).sort();
  }, [groupedMarkets]);

  if (isLoading && !markets?.length) {
    return <LoadingSkeleton />;
  }

  if (!markets?.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-chimera-muted text-sm">
          No races available
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="px-4 mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-chimera-accent" />
          Today's Racing
        </h2>
        <p className="text-xs text-chimera-muted mt-1">
          {markets.length} WIN markets available
        </p>
      </div>

      <div className="space-y-4">
        {sortedVenues.map((venue) => (
          <VenueGroup
            key={venue}
            venue={venue}
            markets={groupedMarkets[venue]}
            selectedMarketId={selectedMarket?.marketId}
            onSelectMarket={selectMarket}
          />
        ))}
      </div>
    </div>
  );
}

function VenueGroup({ venue, markets, selectedMarketId, onSelectMarket }) {
  // Sort by start time
  const sortedMarkets = useMemo(() => {
    return [...markets].sort((a, b) => {
      const timeA = new Date(a.marketStartTime || 0);
      const timeB = new Date(b.marketStartTime || 0);
      return timeA - timeB;
    });
  }, [markets]);

  return (
    <div>
      <div className="px-4 py-2 bg-chimera-surface">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-chimera-accent">
          {venue}
        </h3>
      </div>
      
      <div>
        {sortedMarkets.map((market) => (
          <MarketItem
            key={market.marketId}
            market={market}
            isSelected={market.marketId === selectedMarketId}
            onClick={() => onSelectMarket(market)}
          />
        ))}
      </div>
    </div>
  );
}

function MarketItem({ market, isSelected, onClick }) {
  const startTime = market.marketStartTime ? parseISO(market.marketStartTime) : null;
  
  const timeDisplay = useMemo(() => {
    if (!startTime) return 'TBD';
    return format(startTime, 'HH:mm');
  }, [startTime]);

  const dateLabel = useMemo(() => {
    if (!startTime) return '';
    if (isToday(startTime)) return 'Today';
    if (isTomorrow(startTime)) return 'Tomorrow';
    return format(startTime, 'dd MMM');
  }, [startTime]);

  // Calculate time until race
  const timeUntil = useMemo(() => {
    if (!startTime) return null;
    const now = new Date();
    const diff = startTime - now;
    
    if (diff < 0) return 'Started';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }, [startTime]);

  const runnersCount = market.runners?.length || 0;

  return (
    <button
      onClick={onClick}
      className={`
        w-full px-4 py-3 text-left transition-all duration-150
        hover:bg-chimera-surface-hover border-l-2
        ${isSelected 
          ? 'bg-chimera-surface border-l-chimera-accent' 
          : 'border-l-transparent'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-semibold text-white">
          {timeDisplay}
        </span>
        
        {timeUntil && (
          <span className={`
            text-xs font-medium px-2 py-0.5 rounded
            ${timeUntil === 'Started' 
              ? 'bg-red-500/20 text-red-400' 
              : 'bg-chimera-accent/20 text-chimera-accent'
            }
          `}>
            {timeUntil}
          </span>
        )}
      </div>
      
      <p className="text-sm text-chimera-muted mt-1 truncate">
        {market.marketName || `Race at ${timeDisplay}`}
      </p>
      
      <div className="flex items-center gap-3 mt-2 text-xs text-chimera-muted">
        <span className="flex items-center gap-1">
          <HorseIcon className="w-3 h-3" />
          {runnersCount} runners
        </span>
        <span>{dateLabel}</span>
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

// Icons
function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function HorseIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2L3 9h4v9h6V9h4L10 2z" />
    </svg>
  );
}

export default MarketList;
