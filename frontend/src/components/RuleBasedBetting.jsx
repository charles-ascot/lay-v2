/**
 * Rule Based Betting Panel
 * Allows users to activate automatic betting rules
 */

import { useState } from 'react';
import { useRulesStore, useToastStore } from '../store';

// Mark's betting rules
const BETTING_RULES = [
  {
    id: 'R-001',
    name: 'Dual Favourite Coverage',
    type: 'Stake Allocation',
    description: 'When the favourite is priced above 5.0 and the price gap between the favourite and second favourite is small, both runners are backed to manage unclear market leadership.',
    filters: 'Races where top two runners are closely matched despite long odds',
    formula: 'IF FavOdds > 5.0 AND ABS(FavOdds - SecondFavOdds) < 2.0',
    action: 'Back £1 Favourite AND £1 Second Favourite',
    trigger: 'Favourite odds above 5.0 AND odds gap less than 2.0',
    source: 'Mark',
    notes: 'Hedge rule for unclear dominance'
  },
  {
    id: 'R-002',
    name: 'Strong Favourite Focus',
    type: 'Stake Allocation',
    description: 'When the favourite is priced above 5.0 and clearly separated from the second favourite, only the favourite is backed.',
    filters: 'Races with a clear single market leader',
    formula: 'IF FavOdds > 5.0 AND ABS(FavOdds - SecondFavOdds) >= 2.0',
    action: 'Back £1 Favourite only',
    trigger: 'Favourite odds above 5.0 AND odds gap 2.0 or more',
    source: 'Mark',
    notes: 'Assumes market confidence is concentrated'
  },
  {
    id: 'R-003',
    name: 'Grade 1 Odds-On Risk Reduction',
    type: 'Risk Control',
    description: 'In Irish Grade 1 races with odds-on favourites, stakes are reduced or bets avoided due to higher volatility.',
    filters: 'Elite races with compressed pricing',
    formula: 'IF RaceGrade = G1 AND FavOdds < 2.0 THEN ReduceStake OR NoBet',
    action: 'Reduce stake or skip bet',
    trigger: 'Grade 1 race AND favourite odds-on',
    source: 'Mark',
    notes: 'Exact reduction logic still undefined'
  },
  {
    id: 'R-004',
    name: 'Liquidity Validation Gate',
    type: 'Liquidity Filter',
    description: 'Prevents bets when market liquidity is too low to safely absorb the intended stake.',
    filters: 'Illiquid or thin exchange markets',
    formula: 'IF AvailableLiquidity < Stake * SafetyMultiplier THEN BlockBet',
    action: 'No bet placed',
    trigger: 'Insufficient matched money at target odds',
    source: 'Mark',
    notes: 'Liquidity thresholds to be set per market'
  }
];

function RuleBasedBetting() {
  const {
    isEnabled,
    activeRules,
    settings,
    toggleEnabled,
    toggleRule,
    updateSettings
  } = useRulesStore();
  
  const { addToast } = useToastStore();
  const [expandedRule, setExpandedRule] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleToggleEnabled = () => {
    toggleEnabled();
    if (!isEnabled) {
      addToast('Rule-based betting activated', 'success');
    } else {
      addToast('Rule-based betting deactivated', 'info');
    }
  };

  const handleToggleRule = (ruleId) => {
    toggleRule(ruleId);
    const rule = BETTING_RULES.find(r => r.id === ruleId);
    if (activeRules.includes(ruleId)) {
      addToast(`Rule "${rule.name}" deactivated`, 'info');
    } else {
      addToast(`Rule "${rule.name}" activated`, 'success');
    }
  };

  const activeCount = activeRules.length;

  return (
    <div className="glass-card p-4">
      {/* Header with Master Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RulesIcon className="w-4 h-4 text-chimera-accent" />
          <h3 className="text-sm font-semibold text-white">Rule-Based Betting</h3>
          {activeCount > 0 && isEnabled && (
            <span className="bg-chimera-green/20 text-chimera-green text-xs px-2 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        
        {/* Master Toggle Switch */}
        <button
          onClick={handleToggleEnabled}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            isEnabled ? 'bg-chimera-green' : 'bg-chimera-border'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              isEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Status Indicator */}
      <div className={`mb-4 p-2 rounded-lg text-xs ${
        isEnabled 
          ? 'bg-chimera-green/10 border border-chimera-green/30 text-chimera-green' 
          : 'bg-chimera-surface border border-chimera-border text-chimera-muted'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-chimera-green animate-pulse' : 'bg-chimera-muted'}`} />
          {isEnabled ? 'Auto-betting is ACTIVE' : 'Auto-betting is OFF'}
        </div>
      </div>

      {/* Settings Panel */}
      <div className="mb-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-between w-full text-xs text-chimera-muted hover:text-white transition-colors py-2"
        >
          <span className="flex items-center gap-2">
            <SettingsIcon className="w-3 h-3" />
            Betting Limits & Settings
          </span>
          <ChevronIcon className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
        </button>
        
        {showSettings && (
          <div className="mt-2 p-3 bg-chimera-surface rounded-lg border border-chimera-border space-y-3">
            {/* Max Races */}
            <div>
              <label className="text-xs text-chimera-muted block mb-1">
                Max Races to Bet On
              </label>
              <input
                type="number"
                value={settings.maxRaces}
                onChange={(e) => updateSettings({ maxRaces: parseInt(e.target.value) || 0 })}
                min="1"
                max="50"
                className="input-field text-sm py-1.5"
              />
            </div>

            {/* Min Stake */}
            <div>
              <label className="text-xs text-chimera-muted block mb-1">
                Minimum Stake (£)
              </label>
              <input
                type="number"
                value={settings.minStake}
                onChange={(e) => updateSettings({ minStake: parseFloat(e.target.value) || 0 })}
                min="0.01"
                step="0.01"
                className="input-field text-sm py-1.5"
              />
            </div>

            {/* Max Stake */}
            <div>
              <label className="text-xs text-chimera-muted block mb-1">
                Maximum Stake per Bet (£)
              </label>
              <input
                type="number"
                value={settings.maxStake}
                onChange={(e) => updateSettings({ maxStake: parseFloat(e.target.value) || 0 })}
                min="0.01"
                step="0.01"
                className="input-field text-sm py-1.5"
              />
            </div>

            {/* Total Limit */}
            <div>
              <label className="text-xs text-chimera-muted block mb-1">
                Total Session Limit (£)
              </label>
              <input
                type="number"
                value={settings.totalLimit}
                onChange={(e) => updateSettings({ totalLimit: parseFloat(e.target.value) || 0 })}
                min="1"
                step="1"
                className="input-field text-sm py-1.5"
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label className="text-xs text-chimera-muted block mb-1">
                Stop Loss Trigger (£)
              </label>
              <input
                type="number"
                value={settings.stopLoss}
                onChange={(e) => updateSettings({ stopLoss: parseFloat(e.target.value) || 0 })}
                min="0"
                step="1"
                className="input-field text-sm py-1.5"
              />
              <p className="text-xs text-chimera-muted mt-1">Auto-stop if losses exceed this amount</p>
            </div>

            {/* Time Restriction */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="timeRestrict"
                checked={settings.onlyPreRace}
                onChange={(e) => updateSettings({ onlyPreRace: e.target.checked })}
                className="w-4 h-4 rounded border-chimera-border bg-chimera-surface"
              />
              <label htmlFor="timeRestrict" className="text-xs text-chimera-muted">
                Only bet within 5 minutes of race start
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2">
          Available Rules
        </div>
        
        {BETTING_RULES.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            isActive={activeRules.includes(rule.id)}
            isExpanded={expandedRule === rule.id}
            isEnabled={isEnabled}
            onToggle={() => handleToggleRule(rule.id)}
            onExpand={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
          />
        ))}
      </div>

      {/* Session Stats (when enabled) */}
      {isEnabled && (
        <div className="mt-4 pt-4 border-t border-chimera-border">
          <div className="text-xs text-chimera-muted uppercase tracking-wider mb-2">
            Session Stats
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Bets Placed</div>
              <div className="text-white font-mono">0</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Total Staked</div>
              <div className="text-white font-mono">£0.00</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Races Remaining</div>
              <div className="text-white font-mono">{settings.maxRaces}</div>
            </div>
            <div className="bg-chimera-surface rounded p-2">
              <div className="text-chimera-muted">Budget Left</div>
              <div className="text-white font-mono">£{settings.totalLimit.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, isActive, isExpanded, isEnabled, onToggle, onExpand }) {
  const typeColors = {
    'Stake Allocation': 'text-chimera-blue bg-chimera-blue/10',
    'Risk Control': 'text-chimera-pink bg-chimera-pink/10',
    'Liquidity Filter': 'text-chimera-accent bg-chimera-accent/10'
  };

  return (
    <div className={`bg-chimera-surface border rounded-lg overflow-hidden transition-colors ${
      isActive && isEnabled ? 'border-chimera-green/50' : 'border-chimera-border'
    }`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${typeColors[rule.type] || 'text-chimera-muted bg-chimera-border'}`}>
                {rule.type}
              </span>
              <span className="text-xs text-chimera-muted font-mono">{rule.id}</span>
            </div>
            <h4 className="text-sm text-white font-medium truncate">{rule.name}</h4>
          </div>
          
          {/* Rule Toggle */}
          <button
            onClick={onToggle}
            disabled={!isEnabled}
            className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
              !isEnabled ? 'bg-chimera-border opacity-50 cursor-not-allowed' :
              isActive ? 'bg-chimera-green' : 'bg-chimera-border'
            }`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-white transition-transform mt-1 ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-chimera-muted mt-2 line-clamp-2">{rule.description}</p>

        <button
          onClick={onExpand}
          className="text-xs text-chimera-accent hover:text-chimera-accent/80 mt-2 flex items-center gap-1"
        >
          {isExpanded ? 'Less details' : 'More details'}
          <ChevronIcon className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-chimera-border p-3 bg-chimera-bg/50 space-y-2 text-xs">
          <div>
            <span className="text-chimera-muted">Filters:</span>
            <span className="text-white ml-1">{rule.filters}</span>
          </div>
          <div>
            <span className="text-chimera-muted">Formula:</span>
            <code className="text-chimera-accent ml-1 font-mono text-xs">{rule.formula}</code>
          </div>
          <div>
            <span className="text-chimera-muted">Action:</span>
            <span className="text-chimera-green ml-1">{rule.action}</span>
          </div>
          <div>
            <span className="text-chimera-muted">Trigger:</span>
            <span className="text-white ml-1">{rule.trigger}</span>
          </div>
          {rule.notes && (
            <div className="pt-2 border-t border-chimera-border">
              <span className="text-chimera-muted">Note:</span>
              <span className="text-yellow-400 ml-1">{rule.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Icons
function RulesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
