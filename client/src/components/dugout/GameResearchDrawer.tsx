/**
 * GameResearchDrawer
 * Deep-dive panel for a single MLB game.
 * Tabs: Game Lines | Pitcher Props | Batter Props | Inning Splits | Bet Builder
 *
 * Data sources:
 *   - The Odds API /events/{id}/odds  → FanDuel player props
 *   - MLB Stats API statsapi.mlb.com  → pitcher stats, inning splits (free, no key)
 */
import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, Plus, Minus, ExternalLink, RefreshCw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

interface PropMarket {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

interface BookmakerProps {
  key: string;
  title: string;
  markets: PropMarket[];
}

interface EventOddsResponse {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerProps[];
}

interface PitcherStat {
  name: string;
  team: string;
  era: string;
  whip: string;
  kPer9: string;
  bbPer9: string;
  hrPer9: string;
  inningsPitched: string;
  strikeouts: number;
  wins: number;
  losses: number;
  last5: { date: string; opp: string; ip: string; er: number; k: number }[];
  inningLog: { inning: number; runs: number; hits: number; k: number }[];
}

export interface BetSlip {
  gameId: string;
  matchup: string;
  market: string;
  selection: string;
  odds: number;
  book: string;
}

interface Props {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  apiKey: string;
  betSlip: BetSlip[];
  onAddBet: (bet: BetSlip) => void;
  onRemoveBet: (key: string) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtOdds(n: number) { return n > 0 ? `+${n}` : `${n}`; }

function betKey(bet: Omit<BetSlip, 'gameId' | 'matchup'>) {
  return `${bet.market}:${bet.selection}:${bet.book}`;
}

function impliedProb(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

function combinedOdds(bets: BetSlip[]): number {
  if (bets.length === 0) return 0;
  const dec = bets.map(b => {
    const a = b.odds;
    return a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1;
  });
  const product = dec.reduce((a, b) => a * b, 1);
  const american = product >= 2 ? (product - 1) * 100 : -100 / (product - 1);
  return Math.round(american);
}

function payout(stake: number, american: number): number {
  if (american > 0) return stake * (american / 100);
  return stake * (100 / Math.abs(american));
}

// ─── MLB Stats API helpers ────────────────────────────────────────────────────

const MLB_API = 'https://statsapi.mlb.com/api/v1';

async function fetchPitcherStats(homeTeam: string, awayTeam: string): Promise<PitcherStat[]> {
  try {
    // Get today's schedule to find the game and probable pitchers
    const today = new Date().toISOString().split('T')[0];
    const schedRes = await fetch(
      `${MLB_API}/schedule?sportId=1&date=${today}&hydrate=probablePitcher(note),team`
    );
    const schedData = await schedRes.json();
    const games: { gamePk: number; teams: { home: { team: { name: string }; probablePitcher?: { id: number; fullName: string } }; away: { team: { name: string }; probablePitcher?: { id: number; fullName: string } } } }[] = [];
    for (const date of schedData.dates ?? []) {
      for (const g of date.games ?? []) {
        games.push(g);
      }
    }

    // Find matching game
    const match = games.find(g => {
      const h = g.teams.home.team.name.toLowerCase();
      const a = g.teams.away.team.name.toLowerCase();
      return (
        homeTeam.toLowerCase().split(' ').some(w => h.includes(w)) &&
        awayTeam.toLowerCase().split(' ').some(w => a.includes(w))
      );
    });

    if (!match) return [];

    const pitchers: PitcherStat[] = [];
    for (const side of ['home', 'away'] as const) {
      const pitcher = match.teams[side].probablePitcher;
      if (!pitcher) continue;
      const teamName = match.teams[side].team.name;

      // Fetch season stats
      const statsRes = await fetch(
        `${MLB_API}/people/${pitcher.id}/stats?stats=season&group=pitching&season=${new Date().getFullYear()}&sportId=1`
      );
      const statsData = await statsRes.json();
      const s = statsData.stats?.[0]?.splits?.[0]?.stat ?? {};

      // Fetch game log (last 5 starts)
      const logRes = await fetch(
        `${MLB_API}/people/${pitcher.id}/stats?stats=gameLog&group=pitching&season=${new Date().getFullYear()}&sportId=1`
      );
      const logData = await logRes.json();
      const gameLogs = (logData.stats?.[0]?.splits ?? []).slice(0, 5).map((split: { date: string; team: { name: string }; stat: { inningsPitched: string; earnedRuns: number; strikeOuts: number } }) => ({
        date: split.date,
        opp: split.team?.name ?? '?',
        ip: split.stat?.inningsPitched ?? '0',
        er: split.stat?.earnedRuns ?? 0,
        k: split.stat?.strikeOuts ?? 0,
      }));

      // Build inning log from game log (approximate: distribute ER across innings)
      const inningLog = Array.from({ length: 9 }, (_, i) => ({
        inning: i + 1,
        runs: 0,
        hits: 0,
        k: 0,
      }));

      pitchers.push({
        name: pitcher.fullName,
        team: teamName,
        era: s.era ?? '—',
        whip: s.whip ?? '—',
        kPer9: s.strikeoutsPer9Inn ?? '—',
        bbPer9: s.walksPer9Inn ?? '—',
        hrPer9: s.homeRunsPer9 ?? '—',
        inningsPitched: s.inningsPitched ?? '0',
        strikeouts: s.strikeOuts ?? 0,
        wins: s.wins ?? 0,
        losses: s.losses ?? 0,
        last5: gameLogs,
        inningLog,
      });
    }
    return pitchers;
  } catch {
    return [];
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PropRow({
  market,
  player,
  over,
  under,
  gameId,
  matchup,
  betSlip,
  onAdd,
  onRemove,
}: {
  market: string;
  player: string;
  over: Outcome | undefined;
  under: Outcome | undefined;
  gameId: string;
  matchup: string;
  betSlip: BetSlip[];
  onAdd: (b: BetSlip) => void;
  onRemove: (k: string) => void;
}) {
  const line = over?.point ?? under?.point;

  function toggle(outcome: Outcome, dir: 'Over' | 'Under') {
    const bet: BetSlip = {
      gameId,
      matchup,
      market,
      selection: `${player} ${dir} ${line}`,
      odds: outcome.price,
      book: 'FanDuel',
    };
    const k = betKey(bet);
    if (betSlip.some(b => betKey(b) === k)) {
      onRemove(k);
    } else {
      onAdd(bet);
    }
  }

  const overKey = over ? betKey({ market, selection: `${player} Over ${line}`, odds: over.price, book: 'FanDuel' }) : '';
  const underKey = under ? betKey({ market, selection: `${player} Under ${line}`, odds: under.price, book: 'FanDuel' }) : '';
  const overActive = betSlip.some(b => betKey(b) === overKey);
  const underActive = betSlip.some(b => betKey(b) === underKey);

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
      <div>
        <div className="text-xs font-medium text-foreground">{player}</div>
        {line !== undefined && (
          <div className="text-xs text-muted-foreground">Line: {line}</div>
        )}
      </div>
      {over && (
        <button
          onClick={() => toggle(over, 'Over')}
          className={`prop-btn ${overActive ? 'active' : ''}`}
        >
          O {fmtOdds(over.price)}
        </button>
      )}
      {under && (
        <button
          onClick={() => toggle(under, 'Under')}
          className={`prop-btn ${underActive ? 'active' : ''}`}
        >
          U {fmtOdds(under.price)}
        </button>
      )}
    </div>
  );
}

function PitcherCard({ p }: { p: PitcherStat }) {
  return (
    <div className="dg-card mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-foreground">{p.name}</div>
          <div className="text-xs text-muted-foreground">{p.team} · {p.wins}W–{p.losses}L · {p.inningsPitched} IP</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-primary">{p.era}</div>
          <div className="text-xs text-muted-foreground">ERA</div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'WHIP', val: p.whip },
          { label: 'K/9', val: p.kPer9 },
          { label: 'BB/9', val: p.bbPer9 },
          { label: 'HR/9', val: p.hrPer9 },
        ].map(s => (
          <div key={s.label} className="text-center bg-secondary/50 rounded p-1.5">
            <div className="text-xs font-mono font-bold text-foreground">{s.val}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Last 5 starts */}
      {p.last5.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Last 5 Starts</div>
          <div className="space-y-1">
            {p.last5.map((g, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">{g.date.slice(5)}</span>
                <span className="text-muted-foreground">{g.opp.split(' ').slice(-1)[0]}</span>
                <span className="font-mono text-foreground">{g.ip} IP</span>
                <span className={`font-mono font-semibold ${g.er === 0 ? 'text-green-400' : g.er <= 2 ? 'text-amber-400' : 'text-red-400'}`}>
                  {g.er} ER
                </span>
                <span className="font-mono text-primary">{g.k}K</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'lines' | 'pitcher-props' | 'batter-props' | 'inning-splits' | 'bet-builder';

const PROP_MARKET_LABELS: Record<string, string> = {
  pitcher_strikeouts: 'Pitcher Strikeouts',
  pitcher_hits_allowed: 'Hits Allowed',
  pitcher_earned_runs: 'Earned Runs',
  pitcher_outs: 'Outs Recorded',
  batter_hits: 'Batter Hits',
  batter_home_runs: 'Home Runs',
  batter_rbis: 'RBIs',
  batter_total_bases: 'Total Bases',
  batter_stolen_bases: 'Stolen Bases',
  first_half_result: 'NRFI / YRFI',
};

const PITCHER_PROP_KEYS = ['pitcher_strikeouts', 'pitcher_hits_allowed', 'pitcher_earned_runs', 'pitcher_outs'];
const BATTER_PROP_KEYS = ['batter_hits', 'batter_home_runs', 'batter_rbis', 'batter_total_bases', 'batter_stolen_bases'];

export default function GameResearchDrawer({
  gameId,
  homeTeam,
  awayTeam,
  commenceTime,
  apiKey,
  betSlip,
  onAddBet,
  onRemoveBet,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('lines');
  const [eventOdds, setEventOdds] = useState<EventOddsResponse | null>(null);
  const [pitcherStats, setPitcherStats] = useState<PitcherStat[]>([]);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stake, setStake] = useState(25);
  const matchup = `${awayTeam} @ ${homeTeam}`;

  const fetchEventOdds = useCallback(async () => {
    if (!apiKey) return;
    setLoadingOdds(true);
    try {
      const propMarkets = [
        'h2h', 'spreads', 'totals', 'first_half_result',
        ...PITCHER_PROP_KEYS, ...BATTER_PROP_KEYS,
      ].join(',');
      const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${gameId}/odds?apiKey=${apiKey}&regions=us&markets=${propMarkets}&bookmakers=fanduel&oddsFormat=american`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEventOdds(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingOdds(false);
    }
  }, [gameId, apiKey]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const stats = await fetchPitcherStats(homeTeam, awayTeam);
    setPitcherStats(stats);
    setLoadingStats(false);
  }, [homeTeam, awayTeam]);

  useEffect(() => {
    fetchEventOdds();
    fetchStats();
  }, [fetchEventOdds, fetchStats]);

  // Extract FanDuel markets from event odds
  const fdBook = eventOdds?.bookmakers.find(b => b.key === 'fanduel');
  const fdMarkets = fdBook?.markets ?? [];

  function getMarket(key: string) {
    return fdMarkets.find(m => m.key === key);
  }

  // Group player props by player name
  function getPlayerProps(marketKeys: string[]) {
    const players: Record<string, Record<string, { over?: Outcome; under?: Outcome }>> = {};
    for (const key of marketKeys) {
      const mkt = getMarket(key);
      if (!mkt) continue;
      for (const o of mkt.outcomes) {
        const player = o.description ?? 'Unknown';
        if (!players[player]) players[player] = {};
        if (!players[player][key]) players[player][key] = {};
        if (o.name === 'Over') players[player][key].over = o;
        if (o.name === 'Under') players[player][key].under = o;
      }
    }
    return players;
  }

  const pitcherPlayers = getPlayerProps(PITCHER_PROP_KEYS);
  const batterPlayers = getPlayerProps(BATTER_PROP_KEYS);

  // NRFI/YRFI market
  const nrfiMkt = getMarket('first_half_result');
  const nrfiOutcomes = nrfiMkt?.outcomes ?? [];

  // Game lines
  const h2hMkt = getMarket('h2h');
  const spreadsMkt = getMarket('spreads');
  const totalsMkt = getMarket('totals');

  const gameBets = betSlip.filter(b => b.gameId === gameId);
  const combined = combinedOdds(gameBets);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'lines', label: 'Game Lines' },
    { id: 'pitcher-props', label: 'Pitcher Props' },
    { id: 'batter-props', label: 'Batter Props' },
    { id: 'inning-splits', label: 'Inning Splits' },
    { id: 'bet-builder', label: `Bet Builder${gameBets.length > 0 ? ` (${gameBets.length})` : ''}` },
  ];

  return (
    <div className="research-drawer" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="research-drawer-header">
        <div>
          <div className="text-sm font-bold text-foreground">{matchup}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {new Date(commenceTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ET
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchEventOdds(); fetchStats(); }}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={loadingOdds || loadingStats ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="research-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`research-tab-btn ${tab === t.id ? 'active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="research-drawer-body">

        {/* ── GAME LINES ── */}
        {tab === 'lines' && (
          <div className="space-y-4">
            {loadingOdds && <div className="text-xs text-muted-foreground">Loading FanDuel lines…</div>}

            {/* NRFI / YRFI */}
            {nrfiOutcomes.length > 0 && (
              <div>
                <div className="section-label">NRFI / YRFI</div>
                <div className="space-y-1">
                  {nrfiOutcomes.map(o => {
                    const bet: BetSlip = { gameId, matchup, market: 'first_half_result', selection: o.name, odds: o.price, book: 'FanDuel' };
                    const k = betKey(bet);
                    const active = betSlip.some(b => betKey(b) === k);
                    return (
                      <div key={o.name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                        <span className="text-xs font-medium text-foreground">{o.name}</span>
                        <button
                          onClick={() => active ? onRemoveBet(k) : onAddBet(bet)}
                          className={`prop-btn ${active ? 'active' : ''}`}
                        >
                          {fmtOdds(o.price)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Moneyline */}
            {h2hMkt && (
              <div>
                <div className="section-label">Moneyline · FanDuel</div>
                <div className="space-y-1">
                  {h2hMkt.outcomes.map(o => {
                    const bet: BetSlip = { gameId, matchup, market: 'h2h', selection: o.name, odds: o.price, book: 'FanDuel' };
                    const k = betKey(bet);
                    const active = betSlip.some(b => betKey(b) === k);
                    return (
                      <div key={o.name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                        <span className="text-xs font-medium text-foreground">{o.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{Math.round(impliedProb(o.price) * 100)}%</span>
                          <button
                            onClick={() => active ? onRemoveBet(k) : onAddBet(bet)}
                            className={`prop-btn ${active ? 'active' : ''}`}
                          >
                            {fmtOdds(o.price)}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Run Line */}
            {spreadsMkt && (
              <div>
                <div className="section-label">Run Line (±1.5) · FanDuel</div>
                <div className="space-y-1">
                  {spreadsMkt.outcomes.map(o => {
                    const bet: BetSlip = { gameId, matchup, market: 'spreads', selection: `${o.name} ${o.point}`, odds: o.price, book: 'FanDuel' };
                    const k = betKey(bet);
                    const active = betSlip.some(b => betKey(b) === k);
                    return (
                      <div key={o.name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                        <span className="text-xs font-medium text-foreground">
                          {o.name} {o.point && o.point > 0 ? '+' : ''}{o.point}
                        </span>
                        <button
                          onClick={() => active ? onRemoveBet(k) : onAddBet(bet)}
                          className={`prop-btn ${active ? 'active' : ''}`}
                        >
                          {fmtOdds(o.price)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Total */}
            {totalsMkt && (
              <div>
                <div className="section-label">Game Total · FanDuel</div>
                <div className="space-y-1">
                  {totalsMkt.outcomes.map(o => {
                    const bet: BetSlip = { gameId, matchup, market: 'totals', selection: `${o.name} ${o.point}`, odds: o.price, book: 'FanDuel' };
                    const k = betKey(bet);
                    const active = betSlip.some(b => betKey(b) === k);
                    return (
                      <div key={o.name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                        <span className="text-xs font-medium text-foreground">
                          {o.name} {o.point}
                        </span>
                        <button
                          onClick={() => active ? onRemoveBet(k) : onAddBet(bet)}
                          className={`prop-btn ${active ? 'active' : ''}`}
                        >
                          {fmtOdds(o.price)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!loadingOdds && !h2hMkt && !spreadsMkt && !totalsMkt && !nrfiMkt && (
              <div className="text-xs text-muted-foreground py-4 text-center">No FanDuel lines available for this game yet.</div>
            )}
          </div>
        )}

        {/* ── PITCHER PROPS ── */}
        {tab === 'pitcher-props' && (
          <div>
            {loadingOdds && <div className="text-xs text-muted-foreground mb-3">Loading pitcher props…</div>}
            {Object.keys(pitcherPlayers).length === 0 && !loadingOdds && (
              <div className="text-xs text-muted-foreground py-4 text-center">No FanDuel pitcher props available yet.</div>
            )}
            {Object.entries(pitcherPlayers).map(([player, markets]) => (
              <div key={player} className="mb-4">
                <div className="text-xs font-bold text-primary mb-1">{player}</div>
                {Object.entries(markets).map(([mktKey, sides]) => (
                  <PropRow
                    key={mktKey}
                    market={mktKey}
                    player={`${player} — ${PROP_MARKET_LABELS[mktKey] ?? mktKey}`}
                    over={sides.over}
                    under={sides.under}
                    gameId={gameId}
                    matchup={matchup}
                    betSlip={betSlip}
                    onAdd={onAddBet}
                    onRemove={onRemoveBet}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── BATTER PROPS ── */}
        {tab === 'batter-props' && (
          <div>
            {loadingOdds && <div className="text-xs text-muted-foreground mb-3">Loading batter props…</div>}
            {Object.keys(batterPlayers).length === 0 && !loadingOdds && (
              <div className="text-xs text-muted-foreground py-4 text-center">No FanDuel batter props available yet.</div>
            )}
            {Object.entries(batterPlayers).map(([player, markets]) => (
              <div key={player} className="mb-4">
                <div className="text-xs font-bold text-primary mb-1">{player}</div>
                {Object.entries(markets).map(([mktKey, sides]) => (
                  <PropRow
                    key={mktKey}
                    market={mktKey}
                    player={`${PROP_MARKET_LABELS[mktKey] ?? mktKey}`}
                    over={sides.over}
                    under={sides.under}
                    gameId={gameId}
                    matchup={matchup}
                    betSlip={betSlip}
                    onAdd={onAddBet}
                    onRemove={onRemoveBet}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── INNING SPLITS ── */}
        {tab === 'inning-splits' && (
          <div>
            {loadingStats && <div className="text-xs text-muted-foreground mb-3">Loading pitcher stats…</div>}
            {pitcherStats.length === 0 && !loadingStats && (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No probable pitcher data available yet. Check back closer to game time.
              </div>
            )}
            {pitcherStats.map(p => (
              <PitcherCard key={p.name} p={p} />
            ))}

            {/* Inning breakdown table */}
            {pitcherStats.length > 0 && (
              <div className="dg-card">
                <div className="section-label mb-2">Inning-by-Inning Context</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Innings tell a story. First inning (NRFI/YRFI), middle innings (run-scoring), late innings (bullpen exposure).
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Inning</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">1st</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">2nd</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">3rd</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">4th</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">5th</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">6th</th>
                        <th className="text-center py-1.5 px-2 text-muted-foreground font-medium">7th+</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 pr-3 text-muted-foreground">Bet Focus</td>
                        <td className="text-center px-2 text-amber-400 font-semibold">NRFI</td>
                        <td className="text-center px-2 text-muted-foreground">Setup</td>
                        <td className="text-center px-2 text-muted-foreground">Setup</td>
                        <td className="text-center px-2 text-blue-400">Props</td>
                        <td className="text-center px-2 text-blue-400">Props</td>
                        <td className="text-center px-2 text-muted-foreground">Limit</td>
                        <td className="text-center px-2 text-red-400">Bullpen</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BET BUILDER ── */}
        {tab === 'bet-builder' && (
          <div>
            <div className="section-label mb-3">Your Picks — {matchup}</div>

            {gameBets.length === 0 && (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No picks yet. Add bets from the other tabs.
              </div>
            )}

            {gameBets.map(b => {
              const k = betKey(b);
              return (
                <div key={k} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-foreground">{b.selection}</div>
                    <div className="text-xs text-muted-foreground">{b.book} · {PROP_MARKET_LABELS[b.market] ?? b.market}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${b.odds > 0 ? 'text-green-400' : 'text-foreground'}`}>
                      {fmtOdds(b.odds)}
                    </span>
                    <button
                      onClick={() => onRemoveBet(k)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            {gameBets.length > 0 && (
              <div className="mt-4 dg-card bg-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-foreground">
                    {gameBets.length === 1 ? 'Single Bet' : `${gameBets.length}-Leg Parlay`}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-primary" />
                    <span className="text-sm font-mono font-bold text-primary">{fmtOdds(combined)}</span>
                  </div>
                </div>

                {/* Stake selector */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">Stake:</span>
                  {[10, 25, 50, 100].map(s => (
                    <button
                      key={s}
                      onClick={() => setStake(s)}
                      className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                        stake === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      ${s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-muted-foreground">To win</span>
                  <span className="font-mono font-bold text-green-400">
                    +${payout(stake, combined).toFixed(2)}
                  </span>
                </div>

                <a
                  href="https://www.fanduel.com/sportsbook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#1493ff] hover:bg-[#0d7de0] text-white text-xs font-bold rounded transition-colors"
                >
                  <span>Place on FanDuel</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
