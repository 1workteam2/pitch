/**
 * ParlaysTab
 * Full parlay builder — reads legs from the global BetSlipContext.
 *
 * Features:
 *   - Live leg list (added from Hits/HR/Ks/Bases/Books tabs)
 *   - Remove individual legs
 *   - Combined parlay odds (American)
 *   - Implied probability ring
 *   - Stake selector ($5 / $10 / $25 / $50 / $100 / custom)
 *   - Payout calculator
 *   - FanDuel deep-link button
 *   - Empty state with instructions
 */
import { useState } from 'react';
import { X, Trash2, TrendingUp, DollarSign, ExternalLink, PlusCircle } from 'lucide-react';
import { useBetSlip } from '@/contexts/BetSlipContext';
import type { BetLeg } from '@/contexts/BetSlipContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtOdds(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

const MARKET_LABELS: Record<string, string> = {
  batter_hits:          'Hits',
  batter_home_runs:     'Home Runs',
  batter_total_bases:   'Total Bases',
  batter_rbis:          'RBIs',
  batter_stolen_bases:  'Stolen Bases',
  pitcher_strikeouts:   'Strikeouts',
  pitcher_hits_allowed: 'Hits Allowed',
  pitcher_earned_runs:  'Earned Runs',
  pitcher_outs:         'Outs',
  h2h:                  'Moneyline',
  spreads:              'Run Line',
  totals:               'Total Runs',
  hits:                 'Hits',
  hr:                   'Home Runs',
  total_bases:          'Total Bases',
  ks:                   'Strikeouts',
  yrfi:                 'YRFI',
  first_five:           'First Five',
};

function marketLabel(key: string): string {
  return MARKET_LABELS[key] ?? key;
}

// ── Implied probability arc (SVG) ────────────────────────────────────────────

function ProbabilityRing({ prob, odds }: { prob: number; odds: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(prob, 1);
  const isPositive = odds > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
        />
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={isPositive ? '#34d399' : '#60a5fa'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="white" fontFamily="monospace">
          {fmtOdds(odds)}
        </text>
        <text x="55" y="66" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="monospace">
          {fmtPct(prob)} imp.
        </text>
      </svg>
      <div className="text-xs text-slate-400 font-semibold">COMBINED ODDS</div>
    </div>
  );
}

// ── Leg card ──────────────────────────────────────────────────────────────────

function LegCard({ leg, onRemove }: { leg: BetLeg; onRemove: () => void }) {
  const isPositive = leg.odds > 0;
  return (
    <div className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10 group">
      <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${isPositive ? 'bg-emerald-400' : 'bg-blue-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{leg.player}</div>
        <div className="text-xs text-slate-400 mt-0.5">
          <span className="text-indigo-400 font-semibold">{marketLabel(leg.market)}</span>
          {' · '}
          <span className="text-white/70">{leg.selection}</span>
        </div>
        {leg.game && (
          <div className="text-xs text-slate-600 mt-0.5 truncate">{leg.game}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-slate-300'}`}>
          {fmtOdds(leg.odds)}
        </span>
        <button
          onClick={onRemove}
          className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
          aria-label="Remove leg"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Stake selector ────────────────────────────────────────────────────────────

const PRESET_STAKES = [5, 10, 25, 50, 100];

function StakeSelector({ stake, onChange }: { stake: number; onChange: (v: number) => void }) {
  const [custom, setCustom] = useState('');

  return (
    <div>
      <div className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
        <DollarSign size={12} /> STAKE
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESET_STAKES.map(s => (
          <button
            key={s}
            onClick={() => { onChange(s); setCustom(''); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
              stake === s && !custom
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-white/8 text-slate-300 hover:bg-white/15'
            }`}
          >
            ${s}
          </button>
        ))}
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number"
            min="1"
            placeholder="Custom"
            value={custom}
            onChange={e => {
              setCustom(e.target.value);
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) onChange(v);
            }}
            className="w-24 pl-6 pr-2 py-1.5 rounded-lg bg-white/8 border border-white/15 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:bg-white/12 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center mb-4">
        <PlusCircle size={28} className="text-indigo-400" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No legs yet</h3>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        Add picks from the{' '}
        <span className="text-indigo-400 font-semibold">Hits</span>,{' '}
        <span className="text-red-400 font-semibold">HR</span>,{' '}
        <span className="text-violet-400 font-semibold">Ks</span>,{' '}
        <span className="text-amber-400 font-semibold">Bases</span>, or{' '}
        <span className="text-emerald-400 font-semibold">Books</span> tabs — they'll appear here automatically.
      </p>
      <div className="space-y-2.5 w-full max-w-xs text-left">
        {[
          { icon: 'H',  color: 'bg-blue-500',    text: 'Tap any odds button in Hits' },
          { icon: '💣', color: 'bg-red-500',      text: 'Tap any odds button in HR' },
          { icon: 'K',  color: 'bg-violet-500',   text: 'Tap any odds button in Ks' },
          { icon: '≡',  color: 'bg-emerald-500',  text: 'Tap any line in Books' },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-3 text-sm text-slate-400">
            <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
              {item.icon}
            </div>
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ParlaysTab() {
  const { legs, removeLeg, clearLegs, combinedOdds, impliedProbability, payoutFor } = useBetSlip();
  const [stake, setStake] = useState(10);

  const payout = payoutFor(stake);
  const totalReturn = stake + payout;
  const legCount = legs.length;

  return (
    <div className="min-h-screen pb-10" style={{ background: '#0a1628' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 px-4 py-3 border-b border-white/10 backdrop-blur-sm flex items-center justify-between"
        style={{ background: 'rgba(10,22,40,0.95)' }}
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400" />
          <span className="text-sm font-bold text-white">Parlay Builder</span>
          {legCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-600 text-xs font-black text-white">
              {legCount}
            </span>
          )}
        </div>
        {legCount > 0 && (
          <button
            onClick={clearLegs}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} /> Clear all
          </button>
        )}
      </div>

      {legCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">

          {/* Combined odds ring */}
          <div className="flex justify-center py-2">
            <ProbabilityRing prob={impliedProbability} odds={combinedOdds} />
          </div>

          {/* Parlay summary card */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-600/10 px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 font-semibold tracking-wide">
                {legCount}-LEG PARLAY
              </span>
              <span
                className={`text-xl font-black font-mono ${combinedOdds > 0 ? 'text-emerald-400' : 'text-slate-200'}`}
                style={combinedOdds > 0 ? { textShadow: '0 0 12px rgba(52,211,153,0.5)' } : undefined}
              >
                {fmtOdds(combinedOdds)}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Implied probability:{' '}
              <span className="text-slate-300 font-semibold">{fmtPct(impliedProbability)}</span>
            </div>
          </div>

          {/* Leg list */}
          <div className="space-y-2">
            <div className="text-xs text-slate-500 font-semibold px-1 tracking-wide">LEGS</div>
            {legs.map(leg => (
              <LegCard key={leg.id} leg={leg} onRemove={() => removeLeg(leg.id)} />
            ))}
          </div>

          {/* Stake selector */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <StakeSelector stake={stake} onChange={setStake} />
          </div>

          {/* Payout summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 space-y-3">
            <div className="text-xs text-slate-400 font-semibold tracking-wide">PAYOUT ESTIMATE</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-slate-500 mb-1">STAKE</div>
                <div className="text-base font-black text-white font-mono">${stake.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">PROFIT</div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  +${payout.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">TOTAL RETURN</div>
                <div className="text-base font-black text-white font-mono">${totalReturn.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* FanDuel CTA */}
          <a
            href="https://sportsbook.fanduel.com/baseball/mlb"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-base text-white transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #1493ff 0%, #0d7de0 100%)',
              boxShadow: '0 4px 20px rgba(20,147,255,0.35)',
            }}
          >
            <ExternalLink size={18} />
            Place {legCount}-Leg Parlay on FanDuel
          </a>

          {/* Disclaimer */}
          <p className="text-xs text-slate-600 text-center leading-relaxed px-2">
            Odds shown are for reference only. Actual odds may differ on FanDuel. Must be 21+ and in a legal state to bet.
          </p>
        </div>
      )}
    </div>
  );
}
