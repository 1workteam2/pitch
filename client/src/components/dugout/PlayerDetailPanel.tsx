/**
 * PlayerDetailPanel
 * FanDuel-style player drill-down panel.
 *
 * Shows:
 *   - Player header: photo (MLB headshot), name, team, number, position
 *   - Season stats bar: color-coded stat numbers (AVG=blue, HR=red, RBI=amber, OPS=emerald, ERA=orange, SO=violet, WHIP=cyan)
 *   - Radar/spider chart for season stats comparison
 *   - Stat category switcher (Hits / HR / TB / RBI / SB for batters; K / HA / ER / Outs for pitchers)
 *   - Last-5 game bar chart with opponent abbrev and dates, gradient bars
 *   - O/U line with dashed reference line
 *   - Alt threshold buttons (1+, 2+, 3+ … 8+)
 *   - Same Game Parlay sub-tabs: Batting / Pitching / Specials
 */
import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerInfo {
  playerId: number;
  name: string;
  team: string;
  teamAbbrev: string;
  number?: string;
  position: 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'OF' | 'DH' | string;
  isPitcher: boolean;
  // season stats
  games?: number;
  avg?: string;
  era?: string;
  hr?: number;
  wins?: number;
  losses?: number;
  rbi?: number;
  strikeouts?: number;
  ops?: string;
  whip?: string;
  // last 5 game log
  last5?: { opp: string; date: string; value: number; hit?: boolean }[];
}

export interface PropLine {
  market: string;
  label: string;
  point: number;
  overOdds: number;
  underOdds: number;
  altLines: { threshold: number; odds: number }[];
}

interface Props {
  player: PlayerInfo;
  propLines: PropLine[];
  onAddBet: (bet: { market: string; selection: string; odds: number; player: string }) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOdds(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function mlbHeadshotUrl(playerId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

// ─── Radar / Spider chart (pure SVG, no deps) ────────────────────────────────

interface RadarPoint { label: string; value: number; max: number; color: string }

function RadarChart({ points, size = 180 }: { points: RadarPoint[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = points.length;
  if (n < 3) return null;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  // Polygon points for each ring
  const ringPath = (scale: number) =>
    points
      .map((_, i) => {
        const a = angle(i);
        return `${cx + r * scale * Math.cos(a)},${cy + r * scale * Math.sin(a)}`;
      })
      .join(' ');

  // Data polygon
  const dataPath = points
    .map((p, i) => {
      const pct = Math.min(p.value / p.max, 1);
      const a = angle(i);
      return `${cx + r * pct * Math.cos(a)},${cy + r * pct * Math.sin(a)}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid rings */}
      {rings.map(s => (
        <polygon
          key={s}
          points={ringPath(s)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {/* Spokes */}
      {points.map((_, i) => {
        const a = angle(i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + r * Math.cos(a)}
            y2={cy + r * Math.sin(a)}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        );
      })}
      {/* Data fill */}
      <polygon
        points={dataPath}
        fill="rgba(99,102,241,0.25)"
        stroke="rgba(99,102,241,0.8)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Data dots */}
      {points.map((p, i) => {
        const pct = Math.min(p.value / p.max, 1);
        const a = angle(i);
        return (
          <circle
            key={i}
            cx={cx + r * pct * Math.cos(a)}
            cy={cy + r * pct * Math.sin(a)}
            r="3.5"
            fill={p.color}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth="1"
          />
        );
      })}
      {/* Labels */}
      {points.map((p, i) => {
        const a = angle(i);
        const lx = cx + (r + 18) * Math.cos(a);
        const ly = cy + (r + 18) * Math.sin(a);
        return (
          <text
            key={i}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="700"
            fill={p.color}
            fontFamily="IBM Plex Mono, monospace"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Season stats radar data builder ─────────────────────────────────────────

function buildRadarPoints(player: PlayerInfo): RadarPoint[] {
  if (player.isPitcher) {
    return [
      { label: 'ERA',  value: Math.max(0, 6 - parseFloat(player.era ?? '4.50')),  max: 6,   color: '#f97316' },
      { label: 'SO',   value: parseFloat(String(player.strikeouts ?? 0)),          max: 200, color: '#a78bfa' },
      { label: 'WHIP', value: Math.max(0, 2 - parseFloat(player.whip ?? '1.30')), max: 2,   color: '#22d3ee' },
      { label: 'W',    value: parseFloat(String(player.wins ?? 0)),                max: 20,  color: '#4ade80' },
      { label: 'G',    value: parseFloat(String(player.games ?? 0)),               max: 35,  color: '#94a3b8' },
    ];
  }
  return [
    { label: 'AVG', value: parseFloat(player.avg?.replace('.', '0.') ?? '0.250') * 1000, max: 350, color: '#60a5fa' },
    { label: 'HR',  value: parseFloat(String(player.hr ?? 0)),                            max: 50,  color: '#f87171' },
    { label: 'RBI', value: parseFloat(String(player.rbi ?? 0)),                           max: 120, color: '#fbbf24' },
    { label: 'OPS', value: parseFloat(player.ops?.replace('.', '0.') ?? '0.750') * 1000, max: 1100, color: '#34d399' },
    { label: 'G',   value: parseFloat(String(player.games ?? 0)),                         max: 162, color: '#94a3b8' },
  ];
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function Last5Chart({
  data,
  lineValue,
  label,
}: {
  data: { opp: string; date: string; value: number; hit?: boolean }[];
  lineValue: number;
  label: string;
}) {
  const maxVal = Math.max(...data.map(d => d.value), lineValue + 1, 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const avg = (total / data.length).toFixed(1);

  return (
    <div className="mt-3">
      {/* Header row */}
      <div className="flex items-end justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-white font-mono">{total}</span>
          <span className="text-xs text-slate-400 font-semibold">{label.toUpperCase()} LAST 5</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-indigo-400 font-mono">{avg}/G</div>
          <div className="text-xs text-slate-500">AVG</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Over line
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-600" /> Under line
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="inline-block w-6 border-t-2 border-dashed border-blue-400" />
          {lineValue} line
        </span>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 relative" style={{ height: '120px' }}>
        {/* Dashed O/U line */}
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-blue-400/70 pointer-events-none z-10"
          style={{ bottom: `${(lineValue / maxVal) * 100}%` }}
        />

        {data.map((d, i) => {
          const heightPct = Math.max((d.value / maxVal) * 100, 5);
          const isOver = d.value > lineValue;
          const isExact = d.value === lineValue;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="relative flex flex-col items-center justify-end w-full h-full">
                {/* Value label above bar */}
                <span
                  className={`absolute z-20 text-xs font-black ${
                    isOver ? 'text-emerald-400' : isExact ? 'text-blue-400' : 'text-slate-400'
                  }`}
                  style={{ bottom: `${heightPct}%`, marginBottom: '2px' }}
                >
                  {d.value}
                </span>
                {/* Bar with gradient */}
                <div
                  className="w-full rounded-t-md transition-all duration-300 relative overflow-hidden"
                  style={{
                    height: `${heightPct}%`,
                    background: isOver
                      ? 'linear-gradient(to top, #059669, #34d399)'
                      : isExact
                      ? 'linear-gradient(to top, #1d4ed8, #60a5fa)'
                      : 'linear-gradient(to top, #374151, #6b7280)',
                    boxShadow: isOver ? '0 0 8px rgba(52,211,153,0.4)' : 'none',
                  }}
                >
                  {/* Shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
              </div>
              {/* Opponent + date */}
              <div className="text-center shrink-0">
                <div className="text-xs font-bold text-slate-300">{d.opp}</div>
                <div className="text-xs text-slate-600">{d.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat category constants ──────────────────────────────────────────────────

const BATTER_CATS = [
  { key: 'batter_hits',         label: 'Hits' },
  { key: 'batter_home_runs',    label: 'Home Runs' },
  { key: 'batter_total_bases',  label: 'Total Bases' },
  { key: 'batter_rbis',         label: 'RBIs' },
  { key: 'batter_stolen_bases', label: 'Stolen Bases' },
];

const PITCHER_CATS = [
  { key: 'pitcher_strikeouts',   label: 'Strikeouts' },
  { key: 'pitcher_hits_allowed', label: 'Hits Allowed' },
  { key: 'pitcher_earned_runs',  label: 'Earned Runs' },
  { key: 'pitcher_outs',         label: 'Outs' },
];

const SGP_TABS = ['Batting', 'Pitching', 'Specials'] as const;

// ─── Colored StatCell ─────────────────────────────────────────────────────────

interface StatCellConfig {
  label: string;
  value: string | number;
  color: string;        // Tailwind text color class
  glow?: string;        // optional glow shadow style
}

function ColorStatCell({ label, value, color, glow }: StatCellConfig) {
  return (
    <div className="text-center py-2 px-1">
      <div
        className={`text-base font-black font-mono ${color}`}
        style={glow ? { textShadow: glow } : undefined}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-0.5 font-semibold tracking-wide">{label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlayerDetailPanel({ player, propLines, onAddBet, onClose }: Props) {
  const cats = player.isPitcher ? PITCHER_CATS : BATTER_CATS;
  const [activeCat, setActiveCat] = useState(cats[0].key);
  const [sgpTab, setSgpTab] = useState<typeof SGP_TABS[number]>('Batting');
  const [selectedThreshold, setSelectedThreshold] = useState<number | null>(null);
  const [showRadar, setShowRadar] = useState(true);

  const activeProp = propLines.find(p => p.market === activeCat) ?? propLines[0] ?? null;
  const activeCatLabel = cats.find(c => c.key === activeCat)?.label ?? '';

  const last5Data = player.last5 ?? Array.from({ length: 5 }, (_, i) => ({
    opp: '---',
    date: '',
    value: 0,
    hit: false,
  }));

  const radarPoints = buildRadarPoints(player);

  // Build colored stat cells
  const batterStatCells: StatCellConfig[] = [
    { label: 'G',    value: player.games ?? '--',  color: 'text-slate-300',  glow: undefined },
    { label: 'AVG',  value: player.avg ?? '--',    color: 'text-blue-400',   glow: '0 0 8px rgba(96,165,250,0.5)' },
    { label: 'HR',   value: player.hr ?? '--',     color: 'text-red-400',    glow: '0 0 8px rgba(248,113,113,0.5)' },
    { label: 'RBI',  value: player.rbi ?? '--',    color: 'text-amber-400',  glow: '0 0 8px rgba(251,191,36,0.5)' },
    { label: 'OPS',  value: player.ops ?? '--',    color: 'text-emerald-400',glow: '0 0 8px rgba(52,211,153,0.5)' },
  ];

  const pitcherStatCells: StatCellConfig[] = [
    { label: 'G',    value: player.games ?? '--',                                   color: 'text-slate-300',  glow: undefined },
    { label: 'W-L',  value: `${player.wins ?? 0}-${player.losses ?? 0}`,           color: 'text-green-400',  glow: '0 0 8px rgba(74,222,128,0.5)' },
    { label: 'ERA',  value: player.era ?? '--',                                     color: 'text-orange-400', glow: '0 0 8px rgba(251,146,60,0.5)' },
    { label: 'SO',   value: player.strikeouts ?? '--',                              color: 'text-violet-400', glow: '0 0 8px rgba(167,139,250,0.5)' },
    { label: 'WHIP', value: player.whip ?? '--',                                    color: 'text-cyan-400',   glow: '0 0 8px rgba(34,211,238,0.5)' },
  ];

  const statCells = player.isPitcher ? pitcherStatCells : batterStatCells;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#0a1628' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0f1e35]">
        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <span className="text-sm font-semibold text-white flex-1">Player Props</span>
        <button onClick={onClose} className="text-indigo-400 text-sm font-medium hover:text-indigo-300">Done</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Player identity */}
        <div className="flex items-center gap-4 px-4 py-4 bg-[#0f1e35] border-b border-white/10">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border-2 border-indigo-500/40">
            <img
              src={mlbHeadshotUrl(player.playerId)}
              alt={player.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=1e3a5f&color=fff&size=64`;
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-white">{player.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-slate-400">{player.team}</span>
              {player.number && (
                <span className="text-xs text-slate-500">· #{player.number}</span>
              )}
              <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-300">
                {player.position}
              </span>
            </div>
          </div>
        </div>

        {/* ── Season Stats Section ── */}
        <div className="bg-[#0d1b2e] border-b border-white/10">
          {/* Section header with toggle */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-xs font-black text-slate-400 tracking-widest">2026 SEASON STATS</span>
            <button
              onClick={() => setShowRadar(v => !v)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              {showRadar ? 'Hide chart' : 'Show chart'}
            </button>
          </div>

          {/* Colored stat numbers */}
          <div className="grid grid-cols-5 divide-x divide-white/5 px-1">
            {statCells.map(sc => (
              <ColorStatCell key={sc.label} {...sc} />
            ))}
          </div>

          {/* Radar chart */}
          {showRadar && (
            <div className="flex flex-col items-center pb-4 pt-2">
              <RadarChart points={radarPoints} size={200} />
              {/* Legend row */}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 px-4">
                {radarPoints.map(p => (
                  <span key={p.label} className="flex items-center gap-1 text-xs font-bold" style={{ color: p.color }}>
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stat category switcher */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-white/10 bg-[#0f1e35]">
          {cats.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCat === c.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/15'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Chart + O/U section */}
        {activeProp && (
          <div className="px-4 pt-4 pb-4 border-b border-white/10" style={{ background: '#0a1628' }}>
            {/* Last-5 bar chart */}
            <Last5Chart
              data={last5Data}
              lineValue={activeProp.point}
              label={activeCatLabel}
            />

            {/* O/U buttons */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{activeCatLabel}</span>
                <span className="text-xs text-slate-500 font-mono">{activeProp.point} line</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onAddBet({ market: activeProp.market, selection: `O ${activeProp.point}`, odds: activeProp.overOdds, player: player.name })}
                  className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-center group"
                >
                  <div className="text-xs text-emerald-400/70 mb-0.5 font-semibold">OVER {activeProp.point}</div>
                  <div className="text-lg font-black text-emerald-400 group-hover:text-emerald-300">
                    {formatOdds(activeProp.overOdds)}
                  </div>
                </button>
                <button
                  onClick={() => onAddBet({ market: activeProp.market, selection: `U ${activeProp.point}`, odds: activeProp.underOdds, player: player.name })}
                  className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors text-center group"
                >
                  <div className="text-xs text-red-400/70 mb-0.5 font-semibold">UNDER {activeProp.point}</div>
                  <div className="text-lg font-black text-red-400 group-hover:text-red-300">
                    {formatOdds(activeProp.underOdds)}
                  </div>
                </button>
              </div>
            </div>

            {/* Alt threshold buttons */}
            {activeProp.altLines.length > 0 && (
              <div className="mt-5">
                <div className="text-sm font-bold text-white mb-2">Alt {activeCatLabel}</div>
                <div className="grid grid-cols-3 gap-2">
                  {activeProp.altLines.map(alt => {
                    const isSelected = selectedThreshold === alt.threshold;
                    const isPositive = alt.odds > 0;
                    return (
                      <button
                        key={alt.threshold}
                        onClick={() => {
                          setSelectedThreshold(alt.threshold);
                          onAddBet({ market: activeProp.market, selection: `${alt.threshold}+`, odds: alt.odds, player: player.name });
                        }}
                        className={`p-2.5 rounded-xl border transition-all text-center ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-600/30 shadow-md shadow-indigo-500/20'
                            : 'border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs text-slate-400 mb-0.5 font-semibold">{alt.threshold}+</div>
                        <div className={`text-sm font-black ${isPositive ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {formatOdds(alt.odds)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Same Game Parlay section */}
        <div className="px-4 pt-4 pb-8" style={{ background: '#0a1628' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-white">Same Game Parlay</span>
            <span className="text-xs bg-amber-500 text-black px-1.5 py-0.5 rounded font-black">SGP+</span>
          </div>

          {/* SGP sub-tabs */}
          <div className="flex gap-4 border-b border-white/10 mb-4">
            {SGP_TABS.map(t => (
              <button
                key={t}
                onClick={() => setSgpTab(t)}
                className={`pb-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
                  sgpTab === t
                    ? 'text-indigo-400 border-indigo-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* SGP content */}
          <div className="space-y-3">
            {sgpTab === 'Batting' && (
              <SgpPropGroup
                title="Player Hits"
                props={propLines.filter(p => p.market === 'batter_hits')}
                onAddBet={onAddBet}
                player={player.name}
              />
            )}
            {sgpTab === 'Pitching' && (
              <SgpPropGroup
                title="Pitcher Strikeouts"
                props={propLines.filter(p => p.market === 'pitcher_strikeouts')}
                onAddBet={onAddBet}
                player={player.name}
              />
            )}
            {sgpTab === 'Specials' && (
              <div className="text-xs text-slate-500 text-center py-6 italic">
                Specials and boosts not available via API — check FanDuel directly.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SgpPropGroup({
  title,
  props,
  onAddBet,
  player,
}: {
  title: string;
  props: PropLine[];
  onAddBet: Props['onAddBet'];
  player: string;
}) {
  if (props.length === 0) return null;
  const prop = props[0];
  return (
    <div>
      <div className="text-sm font-bold text-white mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {prop.altLines.slice(0, 6).map(alt => (
          <button
            key={alt.threshold}
            onClick={() => onAddBet({ market: prop.market, selection: `${alt.threshold}+`, odds: alt.odds, player })}
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-all text-center"
          >
            <div className="text-xs text-slate-400 mb-0.5 font-semibold">{alt.threshold}+</div>
            <div className={`text-sm font-black ${alt.odds > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {formatOdds(alt.odds)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
