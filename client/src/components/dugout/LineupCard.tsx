/**
 * LineupCard
 * Displays a single game's confirmed lineup with:
 *   - Away vs Home header with game time
 *   - Probable pitchers (ERA, WHIP, K/9, W-L)
 *   - Batting order (position, name, AVG, HR, RBI, OBP)
 *   - Weather badge (temp, wind, conditions, bet impact)
 */

import { useState } from 'react';
import type { GameLineup } from '../../../../server/scrapers/lineups';
import type { BallparkWeather } from '../../../../server/scrapers/weather';
import { usePitcherSplits } from '@/hooks/useScraperData';

interface LineupCardProps {
  game: GameLineup;
  weather?: BallparkWeather;
}

function WeatherBadge({ weather }: { weather?: BallparkWeather }) {
  if (!weather) return null;

  const impactColor = {
    favorable: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    neutral: 'text-slate-400 border-slate-400/30 bg-slate-400/10',
    unfavorable: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  }[weather.betImpact];

  if (weather.isIndoor) {
    return (
      <span className="text-xs px-2 py-0.5 rounded border border-slate-600 text-slate-400 bg-slate-800">
        🏟 Indoor
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${impactColor}`}>
      <span>{weather.tempF !== null ? `${weather.tempF}°F` : '--'}</span>
      {weather.windSpeedMph !== null && (
        <span>{weather.windDirection} {weather.windSpeedMph}mph</span>
      )}
      {weather.precipPct !== null && weather.precipPct > 0 && (
        <span>💧{weather.precipPct}%</span>
      )}
      <span className="opacity-70">{weather.conditions}</span>
    </div>
  );
}

function PitcherRow({ pitcher, side }: {
  pitcher: GameLineup['homeProbablePitcher'];
  side: 'home' | 'away';
}) {
  const { splits, isLoading } = usePitcherSplits(pitcher?.playerId ?? null, '???');

  if (!pitcher) {
    return (
      <div className="text-xs text-muted-foreground italic py-1">
        {side === 'home' ? 'Home' : 'Away'} pitcher TBD
      </div>
    );
  }

  const stats = splits?.season ?? null;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50">
      <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
        {pitcher.throws}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground">{pitcher.name}</div>
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading stats...</div>
        ) : stats ? (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
            <span><span className="text-foreground/70">ERA</span> {stats.era}</span>
            <span><span className="text-foreground/70">WHIP</span> {stats.whip}</span>
            <span><span className="text-foreground/70">K/9</span> {stats.kPer9}</span>
            <span><span className="text-foreground/70">W-L</span> {stats.wins}-{stats.losses}</span>
            <span><span className="text-foreground/70">IP</span> {stats.ip}</span>
          </div>
        ) : (
          <div className="flex gap-x-3 text-xs text-muted-foreground">
            <span>ERA {pitcher.era}</span>
            <span>WHIP {pitcher.whip}</span>
            <span>K/9 {pitcher.kPer9}</span>
            <span>{pitcher.wins}-{pitcher.losses}</span>
          </div>
        )}
        {/* Last 5 starts mini-chart */}
        {splits?.last5 && splits.last5.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {splits.last5.map((g, i) => (
              <div
                key={i}
                title={`${g.date} vs ${g.opponent}: ${g.ip} IP, ${g.er} ER, ${g.k} K`}
                className={`w-6 h-6 rounded text-xs flex items-center justify-center font-bold ${
                  g.result === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  g.result === 'L' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}
              >
                {g.result}
              </div>
            ))}
            <span className="text-xs text-muted-foreground self-center ml-1">last 5</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BatterRow({ batter, index }: {
  batter: GameLineup['homeLineup'][0];
  index: number;
}) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm hover:bg-white/5 rounded px-1 transition-colors">
      <span className="w-5 text-center text-xs text-muted-foreground shrink-0">{index + 1}</span>
      <span className="w-7 text-center text-xs font-mono bg-slate-700/50 rounded px-1 py-0.5 text-slate-300 shrink-0">
        {batter.position}
      </span>
      <span className="flex-1 font-medium text-foreground truncate">{batter.name}</span>
      <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
        <span title="Batting Average" className="w-10 text-right">{batter.avg}</span>
        <span title="Home Runs" className="w-6 text-right text-amber-400">{batter.hr}</span>
        <span title="RBI" className="w-8 text-right">{batter.rbi}</span>
        <span title="OBP" className="w-10 text-right text-emerald-400/80">{batter.obp}</span>
      </div>
    </div>
  );
}

export default function LineupCard({ game, weather }: LineupCardProps) {
  const [expanded, setExpanded] = useState(false);

  const gameTime = game.gameTime
    ? new Date(game.gameTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : 'TBD';

  const statusColor = {
    'Final': 'text-slate-500',
    'In Progress': 'text-emerald-400',
    'Pre-Game': 'text-amber-400',
    'Preview': 'text-blue-400',
  }[game.status] ?? 'text-slate-400';

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Game header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-foreground">
            <span className="text-muted-foreground">{game.awayTeam.abbrev}</span>
            <span className="mx-2 text-muted-foreground">@</span>
            <span>{game.homeTeam.abbrev}</span>
          </div>
          <span className={`text-xs ${statusColor}`}>{game.status}</span>
          {game.lineupConfirmed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              ✓ Lineup
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <WeatherBadge weather={weather} />
          <span className="text-xs text-muted-foreground">{gameTime}</span>
          <span className="text-muted-foreground text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Weather note */}
          {weather && !weather.isIndoor && weather.betNote && (
            <div className={`px-4 py-2 text-xs border-b border-border ${
              weather.betImpact === 'unfavorable' ? 'bg-amber-500/5 text-amber-300' :
              weather.betImpact === 'favorable' ? 'bg-emerald-500/5 text-emerald-300' :
              'bg-slate-500/5 text-slate-400'
            }`}>
              ⚡ {weather.betNote}
            </div>
          )}

          <div className="grid grid-cols-2 divide-x divide-border">
            {/* Away team */}
            <div className="p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {game.awayTeam.name} (Away)
              </div>
              <PitcherRow pitcher={game.awayProbablePitcher} side="away" />
              {game.awayLineup.length > 0 ? (
                <div className="mt-2">
                  <div className="flex gap-2 text-xs text-muted-foreground/60 px-1 mb-1">
                    <span className="w-5"></span>
                    <span className="w-7"></span>
                    <span className="flex-1">Name</span>
                    <span className="w-10 text-right">AVG</span>
                    <span className="w-6 text-right">HR</span>
                    <span className="w-8 text-right">RBI</span>
                    <span className="w-10 text-right">OBP</span>
                  </div>
                  {game.awayLineup.map((b, i) => <BatterRow key={b.playerId} batter={b} index={i} />)}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic mt-2 py-2">Lineup not yet posted</div>
              )}
            </div>

            {/* Home team */}
            <div className="p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {game.homeTeam.name} (Home)
              </div>
              <PitcherRow pitcher={game.homeProbablePitcher} side="home" />
              {game.homeLineup.length > 0 ? (
                <div className="mt-2">
                  <div className="flex gap-2 text-xs text-muted-foreground/60 px-1 mb-1">
                    <span className="w-5"></span>
                    <span className="w-7"></span>
                    <span className="flex-1">Name</span>
                    <span className="w-10 text-right">AVG</span>
                    <span className="w-6 text-right">HR</span>
                    <span className="w-8 text-right">RBI</span>
                    <span className="w-10 text-right">OBP</span>
                  </div>
                  {game.homeLineup.map((b, i) => <BatterRow key={b.playerId} batter={b} index={i} />)}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic mt-2 py-2">Lineup not yet posted</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
