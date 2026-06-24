/**
 * BooksTab — Live sportsbook odds + deep FanDuel research
 *
 * Design: dark terminal aesthetic, IBM Plex Mono
 * Features:
 *   - DK / FD / MGM moneyline, run line, O/U side-by-side
 *   - Best line + gap highlight
 *   - NRFI / Leo-approved badges
 *   - "Research" button per game → GameResearchDrawer
 *   - Global bet slip with combined odds
 *   - 3-key rotation manager
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useBetSlip } from '@/contexts/BetSlipContext';
import { RefreshCw, TrendingUp, ChevronRight, ShoppingCart } from 'lucide-react';
import type { useKeyManager } from '@/hooks/useKeyManager';
import GameResearchDrawer, { type BetSlip } from '../GameResearchDrawer';

type KeyManager = ReturnType<typeof useKeyManager>;
type Market = 'h2h' | 'spreads' | 'totals';

interface Outcome { name: string; price: number; point?: number; }
interface BookOdds { key: string; title: string; markets: { key: string; outcomes: Outcome[] }[] }
interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: BookOdds[];
}

const BOOKS = [
  { key: 'draftkings', label: 'DK',  cls: 'book-dk'  },
  { key: 'fanduel',    label: 'FD',  cls: 'book-fd'  },
  { key: 'betmgm',     label: 'MGM', cls: 'book-mgm' },
];

const MARKET_LABELS: Record<Market, string> = {
  h2h:     'Moneyline',
  spreads: 'Run Line',
  totals:  'O/U',
};

// Leo-approved NRFI leans — updated from pipeline daily
const NRFI_LEANS: string[] = [
  'Chicago Cubs @ New York Mets',
  'Cleveland Guardians @ Chicago White Sox',
  'Texas Rangers @ Miami Marlins',
];

function fmtOdds(n: number) { return n > 0 ? `+${n}` : `${n}`; }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function bestLine(game: Game, market: Market) {
  let best: { price: number; book: string } | null = null;
  for (const bm of game.bookmakers) {
    if (!BOOKS.find(b => b.key === bm.key)) continue;
    const mkt = bm.markets.find(m => m.key === market);
    if (!mkt) continue;
    const fav = mkt.outcomes.reduce((a, b) => a.price < b.price ? a : b);
    if (!best || fav.price > best.price) {
      best = { price: fav.price, book: BOOKS.find(b => b.key === bm.key)!.label };
    }
  }
  if (!best) return null;
  let worst = best.price;
  for (const bm of game.bookmakers) {
    if (!BOOKS.find(b => b.key === bm.key)) continue;
    const mkt = bm.markets.find(m => m.key === market);
    if (!mkt) continue;
    const fav = mkt.outcomes.reduce((a, b) => a.price < b.price ? a : b);
    if (fav.price < worst) worst = fav.price;
  }
  return { ...best, gap: Math.abs(best.price - worst) };
}

function isLeoApproved(game: Game) {
  return NRFI_LEANS.some(lean =>
    lean.toLowerCase().includes(game.away_team.toLowerCase()) ||
    lean.toLowerCase().includes(game.home_team.toLowerCase())
  );
}

function betKey(bet: Omit<BetSlip, 'gameId' | 'matchup'>) {
  return `${bet.market}:${bet.selection}:${bet.book}`;
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

interface Props {
  keyManager: KeyManager;
  onOpenKeyPanel: () => void;
}

export default function BooksTab({ keyManager, onOpenKeyPanel }: Props) {
  const { activeKey, slots, activeIdx, updateQuota } = keyManager;
  const [market, setMarket] = useState<Market>('h2h');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [openGame, setOpenGame] = useState<Game | null>(null);
  const { legs, addLeg, removeLeg, clearLegs } = useBetSlip();
  const [showSlip, setShowSlip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOdds = useCallback(async () => {
    if (!activeKey) return;
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${activeKey}&regions=us&markets=h2h,spreads,totals&bookmakers=draftkings,fanduel,betmgm&oddsFormat=american`;
      const res = await fetch(url);
      const remaining = res.headers.get('x-requests-remaining');
      if (remaining !== null) {
        const q = parseInt(remaining, 10);
        setQuota(q);
        updateQuota(activeIdx, q);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      const data: Game[] = await res.json();
      setGames(data);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load odds');
    } finally {
      setLoading(false);
    }
  }, [activeKey, activeIdx, updateQuota]);

  useEffect(() => {
    fetchOdds();
    timerRef.current = setInterval(fetchOdds, 3 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchOdds]);

  // Adapt BooksTab BetSlip shape → global BetLeg
  function addBet(bet: BetSlip) {
    addLeg({
      player: bet.matchup,
      market: bet.market,
      selection: bet.selection,
      odds: bet.odds,
      game: bet.matchup,
    });
  }

  function removeBet(k: string) {
    // k = "market:selection:book" — find matching leg
    const [market, selection] = k.split(':');
    const leg = legs.find(l => l.market === market && l.selection === selection);
    if (leg) removeLeg(leg.id);
  }

  // Build a BetSlip[] view from global legs for GameResearchDrawer
  const betSlip: BetSlip[] = legs.map(l => ({
    gameId: '',
    matchup: l.game,
    market: l.market,
    selection: l.selection,
    odds: l.odds,
    book: 'FD',
  }));

  const activeSlot = slots[activeIdx];
  const combined = combinedOdds(betSlip);

  return (
    <div className="p-4 max-w-4xl mx-auto relative">
      {/* Sub-header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {(['h2h', 'spreads', 'totals'] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                market === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {MARKET_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Bet slip button */}
          {betSlip.length > 0 && (
            <button
              onClick={() => setShowSlip(!showSlip)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold bg-[#1493ff]/15 text-[#1493ff] border border-[#1493ff]/25 hover:bg-[#1493ff]/25 transition-colors"
            >
              <ShoppingCart size={11} />
              Slip ({betSlip.length}) · {combined > 0 ? '+' : ''}{combined}
            </button>
          )}
          {/* Quota chip */}
          {quota !== null && (
            <span
              className={`quota-chip ${quota === 0 ? 'danger' : quota < 50 ? 'warn' : ''}`}
              title="Remaining API requests"
            >
              {quota} left
            </span>
          )}
          {activeSlot && (
            <span className="text-xs text-muted-foreground font-mono">
              {activeSlot.label}
            </span>
          )}
          <button
            onClick={fetchOdds}
            disabled={loading}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
            title="Refresh odds"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Status bar */}
      {lastUpdated && !loading && (
        <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Live · {games.length} games · updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          <span className="text-muted-foreground/50 ml-1">· Click any game to research on FanDuel</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="dg-card border-destructive/30 bg-destructive/5 mb-4">
          <div className="text-sm text-destructive mb-1">Failed to load odds</div>
          <div className="text-xs text-muted-foreground">{error}</div>
          {(error.includes('quota') || error.includes('401') || error.includes('403')) && (
            <button onClick={onOpenKeyPanel} className="mt-2 text-xs text-primary underline">
              Swap API key →
            </button>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dg-card space-y-3">
              <div className="skeleton h-3 w-48 rounded" />
              <div className="grid grid-cols-3 gap-3">
                {[0,1,2].map(j => (
                  <div key={j} className="space-y-1.5">
                    <div className="skeleton h-2 w-8 rounded" />
                    <div className="skeleton h-4 w-16 rounded" />
                    <div className="skeleton h-4 w-14 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game cards */}
      {!loading && !error && (
        <div className="space-y-3">
          {games.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No games found for today's slate.
            </div>
          )}
          {games.map(game => {
            const leo = isLeoApproved(game);
            const best = bestLine(game, market);
            const matchup = `${game.away_team} @ ${game.home_team}`;
            const gameBetCount = betSlip.filter(b => b.gameId === game.id).length;

            return (
              <div key={game.id} className={`dg-card ${leo ? 'border-amber-500/20' : ''}`}>
                {/* Game header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {fmtTime(game.commence_time)}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">{matchup}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {leo && <span className="nrfi-badge">NRFI</span>}
                    {gameBetCount > 0 && (
                      <span className="text-xs font-mono font-bold text-[#1493ff]">{gameBetCount} pick{gameBetCount > 1 ? 's' : ''}</span>
                    )}
                    <button
                      onClick={() => setOpenGame(game)}
                      className="game-expand-btn flex items-center gap-1"
                    >
                      Research <ChevronRight size={10} />
                    </button>
                  </div>
                </div>

                {/* Books grid */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {BOOKS.map(book => {
                    const bm = game.bookmakers.find(b => b.key === book.key);
                    const mkt = bm?.markets.find(m => m.key === market);
                    return (
                      <div key={book.key} className="space-y-1">
                        <div className={`text-xs font-bold ${book.cls}`}>{book.label}</div>
                        {mkt ? (
                          mkt.outcomes.map(o => (
                            <div key={o.name} className="flex items-center justify-between gap-1">
                              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                {o.name.split(' ').slice(-1)[0]}
                              </span>
                              <span className={`odds-pill ${best?.book === book.label ? 'best' : ''}`}>
                                {market === 'totals'
                                  ? `${o.name === 'Over' ? 'O' : 'U'} ${o.point} (${fmtOdds(o.price)})`
                                  : market === 'spreads'
                                  ? `${o.point && o.point > 0 ? '+' : ''}${o.point} (${fmtOdds(o.price)})`
                                  : fmtOdds(o.price)
                                }
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Best line footer */}
                {best && (
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs">
                      <TrendingUp size={11} className="text-green-400" />
                      <span className="text-muted-foreground">Best</span>
                      <span className="text-green-400 font-mono font-semibold">{fmtOdds(best.price)}</span>
                      <span className="text-muted-foreground">· {best.book}</span>
                    </div>
                    {best.gap > 0 && (
                      <span className={`text-xs font-mono font-semibold ${best.gap >= 10 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                        Δ{best.gap}
                      </span>
                    )}
                  </div>
                )}

                {/* Leo approved banner */}
                {leo && (
                  <div className="leo-badge mt-2">
                    <span>⚾</span>
                    <span>Leo approved — <strong>NRFI</strong> lean on this game</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Research drawer overlay */}
      {openGame && (
        <>
          <div className="drawer-overlay" onClick={() => setOpenGame(null)} />
          <GameResearchDrawer
            gameId={openGame.id}
            homeTeam={openGame.home_team}
            awayTeam={openGame.away_team}
            commenceTime={openGame.commence_time}
            apiKey={activeKey ?? ''}
            betSlip={betSlip}
            onAddBet={addBet}
            onRemoveBet={removeBet}
            onClose={() => setOpenGame(null)}
          />
        </>
      )}

      {/* Global bet slip panel (when no game drawer open) */}
      {showSlip && !openGame && betSlip.length > 0 && (
        <>
          <div className="drawer-overlay" onClick={() => setShowSlip(false)} />
          <div className="research-drawer" onClick={e => e.stopPropagation()}>
            <div className="research-drawer-header">
              <div className="text-sm font-bold text-foreground">Bet Slip ({betSlip.length})</div>
              <button
                onClick={() => setShowSlip(false)}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="research-drawer-body space-y-2">
              {betSlip.map(b => {
                const k = betKey(b);
                return (
                  <div key={k} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <div className="text-xs font-medium text-foreground">{b.selection}</div>
                      <div className="text-xs text-muted-foreground">{b.matchup} · {b.book}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold ${b.odds > 0 ? 'text-green-400' : 'text-foreground'}`}>
                        {fmtOdds(b.odds)}
                      </span>
                      <button
                        onClick={() => removeBet(k)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              {betSlip.length > 1 && (
                <div className="dg-card bg-primary/5 border-primary/20 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{betSlip.length}-Leg Parlay</span>
                    <span className="text-sm font-mono font-bold text-primary">
                      {combined > 0 ? '+' : ''}{combined}
                    </span>
                  </div>
                  <a
                    href="https://www.fanduel.com/sportsbook"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#1493ff] hover:bg-[#0d7de0] text-white text-xs font-bold rounded transition-colors"
                  >
                    Place on FanDuel →
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
