/**
 * PlayerDetailPanel
 * FanDuel-style player drill-down panel.
 *
 * Shows:
 *   - Player header: photo (MLB headshot), name, team, number, position
 *   - Season stats bar: Games, AVG/ERA, HR/W-L, RBI/SO, OPS/WHIP
 *   - Stat category switcher (Hits / HR / TB / RBI / SB for batters; K / HA / ER / Outs for pitchers)
 *   - Last-5 game bar chart with opponent abbrev and dates
 *   - O/U line with dashed reference line
 *   - Alt threshold buttons (1+, 2+, 3+ … 8+)
 *   - Same Game Parlay sub-tabs: Batting / Pitching / Specials
 */
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, TrendingUp } from 'lucide-react';

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

  return (
    <div className="mt-3">
      {/* Season stat + line label */}
      <div className="flex items-end justify-between mb-1">
        <div>
          <span className="text-2xl font-bold text-foreground font-mono">
            {data.reduce((s, d) => s + d.value, 0)}
          </span>
          <span className="text-xs text-muted-foreground ml-1">{label.toUpperCase()}</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span className="inline-block w-8 border-t border-dashed border-blue-400" />
          OVER / UNDER LINE
        </div>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 h-28 relative">
        {/* Dashed O/U line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-blue-400 pointer-events-none"
          style={{ bottom: `${(lineValue / maxVal) * 100}%` }}
        />

        {data.map((d, i) => {
          const heightPct = Math.max((d.value / maxVal) * 100, 4);
          const isOver = d.value > lineValue;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative flex flex-col items-center justify-end w-full" style={{ height: '100%' }}>
                {/* Value label */}
                <span className="absolute -top-4 text-xs font-bold text-white z-10">{d.value}</span>
                <div
                  className={`w-full rounded-t transition-all ${isOver ? 'bg-green-500' : 'bg-slate-500'}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              {/* Opponent */}
              <div className="text-center">
                <div className="text-xs text-muted-foreground truncate w-full">{d.opp}</div>
                <div className="text-xs text-muted-foreground/60">{d.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const BATTER_CATS = [
  { key: 'batter_hits', label: 'Hits' },
  { key: 'batter_home_runs', label: 'Home Runs' },
  { key: 'batter_total_bases', label: 'Total Bases' },
  { key: 'batter_rbis', label: 'RBIs' },
  { key: 'batter_stolen_bases', label: 'Stolen Bases' },
];

const PITCHER_CATS = [
  { key: 'pitcher_strikeouts', label: 'Strikeouts' },
  { key: 'pitcher_hits_allowed', label: 'Hits Allowed' },
  { key: 'pitcher_earned_runs', label: 'Earned Runs' },
  { key: 'pitcher_outs', label: 'Outs' },
];

const SGP_TABS = ['Batting', 'Pitching', 'Specials'] as const;

export default function PlayerDetailPanel({ player, propLines, onAddBet, onClose }: Props) {
  const cats = player.isPitcher ? PITCHER_CATS : BATTER_CATS;
  const [activeCat, setActiveCat] = useState(cats[0].key);
  const [sgpTab, setSgpTab] = useState<typeof SGP_TABS[number]>('Batting');
  const [selectedThreshold, setSelectedThreshold] = useState<number | null>(null);

  const activeProp = propLines.find(p => p.market === activeCat) ?? propLines[0] ?? null;
  const activeCatLabel = cats.find(c => c.key === activeCat)?.label ?? '';

  // Build last-5 data from player.last5 or generate placeholder
  const last5Data = player.last5 ?? Array.from({ length: 5 }, (_, i) => ({
    opp: '---',
    date: '',
    value: 0,
    hit: false,
  }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground flex-1">Player Props</span>
        <button onClick={onClose} className="text-primary text-sm font-medium">Close</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Player identity */}
        <div className="flex items-center gap-4 px-4 py-4 bg-card border-b border-border">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary flex-shrink-0 border-2 border-border">
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
            <div className="text-base font-bold text-foreground">{player.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground">{player.team}</span>
              {player.number && (
                <span className="text-xs text-muted-foreground">· #{player.number}</span>
              )}
              <span className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                {player.position}
              </span>
            </div>
            <button className="text-xs text-primary mt-1 flex items-center gap-0.5">
              Switch players <span className="text-xs">▾</span>
            </button>
          </div>
        </div>

        {/* Season stats bar */}
        <div className="bg-[#0f1e35] border-b border-border">
          <div className="text-center text-xs font-bold text-white py-2 tracking-widest">
            2026 SEASON STATS
          </div>
          <div className="grid grid-cols-5 divide-x divide-border/30 pb-3">
            {player.isPitcher ? (
              <>
                <StatCell label="GAMES" value={player.games ?? '--'} />
                <StatCell label="W-L" value={`${player.wins ?? 0}-${player.losses ?? 0}`} />
                <StatCell label="ERA" value={player.era ?? '--'} />
                <StatCell label="SO" value={player.strikeouts ?? '--'} />
                <StatCell label="WHIP" value={player.whip ?? '--'} />
              </>
            ) : (
              <>
                <StatCell label="GAMES" value={player.games ?? '--'} />
                <StatCell label="AVG" value={player.avg ?? '--'} />
                <StatCell label="HR" value={player.hr ?? '--'} />
                <StatCell label="RBI" value={player.rbi ?? '--'} />
                <StatCell label="OPS" value={player.ops ?? '--'} />
              </>
            )}
          </div>
        </div>

        {/* Stat category switcher */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border bg-card">
          {cats.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCat(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCat === c.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Chart + O/U section */}
        {activeProp && (
          <div className="px-4 pt-3 pb-4 bg-background border-b border-border">
            {/* O/U line label */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-primary">{activeCatLabel}</span>
            </div>

            {/* Last-5 bar chart */}
            <Last5Chart
              data={last5Data}
              lineValue={activeProp.point}
              label={activeCatLabel}
            />

            {/* O/U buttons */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">{activeCatLabel}</span>
                <span className="text-xs text-muted-foreground">{activeProp.point} line</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onAddBet({ market: activeProp.market, selection: `O ${activeProp.point}`, odds: activeProp.overOdds, player: player.name })}
                  className="p-3 rounded-lg border border-border bg-card hover:border-primary transition-colors text-center"
                >
                  <div className="text-xs text-muted-foreground mb-0.5">O {activeProp.point}</div>
                  <div className="text-sm font-bold text-primary">{formatOdds(activeProp.overOdds)}</div>
                </button>
                <button
                  onClick={() => onAddBet({ market: activeProp.market, selection: `U ${activeProp.point}`, odds: activeProp.underOdds, player: player.name })}
                  className="p-3 rounded-lg border border-border bg-card hover:border-primary transition-colors text-center"
                >
                  <div className="text-xs text-muted-foreground mb-0.5">U {activeProp.point}</div>
                  <div className="text-sm font-bold text-primary">{formatOdds(activeProp.underOdds)}</div>
                </button>
              </div>
            </div>

            {/* Alt threshold buttons */}
            {activeProp.altLines.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-foreground mb-2">Alt {activeCatLabel}</div>
                <div className="grid grid-cols-3 gap-2">
                  {activeProp.altLines.map(alt => (
                    <button
                      key={alt.threshold}
                      onClick={() => {
                        setSelectedThreshold(alt.threshold);
                        onAddBet({ market: activeProp.market, selection: `${alt.threshold}+`, odds: alt.odds, player: player.name });
                      }}
                      className={`p-2.5 rounded-lg border transition-colors text-center ${
                        selectedThreshold === alt.threshold
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-0.5">{alt.threshold}+</div>
                      <div className={`text-sm font-bold ${alt.odds > 0 ? 'text-primary' : 'text-foreground'}`}>
                        {formatOdds(alt.odds)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Same Game Parlay section */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-sm font-bold text-foreground">Same Game Parlay</span>
            <span className="text-xs bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold ml-1">SGP+</span>
          </div>

          {/* SGP sub-tabs */}
          <div className="flex gap-4 border-b border-border mb-3">
            {SGP_TABS.map(t => (
              <button
                key={t}
                onClick={() => setSgpTab(t)}
                className={`pb-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  sgpTab === t
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
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
              <div className="text-xs text-muted-foreground text-center py-4">
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

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center py-1">
      <div className="text-sm font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

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
      <div className="text-sm font-semibold text-foreground mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {prop.altLines.slice(0, 6).map(alt => (
          <button
            key={alt.threshold}
            onClick={() => onAddBet({ market: prop.market, selection: `${alt.threshold}+`, odds: alt.odds, player })}
            className="p-2.5 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors text-center"
          >
            <div className="text-xs text-muted-foreground mb-0.5">{alt.threshold}+</div>
            <div className={`text-sm font-bold ${alt.odds > 0 ? 'text-primary' : 'text-foreground'}`}>
              {formatOdds(alt.odds)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
