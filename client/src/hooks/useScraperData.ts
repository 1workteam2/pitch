/**
 * useScraperData
 * Connects the frontend to the three server-side scrapers:
 *   - lineups (batting orders + probable pitchers)
 *   - pitcher splits (last 5 starts, season stats, home/away)
 *   - weather (ballpark conditions, bet impact)
 *
 * Usage:
 *   const { lineups, weather, isLoading } = useScraperData();
 *   const { splits } = usePitcherSplits(playerId, teamAbbrev);
 */

import { trpc } from '@/lib/trpc';

// ── Today's lineups ──────────────────────────────────────────────────────────
export function useLineups() {
  const { data, isLoading, error, refetch } = trpc.scrapers.lineups.today.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,   // consider fresh for 10 min
    refetchInterval: 15 * 60 * 1000, // auto-refetch every 15 min
    retry: 2,
  });

  return {
    lineups: data?.data ?? [],
    source: data?.source,
    lastRefresh: data?.lastRefresh,
    isLoading,
    error,
    refetch,
  };
}

// ── Pitcher splits for a single pitcher ─────────────────────────────────────
export function usePitcherSplits(playerId: number | null, teamAbbrev = '???') {
  const { data, isLoading, error } = trpc.scrapers.pitcherSplits.get.useQuery(
    { playerId: playerId!, teamAbbrev },
    {
      enabled: !!playerId,
      staleTime: 30 * 60 * 1000,
      retry: 1,
    }
  );

  return { splits: data ?? null, isLoading, error };
}

// ── Pitcher splits for multiple pitchers ─────────────────────────────────────
export function useMultiplePitcherSplits(
  pitchers: Array<{ playerId: number; teamAbbrev: string }>
) {
  const { data, isLoading, error } = trpc.scrapers.pitcherSplits.getMany.useQuery(
    pitchers,
    {
      enabled: pitchers.length > 0,
      staleTime: 30 * 60 * 1000,
      retry: 1,
    }
  );

  return { splitsMap: Object.fromEntries((data ?? []).map(s => [s.playerId, s])), isLoading, error };
}

// ── Weather ──────────────────────────────────────────────────────────────────
export function useWeather(venueIds?: number[]) {
  const { data, isLoading, error, refetch } = trpc.scrapers.weather.today.useQuery(
    venueIds ? { venueIds } : undefined,
    {
      staleTime: 25 * 60 * 1000,
      refetchInterval: 30 * 60 * 1000,
      retry: 2,
    }
  );

  return {
    weather: data?.data ?? [],
    source: data?.source,
    lastRefresh: data?.lastRefresh,
    isLoading,
    error,
    refetch,
  };
}

// ── Scraper status ────────────────────────────────────────────────────────────
export function useScraperStatus() {
  const { data } = trpc.scrapers.status.useQuery(undefined, {
    refetchInterval: 60 * 1000,
  });
  return data ?? { lastRefresh: null, isRefreshing: false, schedulerActive: false };
}

// ── Force refresh all ────────────────────────────────────────────────────────
export function useRefreshAll() {
  const utils = trpc.useUtils();
  const mutation = trpc.scrapers.refreshAll.useMutation({
    onSuccess: () => {
      utils.scrapers.lineups.today.invalidate();
      utils.scrapers.weather.today.invalidate();
      utils.scrapers.status.invalidate();
    },
  });
  return mutation;
}
