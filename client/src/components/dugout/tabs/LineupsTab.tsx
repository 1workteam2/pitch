/**
 * LineupsTab
 * Displays today's confirmed MLB lineups with:
 *   - Probable pitchers + last 5 starts
 *   - Batting orders (once posted)
 *   - Ballpark weather with bet impact
 *   - Auto-refreshes every 15 minutes
 */

import { useLineups, useWeather, useScraperStatus, useRefreshAll } from '@/hooks/useScraperData';
import LineupCard from '@/components/dugout/LineupCard';

export default function LineupsTab() {
  const { lineups, isLoading, error, lastRefresh } = useLineups();
  const { weather } = useWeather();
  const status = useScraperStatus();
  const refreshAll = useRefreshAll();

  // Build a weather map by venue name for quick lookup
  const weatherByVenue = Object.fromEntries(
    weather.map(w => [w.venueName.toLowerCase(), w])
  );

  // Try to match weather to game by venue name
  function getWeatherForGame(venueName: string) {
    const key = venueName.toLowerCase();
    // Direct match
    if (weatherByVenue[key]) return weatherByVenue[key];
    // Partial match
    const match = Object.keys(weatherByVenue).find(k => k.includes(key) || key.includes(k));
    return match ? weatherByVenue[match] : undefined;
  }

  const confirmedGames = lineups.filter(g => g.lineupConfirmed);
  const pendingGames = lineups.filter(g => !g.lineupConfirmed);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Today's Lineups</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefresh
              ? `Updated ${new Date(lastRefresh).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : 'Loading...'}
            {status.isRefreshing && ' · Refreshing...'}
          </p>
        </div>
        <button
          onClick={() => refreshAll.mutate()}
          disabled={refreshAll.isPending || status.isRefreshing}
          className="text-xs px-3 py-1.5 rounded border border-border hover:bg-white/5 transition-colors text-muted-foreground disabled:opacity-50"
        >
          {refreshAll.isPending ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Stats bar */}
      {!isLoading && lineups.length > 0 && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="text-foreground font-medium">{lineups.length}</span> games today</span>
          <span><span className="text-emerald-400 font-medium">{confirmedGames.length}</span> lineups confirmed</span>
          <span><span className="text-amber-400 font-medium">{pendingGames.length}</span> pending</span>
          <span><span className="text-blue-400 font-medium">{weather.filter(w => !w.isIndoor && w.betImpact === 'unfavorable').length}</span> weather concerns</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          Failed to load lineups: {error.message}
        </div>
      )}

      {/* Confirmed lineups */}
      {confirmedGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            ✓ Confirmed Lineups ({confirmedGames.length})
          </h3>
          {confirmedGames.map(game => (
            <LineupCard
              key={game.gamePk}
              game={game}
              weather={getWeatherForGame(game.venue)}
            />
          ))}
        </div>
      )}

      {/* Pending lineups */}
      {pendingGames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            ⏳ Probable Pitchers — Lineups Pending ({pendingGames.length})
          </h3>
          {pendingGames.map(game => (
            <LineupCard
              key={game.gamePk}
              game={game}
              weather={getWeatherForGame(game.venue)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && lineups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-3">⚾</div>
          <div className="text-sm">No games scheduled today</div>
        </div>
      )}
    </div>
  );
}
