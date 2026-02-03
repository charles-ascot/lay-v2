/**
 * CHIMERA Market View
 * Displays runners with lay prices for selected market
 */

import { useMemo } from 'react';
import { useMarketsStore, useBetSlipStore } from '../store';
import { format, parseISO } from 'date-fns';

function MarketView({ isRefreshing }) {
  const { selectedMarket, runners, marketBook } = useMarketsStore();
  const { selection, setSelection } = useBetSlipStore();

  if (!selectedMarket) {
    return null;
  }

  const startTime = selectedMarket.marketStartTime 
    ? parseISO(selectedMarket.marketStartTime) 
    : null;

  const marketStatus = marketBook?.status || 'UNKNOWN';
  const inPlay = marketBook?.inplay || false;

  return (
    <div className="animate-fadeIn">
      {/* Market Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-chimera-accent text-sm font-medium uppercase tracking-wider">
                {selectedMarket.event?.venue || selectedMarket.competition?.name || 'Race'}
              </span>
              
              <MarketStatusBadge status={marketStatus} inPlay={inPlay} />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedMarket.marketName || 'WIN Market'}
            </h2>
            
            {selectedMarket.event?.name && (
              <p className="text-chimera-muted">
                {selectedMarket.event.name}
              </p>
            )}
          </div>

          <div className="text-right">
            {startTime && (
              <>
                <div className="text-3xl font-mono font-bold text-white">
                  {format(startTime, 'HH:mm')}
                </div>
                <div className="text-sm text-chimera-muted">
                  {format(startTime, 'EEEE, d MMMM')}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Refresh indicator */}
        {isRefreshing && (
          <div className="mt-4 flex items-center gap-2 text-xs text-chimera-accent">
            <span className="w-2 h-2 rounded-full bg-chimera-accent animate-pulse" />
            Updating prices...
          </div>
        )}
      </div>

      {/* Runners Table */}
      <div className="glass-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-chimera-surface border-b border-chimera-border">
          <div className="col-span-1 text-xs font-medium text-chimera-muted uppercase">
            #
          </div>
          <div className="col-span-5 text-xs font-medium text-chimera-muted uppercase">
            Runner
          </div>
          <div className="col-span-3 text-xs font-medium text-chimera-muted uppercase text-center">
            Back
          </div>
          <div className="col-span-3 text-xs font-medium text-chimera-muted uppercase text-center">
            Lay
          </div>
        </div>

        {/* Runners */}
        <div className="divide-y divide-chimera-border">
          {runners.map((runner, index) => (
            <RunnerRow
              key={runner.selectionId}
              runner={runner}
              index={index}
              market={selectedMarket}
              isSelected={selection?.selectionId === runner.selectionId}
              onSelectLay={() => setSelection(runner, selectedMarket)}
            />
          ))}
        </div>

        {/* No runners message */}
        {(!runners || runners.length === 0) && (
          <div className="p-12 text-center">
            <p className="text-chimera-muted">
              No runners available for this market
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-chimera-muted">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded price-back" />
          <span>Back (Bet FOR)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded price-lay" />
          <span>Lay (Bet AGAINST)</span>
        </div>
      </div>
    </div>
  );
}

function RunnerRow({ runner, index, market, isSelected, onSelectLay }) {
  const backPrices = runner.prices?.availableToBack || [];
  const layPrices = runner.prices?.availableToLay || [];

  const runnerName = runner.runnerName || `Selection ${runner.selectionId}`;
  const jockey = runner.metadata?.JOCKEY_NAME;
  const trainer = runner.metadata?.TRAINER_NAME;

  const isActive = runner.status === 'ACTIVE';

  return (
    <div 
      className={`
        grid grid-cols-12 gap-4 px-6 py-4 transition-all duration-150
        ${isSelected ? 'bg-chimera-accent/5' : 'hover:bg-chimera-surface-hover'}
        ${!isActive ? 'opacity-50' : ''}
      `}
    >
      {/* Runner Number */}
      <div className="col-span-1 flex items-center">
        <div className="runner-number">
          {runner.sortPriority || index + 1}
        </div>
      </div>

      {/* Runner Info */}
      <div className="col-span-5 flex flex-col justify-center">
        <span className="font-semibold text-white">
          {runnerName}
        </span>
        {(jockey || trainer) && (
          <span className="text-xs text-chimera-muted mt-0.5">
            {jockey && <span>J: {jockey}</span>}
            {jockey && trainer && <span className="mx-1">|</span>}
            {trainer && <span>T: {trainer}</span>}
          </span>
        )}
        {runner.lastPriceTraded && (
          <span className="text-xs text-chimera-accent mt-1 font-mono">
            Last: {runner.lastPriceTraded.toFixed(2)}
          </span>
        )}
      </div>

      {/* Back Prices */}
      <div className="col-span-3 flex items-center justify-center gap-1">
        {backPrices.slice(0, 3).reverse().map((price, i) => (
          <PriceCell
            key={i}
            price={price.price}
            size={price.size}
            type="back"
            isTop={i === 2}
          />
        ))}
        {backPrices.length === 0 && (
          <span className="text-chimera-muted text-sm">-</span>
        )}
      </div>

      {/* Lay Prices */}
      <div className="col-span-3 flex items-center justify-center gap-1">
        {layPrices.slice(0, 3).map((price, i) => (
          <PriceCell
            key={i}
            price={price.price}
            size={price.size}
            type="lay"
            isTop={i === 0}
            onClick={isActive && i === 0 ? onSelectLay : undefined}
            isSelected={isSelected && i === 0}
          />
        ))}
        {layPrices.length === 0 && (
          <span className="text-chimera-muted text-sm">-</span>
        )}
      </div>
    </div>
  );
}

function PriceCell({ price, size, type, isTop, onClick, isSelected }) {
  const formattedPrice = price?.toFixed(2) || '-';
  const formattedSize = size ? `£${size.toFixed(0)}` : '';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        price-cell min-w-[70px]
        ${type === 'back' ? 'price-back' : 'price-lay'}
        ${isTop ? 'ring-1 ring-inset' : 'opacity-70'}
        ${type === 'back' ? 'ring-blue-500/30' : 'ring-red-500/30'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${isSelected ? 'ring-2 ring-chimera-accent' : ''}
      `}
    >
      <div className={`price-value ${type === 'back' ? 'text-blue-400' : 'text-red-400'}`}>
        {formattedPrice}
      </div>
      <div className="price-size">
        {formattedSize}
      </div>
    </button>
  );
}

function MarketStatusBadge({ status, inPlay }) {
  if (inPlay) {
    return (
      <span className="status-badge bg-red-500/20 text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        IN-PLAY
      </span>
    );
  }

  const statusConfig = {
    OPEN: { class: 'status-connected', text: 'Open' },
    SUSPENDED: { class: 'status-loading', text: 'Suspended' },
    CLOSED: { class: 'status-disconnected', text: 'Closed' },
  };

  const config = statusConfig[status] || { class: 'status-loading', text: status };

  return (
    <span className={`status-badge ${config.class}`}>
      {config.text}
    </span>
  );
}

export default MarketView;
