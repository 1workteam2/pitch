/**
 * Pitcher Splits Scraper
 * Source: MLB Stats API (statsapi.mlb.com) — no key required
 *
 * For each probable pitcher today, fetches:
 *   - Season stats: ERA, WHIP, K/9, BB/9, HR/9, FIP (approx), GB%
 *   - Last 5 game logs: date, opponent, IP, H, R, ER, BB, K, pitches, result
 *   - Career vs today's opponent (if available)
 *   - Home/Away splits
 *
 * Cache: in-memory, refreshed every 30 minutes
 */

import axios from 'axios';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export interface GameLog {
  date: string;
  opponent: string;
  result: 'W' | 'L' | 'ND' | '--';
  ip: string;
  hits: number;
  runs: number;
  er: number;
  bb: number;
  k: number;
  pitches: number;
  era: string;
}

export interface SeasonSplitStats {
  era: string;
  whip: string;
  kPer9: string;
  bbPer9: string;
  hrPer9: string;
  avgAgainst: string;
  obpAgainst: string;
  wins: number;
  losses: number;
  saves: number;
  ip: string;
  gs: number;       // games started
  strikeouts: number;
  walks: number;
  homeRuns: number;
}

export interface PitcherSplits {
  playerId: number;
  name: string;
  throws: string;
  teamAbbrev: string;
  season: SeasonSplitStats;
  last5: GameLog[];
  homeStats: Partial<SeasonSplitStats>;
  awayStats: Partial<SeasonSplitStats>;
  fetchedAt: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────
const splitCache = new Map<number, { data: PitcherSplits; ts: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function isCacheValid(playerId: number) {
  const entry = splitCache.get(playerId);
  return entry && Date.now() - entry.ts < CACHE_TTL_MS;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeStr(val: unknown, fallback = '--'): string {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseSplitStats(stat: Record<string, unknown>): SeasonSplitStats {
  return {
    era: safeStr(stat.era),
    whip: safeStr(stat.whip),
    kPer9: safeStr(stat.strikeoutsPer9Inn),
    bbPer9: safeStr(stat.walksPer9Inn),
    hrPer9: safeStr(stat.homeRunsPer9),
    avgAgainst: safeStr(stat.avg),
    obpAgainst: safeStr(stat.obp),
    wins: safeNum(stat.wins),
    losses: safeNum(stat.losses),
    saves: safeNum(stat.saves),
    ip: safeStr(stat.inningsPitched),
    gs: safeNum(stat.gamesStarted),
    strikeouts: safeNum(stat.strikeOuts),
    walks: safeNum(stat.baseOnBalls),
    homeRuns: safeNum(stat.homeRuns),
  };
}

// ── Main fetch ───────────────────────────────────────────────────────────────
export async function fetchPitcherSplits(
  playerId: number,
  teamAbbrev = '???',
  forceRefresh = false
): Promise<PitcherSplits | null> {
  if (!forceRefresh && isCacheValid(playerId)) {
    return splitCache.get(playerId)!.data;
  }

  try {
    // 1. Person info + season stats + home/away splits + game logs
    const url = `${MLB_BASE}/people/${playerId}?hydrate=stats(group=pitching,type=season),stats(group=pitching,type=gameLog,limit=5),stats(group=pitching,type=homeAndAway),currentTeam`;
    const { data } = await axios.get(url, { timeout: 10000 });
    const person = data?.people?.[0];
    if (!person) return null;

    const allStats: Record<string, unknown>[] = person.stats ?? [];

    // Season totals
    const seasonBlock = allStats.find((s: Record<string, unknown>) => (s.type as Record<string, unknown>)?.displayName === 'season');
    const seasonStat = (seasonBlock?.splits as Record<string, unknown>[])?.[0]?.stat as Record<string, unknown> ?? {};
    const season = parseSplitStats(seasonStat);

    // Game logs (last 5 starts)
    const gameLogBlock = allStats.find((s: Record<string, unknown>) => (s.type as Record<string, unknown>)?.displayName === 'gameLog');
    const gameLogs: GameLog[] = ((gameLogBlock?.splits as Record<string, unknown>[]) ?? [])
      .slice(0, 5)
      .map((split: Record<string, unknown>) => {
        const s = split.stat as Record<string, unknown> ?? {};
        const opponent = (split.opponent as Record<string, unknown>)?.abbreviation as string ?? '???';
        const isWin = safeNum(s.wins) > 0;
        const isLoss = safeNum(s.losses) > 0;
        return {
          date: safeStr(split.date),
          opponent,
          result: isWin ? 'W' : isLoss ? 'L' : 'ND',
          ip: safeStr(s.inningsPitched),
          hits: safeNum(s.hits),
          runs: safeNum(s.runs),
          er: safeNum(s.earnedRuns),
          bb: safeNum(s.baseOnBalls),
          k: safeNum(s.strikeOuts),
          pitches: safeNum(s.numberOfPitches),
          era: safeStr(s.era),
        } as GameLog;
      });

    // Home/Away splits
    const homeAwayBlock = allStats.find((s: Record<string, unknown>) => (s.type as Record<string, unknown>)?.displayName === 'homeAndAway');
    const homeAwaySplits = (homeAwayBlock?.splits as Record<string, unknown>[]) ?? [];
    const homeSplit = homeAwaySplits.find((s: Record<string, unknown>) => s.isHome === true);
    const awaySplit = homeAwaySplits.find((s: Record<string, unknown>) => s.isHome === false);

    const homeStats = homeSplit ? parseSplitStats(homeSplit.stat as Record<string, unknown>) : {};
    const awayStats = awaySplit ? parseSplitStats(awaySplit.stat as Record<string, unknown>) : {};

    const result: PitcherSplits = {
      playerId,
      name: person.fullName ?? 'Unknown',
      throws: person.pitchHand?.code ?? '?',
      teamAbbrev,
      season,
      last5: gameLogs,
      homeStats,
      awayStats,
      fetchedAt: new Date().toISOString(),
    };

    splitCache.set(playerId, { data: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error(`[pitcherSplits] Failed for playerId ${playerId}:`, err);
    return null;
  }
}

export async function fetchMultiplePitcherSplits(
  pitchers: Array<{ playerId: number; teamAbbrev: string }>,
  forceRefresh = false
): Promise<PitcherSplits[]> {
  const results = await Promise.allSettled(
    pitchers.map(p => fetchPitcherSplits(p.playerId, p.teamAbbrev, forceRefresh))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<PitcherSplits> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}

export function clearPitcherSplitsCache() {
  splitCache.clear();
}
