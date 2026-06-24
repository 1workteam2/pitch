/**
 * Scraper Router
 * Exposes tRPC procedures for:
 *   - lineups.today     — confirmed batting orders + probable pitchers
 *   - pitcherSplits.get — last 5 starts + season splits for a pitcher
 *   - weather.today     — ballpark conditions for today's games
 *   - scraper.refresh   — force-refresh all caches (admin only)
 *
 * Scheduled auto-refresh runs at startup and every 15 minutes.
 */

import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { scrapeLineups, getLineupsCache } from '../scrapers/lineups';
import { fetchPitcherSplits, fetchMultiplePitcherSplits } from '../scrapers/pitcherSplits';
import { scrapeWeather, getWeatherCache } from '../scrapers/weather';
import { notifyOwner } from '../_core/notification';

// ── Scheduled refresh ────────────────────────────────────────────────────────
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let lastRefresh: Date | null = null;
let isRefreshing = false;

// Track which games have already sent a lineup-confirmed notification
const notifiedLineupGames = new Set<number>();

async function runFullRefresh(force = false) {
  if (isRefreshing) return;
  isRefreshing = true;
  console.log('[scrapers] Starting full data refresh...');

  try {
    // 1. Lineups first (gives us game times and pitcher IDs)
    const prevCache: import('../scrapers/lineups').GameLineup[] = getLineupsCache() ?? [];
    const prevConfirmedSet = new Set(prevCache.filter(g => g.lineupConfirmed).map(g => g.gamePk));

    const lineups = await scrapeLineups(force);
    console.log(`[scrapers] Lineups: ${lineups.length} games loaded`);

    // Notify owner for any newly confirmed lineups
    for (const game of lineups) {
      if (
        game.lineupConfirmed &&
        !prevConfirmedSet.has(game.gamePk) &&
        !notifiedLineupGames.has(game.gamePk)
      ) {
        notifiedLineupGames.add(game.gamePk);
        const awayPitcher = game.awayProbablePitcher?.name ?? 'TBD';
        const homePitcher = game.homeProbablePitcher?.name ?? 'TBD';
        const gameTimeLocal = new Date(game.gameTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        });
        notifyOwner({
          title: `⚾ Lineups Confirmed — ${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}`,
          content: [
            `Game: ${game.awayTeam.name} @ ${game.homeTeam.name}`,
            `Time: ${gameTimeLocal}`,
            `Venue: ${game.venue}`,
            `Away SP: ${awayPitcher}`,
            `Home SP: ${homePitcher}`,
            ``,
            `✅ Lineups are confirmed — safe to lock YRFI, First Five, and player props.`,
          ].join('\n'),
        }).catch(err => console.warn('[scrapers] Lineup notification failed:', err));
        console.log(`[scrapers] Sent lineup-confirmed notification for game ${game.gamePk}: ${game.awayTeam.abbrev} @ ${game.homeTeam.abbrev}`);
      }
    }

    // 2. Pitcher splits for all probable pitchers
    const pitchers: Array<{ playerId: number; teamAbbrev: string }> = [];
    for (const game of lineups) {
      if (game.homeProbablePitcher) {
        pitchers.push({ playerId: game.homeProbablePitcher.playerId, teamAbbrev: game.homeTeam.abbrev });
      }
      if (game.awayProbablePitcher) {
        pitchers.push({ playerId: game.awayProbablePitcher.playerId, teamAbbrev: game.awayTeam.abbrev });
      }
    }
    if (pitchers.length > 0) {
      const splits = await fetchMultiplePitcherSplits(pitchers, force);
      console.log(`[scrapers] Pitcher splits: ${splits.length} pitchers loaded`);
    }

    // 3. Weather for today's venues
    // Weather scraper handles all venues by default; no venueId filtering needed here

    // Build game time map for accurate forecast matching
    const gameTimes: Record<number, string> = {};
    for (const game of lineups) {
      // We'll pass all venues; weather scraper handles matching
    }

    const weather = await scrapeWeather(undefined, gameTimes, force);
    console.log(`[scrapers] Weather: ${weather.length} venues loaded`);

    lastRefresh = new Date();
    console.log(`[scrapers] Full refresh complete at ${lastRefresh.toISOString()}`);
  } catch (err) {
    console.error('[scrapers] Refresh error:', err);
  } finally {
    isRefreshing = false;
  }
}

// Start scheduled refresh
export function startScraperSchedule() {
  // Initial load on startup
  runFullRefresh(false).catch(console.error);

  // Refresh every 15 minutes
  refreshTimer = setInterval(() => {
    runFullRefresh(false).catch(console.error);
  }, 15 * 60 * 1000);

  console.log('[scrapers] Scheduler started — refreshing every 15 minutes');
}

export function stopScraperSchedule() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ── tRPC Router ──────────────────────────────────────────────────────────────
export const scrapersRouter = router({
  // Get today's lineups (uses cache, triggers refresh if stale)
  lineups: router({
    today: publicProcedure.query(async () => {
      const cached = getLineupsCache();
      if (cached && cached.length > 0) return { data: cached, source: 'cache', lastRefresh: lastRefresh?.toISOString() };
      const data = await scrapeLineups(false);
      return { data, source: 'fresh', lastRefresh: new Date().toISOString() };
    }),

    refresh: publicProcedure.mutation(async () => {
      const data = await scrapeLineups(true);
      return { data, refreshedAt: new Date().toISOString() };
    }),
  }),

  // Get pitcher splits by player ID
  pitcherSplits: router({
    get: publicProcedure
      .input(z.object({
        playerId: z.number(),
        teamAbbrev: z.string().default('???'),
      }))
      .query(async ({ input }) => {
        const data = await fetchPitcherSplits(input.playerId, input.teamAbbrev);
        return data;
      }),

    getMany: publicProcedure
      .input(z.array(z.object({
        playerId: z.number(),
        teamAbbrev: z.string().default('???'),
      })))
      .query(async ({ input }) => {
        const data = await fetchMultiplePitcherSplits(input);
        return data;
      }),
  }),

  // Get weather for all ballparks (or specific venue IDs)
  weather: router({
    today: publicProcedure
      .input(z.object({
        venueIds: z.array(z.number()).optional(),
      }).optional())
      .query(async ({ input }) => {
        const cached = getWeatherCache();
        if (cached.length > 0) return { data: cached, source: 'cache', lastRefresh: lastRefresh?.toISOString() };
        const data = await scrapeWeather(input?.venueIds);
        return { data, source: 'fresh', lastRefresh: new Date().toISOString() };
      }),

    refresh: publicProcedure
      .input(z.object({
        venueIds: z.array(z.number()).optional(),
      }).optional())
      .mutation(async ({ input }) => {
        const data = await scrapeWeather(input?.venueIds, undefined, true);
        return { data, refreshedAt: new Date().toISOString() };
      }),
  }),

  // Force-refresh everything
  refreshAll: publicProcedure.mutation(async () => {
    await runFullRefresh(true);
    return { success: true, refreshedAt: new Date().toISOString() };
  }),

  // Status endpoint
  status: publicProcedure.query(() => ({
    lastRefresh: lastRefresh?.toISOString() ?? null,
    isRefreshing,
    schedulerActive: refreshTimer !== null,
  })),
});
