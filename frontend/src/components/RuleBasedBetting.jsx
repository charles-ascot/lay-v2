/**
 * Rule Based Betting Panel
 * With START/STOP button and actual rule evaluation engine
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRulesStore, useMarketsStore, useToastStore, useHistoryStore } from '../store';
import { ordersAPI, marketsAPI } from '../services/api';

// Mark's betting rules with actual evaluation logic
const BETTING_RULES = [
  {
    id: 'R-001',
    name: 'Dual Favourite Coverage',
    type: 'Stake Allocation',
    description: 'When the favourite is priced above 5.0 and the price gap between the favourite and second favourite is small, both runners are backed.',
    formula: 'FavOdds > 5.0 AND Gap < 2.0',
    action: 'Back both Fav & 2nd Fav',
    notes: 'Hedge for unclear dominance',
    evaluate: (runners, settings) => {
      const sorted = runners
        .filter(r => r.prices?.availableToLay?.[0]?.price)
        .sort((a, b) => a.prices.availableToLay[0].price - b.prices.availableToLay[0].price);
      
      if (sorted.length < 2) return null;
      
      const favOdds = sorted[0].prices.availableToLay[0].price;
      const secondOdds = sorted[1].prices.availableToLay[0].price;
      const gap = Math.abs(favOdds - secondOdds);
      
      if (favOdds > 5.0 && gap < 2.0) {
        return {
          matched: true,
          selections: [
            { runner: sorted[0], stake: settings.minStake },
            { runner: sorted[1], stake: settings.minStake }
          ],
          analysis: `Fav ${favOdds.toFixed(2)}, Gap ${gap.toFixed(2)} < 2.0 → Dual coverage`
        };
      }
      return null;
    }
  },
  {
    id: 'R-002',
    name: 'Strong Favourite Focus',
    type: 'Stake Allocation',
    description: 'When the favourite is priced above 5.0 and clearly separated from second favourite, back only the favourite.',
    formula: 'FavOdds > 5.0 AND Gap >= 2.0',
    action: 'Back Favourite only',
    notes: 'Market confidence concentrated',
    evaluate: (runners, settings) => {
      const sorted = runners
        .filter(r => r.prices?.availableToLay?.[0]?.price)
        .sort((a, b) => a.prices.availableToLay[0].price - b.prices.availableToLay[0].price);
      
      if (sorted.length < 2) return null;
      
      const favOdds = sorted[0].prices.availableToLay[0].price;
      const secondOdds = sorted[1].prices.availableToLay[0].price;
      const gap = Math.abs(favOdds - secondOdds);
      
      if (favOdds > 5.0 && gap >= 2.0) {
        return {
          matched: true,
          selections: [{ runner: sorted[0], stake: settings.minStake }],
          analysis: `Fav ${favOdds.toFixed(2)}, Gap ${gap.toFixed(2)} >= 2.0 → Strong fav`
        };
      }
      return null;
    }
  },
  {
    id: 'R-003',
    name: 'Grade 1 Odds-On Risk',
    type: 'Risk Control',
    description: 'Skip betting on Grade 1 races with odds-on favourites due to higher volatility.',
    formula: 'RaceGrade = G1 AND FavOdds < 2.0',
    action: 'Skip bet',
    notes: 'High volatility risk',
    evaluate: (runners, settings, market) => {
      const name = (market?.marketName || market?.event?.name || '').toLowerCase();
      const isGrade1 = name.includes('grade 1') || name.includes('g1') || name.includes('group 1');
      
      if (!isGrade1) return null;
      
      const sorted = runners
        .filter(r => r.prices?.availableToLay?.[0]?.price)
        .sort((a, b) => a.prices.availableToLay[0].price - b.prices.availableToLay[0].price);
      
      if (sorted.length > 0 && sorted[0].prices.availableToLay[0].price < 2.0) {
        return {
          matched: true,
          skip: true,
          analysis: `Grade 1 with odds-on fav (${sorted[0].prices.availableToLay[0].price.toFixed(2)}) → SKIP`
        };
      }
      return null;
    }
  },
  {
    id: 'R-004',
    name: 'Liquidity Gate',
    type: 'Liquidity Filter',
    description: 'Skip markets with insufficient liquidity to safely place the intended stake.',
    formula: 'Liquidity < Stake × 3',
    action: 'Skip bet',
    notes: 'Prevents slippage',
    evaluate: (runners, settings) => {
      const MULTIPLIER = 3;
      const minRequired = settings.minStake * MULTIPLIER;
      
      const hasLiquidity = runners.some(r => {
        const available = r.prices?.availableToLay?.[0]?.size || 0;
        return available >= minRequired;
      });
      
      if (!hasLiquidity) {
        return {
          matched: true,
          skip: true,
          analysis: `Insufficient liquidity (need £${minRequired.toFixed(2)}) → SKIP`
        };
      }
      return null;
    }
  }
];

function RuleBasedBetting() {
  const {
    isEnabled, isRunning, activeRules, settings, session,
    toggleEnabled, toggleRule, updateSettings, updateSession,
    startAutoBetting, stopAutoBetting, resetSession
  } = useRulesStore();
  
  const { catalogue, fetchMarketBook } = useMarketsStore();
  const { addBet } = useHistoryStore();
  const { addToast } = useToastStore();
  
  const [showSettings, setShowSettings] = useState(false);
  const [expandedRule, setExpandedRule] = useState(null);
  const [activity, setActivity] = useState([]);
  const intervalRef = useRef(null);

  // Main betting loop
  const runBettingCycle = useCallback(async () => {
    const { isRunning, activeRules, settings, session } = useRulesStore.getState();
    
    if (!isRunning || activeRules.length === 0) return;
    
    // Check limits
    if (session.racesProcessed >= settings.maxRaces) {
      addToast('Max races reached - stopping', 'info');
      stopAutoBetting();
      return;
    }
    if (session.totalStaked >= settings.totalLimit) {
      addToast('Budget limit reached - stopping', 'info');
      stopAutoBetting();
      return;
    }

    // Find markets to process
    const now = new Date();
    const eligibleMarkets = catalogue.filter(m => {
      const start = new Date(m.marketStartTime);
      const minsToStart = (start - now) / 60000;
      
      // Only pre-race if setting enabled
      if (settings.onlyPreRace && (minsToStart > 5 || minsToStart < 0)) return false;
      
      // Not already processed
      if (session.processedMarkets?.includes(m.marketId)) return false;
      
      return true;
    });

    if (eligibleMarkets.length === 0) {
      setActivity(prev => [...prev.slice(-9), {
        time: new Date().toLocaleTimeString(),
        text: 'No eligible markets found',
        type: 'info'
      }]);
      return;
    }

    // Process first eligible market
    const market = eligibleMarkets[0];
    
    try {
      // Get latest prices
      const books = await marketsAPI.getBook([market.marketId]);
      const book = books?.[0];
      
      if (!book) {
        updateSession({ 
          processedMarkets: [...(session.processedMarkets || []), market.marketId] 
        });
        return;
      }

      const runners = market.runners.map(r => {
        const bookRunner = book.runners?.find(br => br.selectionId === r.selectionId);
        return { ...r, prices: bookRunner?.ex };
      });

      // Evaluate rules in order
      for (const ruleId of activeRules) {
        const rule = BETTING_RULES.find(r => r.id === ruleId);
        if (!rule?.evaluate) continue;

        const result = rule.evaluate(runners, settings, market);
        
        if (result?.matched) {
          if (result.skip) {
            setActivity(prev => [...prev.slice(-9), {
              time: new Date().toLocaleTimeString(),
              text: `${market.event?.name || 'Market'}: ${result.analysis}`,
              type: 'skip'
            }]);
            break; // Skip rules stop further processing
          }

          // Place bets
          for (const selection of result.selections || []) {
            const stake = Math.min(
              Math.max(selection.stake, settings.minStake),
              settings.maxStake,
              settings.totalLimit - session.totalStaked
            );

            if (stake < settings.minStake) {
              addToast('Insufficient budget remaining', 'warning');
              stopAutoBetting();
              return;
            }

            const odds = selection.runner.prices.availableToLay[0].price;
            
            try {
              const betResult = await ordersAPI.placeLay(
                market.marketId,
                selection.runner.selectionId,
                odds,
                stake
              );

              // Record bet
              addBet({
                betId: betResult?.instructionReports?.[0]?.betId,
                marketId: market.marketId,
                marketName: market.event?.name || market.marketName,
                selectionId: selection.runner.selectionId,
                runnerName: selection.runner.runnerName,
                side: 'LAY',
                stake,
                odds,
                ruleId: rule.id,
              });

              updateSession({
                betsPlaced: session.betsPlaced + 1,
                totalStaked: session.totalStaked + stake,
              });

              setActivity(prev => [...prev.slice(-9), {
                time: new Date().toLocaleTimeString(),
                text: `BET: ${selection.runner.runnerName} @ ${odds} £${stake}`,
                type: 'bet'
              }]);

              addToast(`Bet placed: ${selection.runner.runnerName} @ ${odds}`, 'success');
              
            } catch (err) {
              setActivity(prev => [...prev.slice(-9), {
                time: new Date().toLocaleTimeString(),
                text: `FAILED: ${err.message}`,
                type: 'error'
              }]);
              addToast(`Bet failed: ${err.message}`, 'error');
            }
          }
          break; // Only one rule per market
        }
      }

      // Mark market as processed
      updateSession({
        racesProcessed: session.racesProcessed + 1,
        processedMarkets: [...(session.processedMarkets || []), market.marketId]
      });

    } catch (err) {
      console.error('Betting cycle error:', err);
      setActivity(prev => [...prev.slice(-9), {
        time: new Date().toLocaleTimeString(),
        text: `Error: ${err.message}`,
        type: 'error'
      }]);
    }
  }, [catalogue, addBet, addToast, stopAutoBetting, updateSession]);

  // Start/stop betting loop
  useEffect(() => {
    if (isRunning) {
      runBettingCycle(); // Run immediately
      intervalRef.current = setInterval(runBettingCycle, 15000); // Then every 15s
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, runBettingCycle]);

  const handleStart = () => {
    if (activeRules.length === 0) {
      addToast('Select at least one rule first', 'error');
      return;
    }
    resetSession();
    setActivity([]);
    startAutoBetting();
    addToast('🚀 Auto-betting STARTED', 'success');
  };

  const handleStop = () => {
    stopAutoBetting();
    addToast('Auto-betting stopped', 'info');
  };

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BotIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Auto Betting</h3>
          {activeRules.length > 0 && (
            <span className="bg-chimera-accent/20 text-chimera-accent text-xs px-2 py-0.5 rounded-full">
              {activeRules.length} rules
            </span>
          )}
        </div>
        
        <button
          onClick={() => toggleEnabled()}
          className={`w-12 h-6 rounded-full transition-colors ${
            isEnabled ? 'bg-chimera-green' : 'bg-chimera-border'
          }`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white transition-transform mt-1 ${
            isEnabled ? 'translate-x-7' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {isEnabled && (
        <>
          {/* START/STOP BUTTON */}
          <div className="mb-4">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="w-full py-4 rounded-lg font-bold text-lg bg-red-600 hover:bg-red-700 text-white transition-all flex items-center justify-center gap-3"
              >
                <StopIcon className="w-6 h-6" />
                STOP BETTING
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={activeRules.length === 0}
                className="w-full py-4 rounded-lg font-bold text-lg bg-chimera-green hover:bg-chimera-green/90 text-chimera-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <PlayIcon className="w-6 h-6" />
                START BETTING
              </button>
            )}
          </div>

          {/* Running Status */}
          {isRunning && (
            <div className="mb-4 p-3 rounded-lg bg-chimera-green/10 border border-chimera-green/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-chimera-green animate-pulse" />
                <span className="text-sm font-bold text-chimera-green">AUTO-BETTING ACTIVE</span>
              </div>
              <div className="text-xs text-chimera-muted">
                Checking markets every 15 seconds...
              </div>
            </div>
          )}

          {/* Activity Log */}
          {activity.length > 0 && (
            <div className="mb-4 p-2 bg-chimera-surface rounded-lg max-h-32 overflow-y-auto">
              <div className="text-xs space-y-1">
                {activity.map((a, i) => (
                  <div key={i} className={`flex gap-2 ${
                    a.type === 'bet' ? 'text-chimera-green' :
                    a.type === 'skip' ? 'text-yellow-400' :
                    a.type === 'error' ? 'text-red-400' :
                    'text-chimera-muted'
                  }`}>
                    <span className="opacity-60">{a.time}</span>
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Stats */}
          <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Bets Placed</div>
              <div className="text-lg font-mono text-white">{session.betsPlaced}</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Total Staked</div>
              <div className="text-lg font-mono text-white">£{session.totalStaked.toFixed(2)}</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Races Done</div>
              <div className="text-lg font-mono text-white">{session.racesProcessed}/{settings.maxRaces}</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Budget Left</div>
              <div className="text-lg font-mono text-white">
                £{Math.max(0, settings.totalLimit - session.totalStaked).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            disabled={isRunning}
            className="w-full flex items-center justify-between text-xs text-chimera-muted hover:text-white py-2 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <SettingsIcon className="w-3 h-3" />
              Settings {isRunning && '(locked while running)'}
            </span>
            <ChevronIcon className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>
          
          {showSettings && !isRunning && (
            <div className="mt-2 p-3 bg-chimera-surface rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-chimera-muted block mb-1">Max Races</label>
                  <input
                    type="number"
                    value={settings.maxRaces}
                    onChange={(e) => updateSettings({ maxRaces: parseInt(e.target.value) || 1 })}
                    min="1" max="50"
                    className="input-field text-sm py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-chimera-muted block mb-1">Session Limit (£)</label>
                  <input
                    type="number"
                    value={settings.totalLimit}
                    onChange={(e) => updateSettings({ totalLimit: parseFloat(e.target.value) || 1 })}
                    min="1"
                    className="input-field text-sm py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-chimera-muted block mb-1">Min Stake (£)</label>
                  <input
                    type="number"
                    value={settings.minStake}
                    onChange={(e) => updateSettings({ minStake: parseFloat(e.target.value) || 0.01 })}
                    min="0.01" step="0.01"
                    className="input-field text-sm py-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs text-chimera-muted block mb-1">Max Stake (£)</label>
                  <input
                    type="number"
                    value={settings.maxStake}
                    onChange={(e) => updateSettings({ maxStake: parseFloat(e.target.value) || 0.01 })}
                    min="0.01" step="0.01"
                    className="input-field text-sm py-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-chimera-muted block mb-1">Stop Loss (£)</label>
                <input
                  type="number"
                  value={settings.stopLoss}
                  onChange={(e) => updateSettings({ stopLoss: parseFloat(e.target.value) || 0 })}
                  min="0"
                  className="input-field text-sm py-1.5"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-chimera-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.onlyPreRace}
                  onChange={(e) => updateSettings({ onlyPreRace: e.target.checked })}
                  className="w-4 h-4"
                />
                Only bet within 5 mins of race start
              </label>
            </div>
          )}

          {/* Rules */}
          <div className="mt-4 pt-4 border-t border-chimera-border">
            <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2">
              Betting Rules
            </div>
            <div className="space-y-2">
              {BETTING_RULES.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isActive={activeRules.includes(rule.id)}
                  isExpanded={expandedRule === rule.id}
                  isLocked={isRunning}
                  onToggle={() => !isRunning && toggleRule(rule.id)}
                  onExpand={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {!isEnabled && (
        <div className="text-center py-4 text-chimera-muted text-sm">
          Enable auto-betting to configure rules
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, isActive, isExpanded, isLocked, onToggle, onExpand }) {
  const typeColors = {
    'Stake Allocation': 'bg-chimera-blue/20 text-chimera-blue',
    'Risk Control': 'bg-chimera-pink/20 text-chimera-pink',
    'Liquidity Filter': 'bg-chimera-accent/20 text-chimera-accent',
  };

  return (
    <div className={`bg-chimera-surface border rounded-lg overflow-hidden ${
      isActive ? 'border-chimera-green/50' : 'border-chimera-border'
    }`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${typeColors[rule.type] || ''}`}>
                {rule.type}
              </span>
            </div>
            <h4 className="text-sm text-white font-medium">{rule.name}</h4>
          </div>
          
          <button
            onClick={onToggle}
            disabled={isLocked}
            className={`w-10 h-5 rounded-full transition-colors ${
              isLocked ? 'opacity-50 cursor-not-allowed' : ''
            } ${isActive ? 'bg-chimera-green' : 'bg-chimera-border'}`}
          >
            <span className={`block w-3 h-3 rounded-full bg-white transition-transform mt-1 ${
              isActive ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        <p className="text-xs text-chimera-muted mt-1">{rule.description}</p>

        <button
          onClick={onExpand}
          className="text-xs text-chimera-accent mt-2 flex items-center gap-1"
        >
          {isExpanded ? 'Less' : 'Details'}
          <ChevronIcon className={`w-3 h-3 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-chimera-border p-3 bg-chimera-bg/50 text-xs space-y-1">
          <div><span className="text-chimera-muted">Formula:</span> <code className="text-chimera-accent">{rule.formula}</code></div>
          <div><span className="text-chimera-muted">Action:</span> <span className="text-chimera-green">{rule.action}</span></div>
          <div><span className="text-chimera-muted">Note:</span> <span className="text-yellow-400">{rule.notes}</span></div>
        </div>
      )}
    </div>
  );
}

// Icons
function BotIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function PlayIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default RuleBasedBetting;
