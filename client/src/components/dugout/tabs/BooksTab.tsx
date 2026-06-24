import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import type { useKeyManager } from '@/hooks/useKeyManager';

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

// Leo-approved NRFI leans — update daily from pipeline
const NRFI_LEANS: string[] = [
  'Chicago Cubs @ New York Mets',
  'Cleveland Guardians @ Chicago White Sox',
  'Texas Rangers @ Miami Marlins',
];

function fmtOdds(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function bestLine(game: Game, market: Market): { price: number; book: string; gap: number } | null {
  let best: { price: number; book: string } | null = null;
  for (const bm of game.bookmakers) {
    if (!BOOKS.find(b => b.key === bm.key)) continue;
    const mkt = bm.markets.find(m => m.key === market);
    if (!mkt) continue;
    // For h2h/spreads: best line for favorite (lowest negative or highest positive)
    const fav = mkt.outcomes.reduce((a, b) => a.price < b.price ? a : b);
    if (!best || fav.price > best.price) {
      best = { price: fav.price, book: BOOKS.find(b => b.key === bm.key)!.label };
    }
  }
  if (!best) return null;
  // Calculate gap between best and worst
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
  const matchup = `${game.away_team} @ ${game.home_team}`;
  return NRFI_LEANS.some(lean =>
    lean.toLowerCase().includes(game.away_team.toLowerCase()) ||
    lean.toLowerCase().includes(game.home_team.toLowerCase())
  ) || NRFI_LEANS.includes(matchup);
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
        throw new Error(body.message ?? `HTTP ${res.status}`);
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

  const activeSlot = slots[activeIdx];

  return (
    <div className="p-4 max-w-4xl mx-auto">
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
          {/* Quota chip */}
          {quota !== null && (
            <span
              className={`quota-chip ${quota === 0 ? 'danger' : quota < 50 ? 'warn' : ''}`}
              title="Remaining API requests"
            >
              {quota} req left
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
          Live · {games.length} games · {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="dg-card border-destructive/30 bg-destructive/5 mb-4">
          <div className="text-sm text-destructive mb-1">Failed to load odds</div>
          <div className="text-xs text-muted-foreground">{error}</div>
          {error.includes('quota') || error.includes('401') ? (
            <button
              onClick={onOpenKeyPanel}
              className="mt-2 text-xs text-primary underline"
            >
              Swap API key →
            </button>
          ) : null}
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

            return (
              <div key={game.id} className={`dg-card ${leo ? 'border-amber-500/20' : ''}`}>
                {/* Game header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {fmtTime(game.commence_time)}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{matchup}</span>
                  </div>
                  {leo && <span className="nrfi-badge">NRFI</span>}
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
                              <span className={`odds-pill ${
                                best?.book === book.label ? 'best' : ''
                              }`}>
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
                      <span className="text-muted-foreground">Best line</span>
                      <span className="text-green-400 font-mono font-semibold">{fmtOdds(best.price)}</span>
                      <span className="text-muted-foreground">· {best.book}</span>
                    </div>
                    {best.gap > 0 && (
                      <span className={`text-xs font-mono font-semibold ${
                        best.gap >= 10 ? 'text-amber-400' : 'text-muted-foreground'
                      }`}>
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
    </div>
  );
}
