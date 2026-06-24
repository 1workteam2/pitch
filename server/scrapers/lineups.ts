/**
 * Lineup Scraper
 * Sources:
 *   - MLB Stats API (statsapi.mlb.com) — official, no key needed
 *   - Fetches today's schedule, then per-game lineup data
 *
 * Data returned per game:
 *   - gameId, gamePk, gameTime, status
 *   - homeTeam / awayTeam: name, abbrev, probablePitcher
 *   - homeLineup / awayLineup: batting order with name, position, bats, avg, hr, rbi
 *
 * Cache: in-memory, refreshed every 15 minutes
 */

import axios from 'axios';

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

export interface BatterEntry {
  battingOrder: number;
  playerId: number;
  name: string;
  position: string;
  bats: string;
  avg: string;
  hr: number;
  rbi: number;
  obp: string;
  slg: string;
}

export interface PitcherEntry {
  playerId: number;
  name: string;
  throws: string;
  era: string;
  wins: number;
  losses: number;
  ip: string;
  whip: string;
  kPer9: string;
}

export interface GameLineup {
  gamePk: number;
  gameId: string;
  gameTime: string;       // ISO string UTC
  status: string;         // 'Preview' | 'Pre-Game' | 'In Progress' | 'Final' etc.
  venue: string;
  homeTeam: { id: number; name: string; abbrev: string };
  awayTeam: { id: number; name: string; abbrev: string };
  homeProbablePitcher: PitcherEntry | null;
  awayProbablePitcher: PitcherEntry | null;
  homeLineup: BatterEntry[];
  awayLineup: BatterEntry[];
  lineupConfirmed: boolean;
  fetchedAt: string;
}

// ── In-memory cache ──────────────────────────────────────────────────────────
let cache: { data: GameLineup[]; ts: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function isCacheValid() {
  return cache && Date.now() - cache.ts < CACHE_TTL_MS;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchProbablePitcherStats(playerId: number): Promise<Partial<PitcherEntry>> {
  try {
    const url = `${MLB_BASE}/people/${playerId}?hydrate=stats(group=pitching,type=season)`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const stats = data?.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    if (!stats) return {};
    return {
      era: stats.era ?? '--',
      wins: stats.wins ?? 0,
      losses: stats.losses ?? 0,
      ip: stats.inningsPitched ?? '--',
      whip: stats.whip ?? '--',
      kPer9: stats.strikeoutsPer9Inn ?? '--',
    };
  } catch {
    return {};
  }
}

async function fetchBatterSeasonStats(playerId: number): Promise<Partial<BatterEntry>> {
  try {
    const url = `${MLB_BASE}/people/${playerId}?hydrate=stats(group=hitting,type=season)`;
    const { data } = await axios.get(url, { timeout: 8000 });
    const stats = data?.people?.[0]?.stats?.[0]?.splits?.[0]?.stat;
    const person = data?.people?.[0];
    if (!stats) return {};
    return {
      bats: person?.batSide?.code ?? '?',
      avg: stats.avg ?? '.000',
      hr: stats.homeRuns ?? 0,
      rbi: stats.rbi ?? 0,
      obp: stats.obp ?? '.000',
      slg: stats.slg ?? '.000',
    };
  } catch {
    return {};
  }
}

// ── Main scrape function ─────────────────────────────────────────────────────
export async function scrapeLineups(forceRefresh = false): Promise<GameLineup[]> {
  if (!forceRefresh && isCacheValid()) {
    return cache!.data;
  }

  const date = todayStr();
  const scheduleUrl = `${MLB_BASE}/schedule?sportId=1&date=${date}&hydrate=probablePitcher(note),linescore,team,venue,game(content(summary))`;

  const { data: scheduleData } = await axios.get(scheduleUrl, { timeout: 10000 });
  const games = scheduleData?.dates?.[0]?.games ?? [];

  const results: GameLineup[] = [];

  for (const game of games) {
    const gamePk: number = game.gamePk;
    const status: string = game.status?.detailedState ?? 'Unknown';
    const gameTime: string = game.gameDate ?? '';
    const venue: string = game.venue?.name ?? 'Unknown Venue';

    const homeTeam = {
      id: game.teams?.home?.team?.id ?? 0,
      name: game.teams?.home?.team?.name ?? 'Home',
      abbrev: game.teams?.home?.team?.abbreviation ?? 'HM',
    };
    const awayTeam = {
      id: game.teams?.away?.team?.id ?? 0,
      name: game.teams?.away?.team?.name ?? 'Away',
      abbrev: game.teams?.away?.team?.abbreviation ?? 'AW',
    };

    // Probable pitchers
    const homePitcherRaw = game.teams?.home?.probablePitcher;
    const awayPitcherRaw = game.teams?.away?.probablePitcher;

    let homeProbablePitcher: PitcherEntry | null = null;
    let awayProbablePitcher: PitcherEntry | null = null;

    if (homePitcherRaw?.id) {
      const extra = await fetchProbablePitcherStats(homePitcherRaw.id);
      homeProbablePitcher = {
        playerId: homePitcherRaw.id,
        name: homePitcherRaw.fullName ?? 'Unknown',
        throws: homePitcherRaw.pitchHand?.code ?? '?',
        era: extra.era ?? '--',
        wins: extra.wins ?? 0,
        losses: extra.losses ?? 0,
        ip: extra.ip ?? '--',
        whip: extra.whip ?? '--',
        kPer9: extra.kPer9 ?? '--',
      };
    }

    if (awayPitcherRaw?.id) {
      const extra = await fetchProbablePitcherStats(awayPitcherRaw.id);
      awayProbablePitcher = {
        playerId: awayPitcherRaw.id,
        name: awayPitcherRaw.fullName ?? 'Unknown',
        throws: awayPitcherRaw.pitchHand?.code ?? '?',
        era: extra.era ?? '--',
        wins: extra.wins ?? 0,
        losses: extra.losses ?? 0,
        ip: extra.ip ?? '--',
        whip: extra.whip ?? '--',
        kPer9: extra.kPer9 ?? '--',
      };
    }

    // Batting lineups — only available once lineups are posted
    let homeLineup: BatterEntry[] = [];
    let awayLineup: BatterEntry[] = [];
    let lineupConfirmed = false;

    try {
      const boxUrl = `${MLB_BASE}/game/${gamePk}/boxscore`;
      const { data: boxData } = await axios.get(boxUrl, { timeout: 8000 });

      const processTeam = async (teamData: Record<string, unknown>): Promise<BatterEntry[]> => {
        const batters: BatterEntry[] = [];
        const players = (teamData?.players as Record<string, unknown>) ?? {};
        const battingOrder = (teamData?.battingOrder as number[]) ?? [];

        for (let i = 0; i < battingOrder.length; i++) {
          const pid = battingOrder[i];
          const pKey = `ID${pid}`;
          const p = players[pKey] as Record<string, unknown> | undefined;
          if (!p) continue;

          const person = p.person as Record<string, unknown>;
          const pos = (p.position as Record<string, unknown>)?.abbreviation as string ?? '?';
          const seasonStats = await fetchBatterSeasonStats(pid);

          batters.push({
            battingOrder: i + 1,
            playerId: pid,
            name: (person?.fullName as string) ?? 'Unknown',
            position: pos,
            bats: seasonStats.bats ?? '?',
            avg: seasonStats.avg ?? '.000',
            hr: seasonStats.hr ?? 0,
            rbi: seasonStats.rbi ?? 0,
            obp: seasonStats.obp ?? '.000',
            slg: seasonStats.slg ?? '.000',
          });
        }
        return batters;
      };

      const homeTeamBox = boxData?.teams?.home as Record<string, unknown>;
      const awayTeamBox = boxData?.teams?.away as Record<string, unknown>;
      const homeBattingOrder = (homeTeamBox?.battingOrder as number[]) ?? [];

      if (homeBattingOrder.length > 0) {
        lineupConfirmed = true;
        [homeLineup, awayLineup] = await Promise.all([
          processTeam(homeTeamBox),
          processTeam(awayTeamBox),
        ]);
      }
    } catch {
      // Lineup not yet posted — that's normal before game day
    }

    results.push({
      gamePk,
      gameId: `${date}-${awayTeam.abbrev}-${homeTeam.abbrev}`,
      gameTime,
      status,
      venue,
      homeTeam,
      awayTeam,
      homeProbablePitcher,
      awayProbablePitcher,
      homeLineup,
      awayLineup,
      lineupConfirmed,
      fetchedAt: new Date().toISOString(),
    });
  }

  cache = { data: results, ts: Date.now() };
  return results;
}

export function getLineupsCache(): GameLineup[] | null {
  return cache?.data ?? null;
}

export function clearLineupsCache() {
  cache = null;
}
