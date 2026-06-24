/**
 * PlayerPropsTab
 * FanDuel-style player props layout:
 *   - Market filter pills: Game Lines | Home Runs | Hits | Total Bases | Strikeouts | YRFI | First Five
 *   - Games grouped with matchup header + game time
 *   - Each player row: avatar circle (initials) + name + last-5 avg + scrollable threshold columns
 *   - Tappable odds buttons — selected = indigo fill, adds to bet slip
 *   - Tapping player name/avatar opens PlayerDetailPanel full-screen overlay
 *   - Soft navy/slate background easy on the eyes
 */

import { useState, useCallback } from 'react';
import PlayerDetailPanel, { type PlayerInfo, type PropLine } from '@/components/dugout/PlayerDetailPanel';
import { useBetSlip } from '@/contexts/BetSlipContext';

// ── Types ────────────────────────────────────────────────────────────────────
type Market = 'h2h' | 'hr' | 'hits' | 'total_bases' | 'ks' | 'yrfi' | 'first_five';

interface OddsButton {
  label: string;   // e.g. "3+"
  odds: number;    // American odds
  over: boolean;
}

interface PlayerRow {
  playerId: string;
  name: string;
  teamAbbrev: string;
  last5Avg: string;  // e.g. "5.2 K/G" or ".333 AVG"
  buttons: OddsButton[];
}

interface GameGroup {
  gamePk: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  players: PlayerRow[];
  note?: string;
}

// ── Mock data generator (replaced by live API) ───────────────────────────────
function mockGames(market: Market): GameGroup[] {
  const GAMES = [
    { gamePk: '1', awayTeam: 'NYY', homeTeam: 'BOS', gameTime: '7:10 PM ET' },
    { gamePk: '2', awayTeam: 'CLE', homeTeam: 'CWS', gameTime: '4:11 PM ET' },
    { gamePk: '3', awayTeam: 'KC',  homeTeam: 'TB',  gameTime: '6:41 PM ET' },
    { gamePk: '4', awayTeam: 'SEA', homeTeam: 'PIT', gameTime: '6:41 PM ET' },
    { gamePk: '5', awayTeam: 'BAL', homeTeam: 'LAA', gameTime: '4:08 PM ET' },
  ];

  if (market === 'yrfi') {
    return GAMES.slice(0, 3).map(g => ({
      ...g,
      note: 'A run must be scored in the 1st inning',
      players: [
        {
          playerId: `${g.gamePk}-yrfi`,
          name: `${g.awayTeam} @ ${g.homeTeam} — YRFI`,
          teamAbbrev: '',
          last5Avg: '',
          buttons: [
            { label: 'Yes', odds: Math.random() > 0.5 ? -130 : +110, over: true },
            { label: 'No',  odds: Math.random() > 0.5 ? +105 : -115, over: false },
          ],
        },
      ],
    }));
  }

  if (market === 'first_five') {
    return GAMES.slice(0, 4).map(g => ({
      ...g,
      note: 'First 5 innings result',
      players: [
        {
          playerId: `${g.gamePk}-f5-ml`,
          name: `${g.awayTeam} ML (F5)`,
          teamAbbrev: g.awayTeam,
          last5Avg: '',
          buttons: [
            { label: 'ML',  odds: -115 + Math.floor(Math.random() * 40 - 20), over: true },
          ],
        },
        {
          playerId: `${g.gamePk}-f5-rl`,
          name: `${g.awayTeam} -0.5 (F5)`,
          teamAbbrev: g.awayTeam,
          last5Avg: '',
          buttons: [
            { label: '-0.5', odds: +120 + Math.floor(Math.random() * 30), over: true },
            { label: '+0.5', odds: -140 + Math.floor(Math.random() * 20 - 10), over: false },
          ],
        },
        {
          playerId: `${g.gamePk}-f5-ou`,
          name: `F5 O/U`,
          teamAbbrev: '',
          last5Avg: '',
          buttons: [
            { label: 'O 4.5', odds: -110 + Math.floor(Math.random() * 20 - 10), over: true },
            { label: 'U 4.5', odds: -110 + Math.floor(Math.random() * 20 - 10), over: false },
          ],
        },
      ],
    }));
  }

  const PITCHER_NAMES: Record<string, string[]> = {
    NYY: ['Gerrit Cole', 'Carlos Rodon'],
    BOS: ['Brayan Bello', 'Tanner Houck'],
    CLE: ['Tanner Bibee', 'Logan Allen'],
    CWS: ['Erick Fedde', 'Chris Flexen'],
    KC:  ['Cole Ragans', 'Brady Singer'],
    TB:  ['Zach Eflin', 'Shane Baz'],
    SEA: ['Bryan Woo', 'Luis Castillo'],
    PIT: ['Braxton Ashcraft', 'Paul Skenes'],
    BAL: ['Corbin Burnes', 'Dean Kremer'],
    LAA: ['Tyler Anderson', 'Patrick Sandoval'],
  };

  const BATTER_NAMES: Record<string, string[]> = {
    NYY: ['Aaron Judge', 'Juan Soto', 'Giancarlo Stanton', 'Gleyber Torres'],
    BOS: ['Rafael Devers', 'Triston Casas', 'Jarren Duran', 'Masataka Yoshida'],
    CLE: ['Jose Ramirez', 'Josh Naylor', 'Steven Kwan', 'David Fry'],
    CWS: ['Andrew Vaughn', 'Gavin Sheets', 'Elvis Andrus', 'Korey Lee'],
    KC:  ['Salvador Perez', 'Vinnie Pasquantino', 'Bobby Witt Jr.', 'MJ Melendez'],
    TB:  ['Yandy Diaz', 'Randy Arozarena', 'Junior Caminero', 'Brandon Lowe'],
    SEA: ['Julio Rodriguez', 'Cal Raleigh', 'Ty France', 'Eugenio Suarez'],
    PIT: ['Oneil Cruz', 'Bryan Reynolds', 'Connor Joe', 'Henry Davis'],
    BAL: ['Gunnar Henderson', 'Adley Rutschman', 'Anthony Santander', 'Ryan Mountcastle'],
    LAA: ['Mike Trout', 'Shohei Ohtani', 'Anthony Rendon', 'Hunter Renfroe'],
  };

  const getThresholds = (market: Market): OddsButton[] => {
    if (market === 'ks') {
      return [
        { label: '3+', odds: -(1500 + Math.floor(Math.random() * 2000)), over: true },
        { label: '4+', odds: -(300 + Math.floor(Math.random() * 700)), over: true },
        { label: '5+', odds: -(50 + Math.floor(Math.random() * 250)), over: true },
        { label: '6+', odds: +(100 + Math.floor(Math.random() * 200)), over: true },
        { label: '7+', odds: +(250 + Math.floor(Math.random() * 300)), over: true },
      ];
    }
    if (market === 'hr') {
      return [
        { label: '0.5+', odds: +(120 + Math.floor(Math.random() * 200)), over: true },
        { label: '1+',   odds: +(350 + Math.floor(Math.random() * 400)), over: true },
        { label: '2+',   odds: +(1200 + Math.floor(Math.random() * 800)), over: true },
      ];
    }
    if (market === 'total_bases') {
      return [
        { label: '1+', odds: -(200 + Math.floor(Math.random() * 100)), over: true },
        { label: '2+', odds: +(100 + Math.floor(Math.random() * 100)), over: true },
        { label: '3+', odds: +(200 + Math.floor(Math.random() * 150)), over: true },
        { label: '4+', odds: +(350 + Math.floor(Math.random() * 200)), over: true },
        { label: '5+', odds: +(600 + Math.floor(Math.random() * 400)), over: true },
      ];
    }
    // hits default
    return [
      { label: '0.5+', odds: -(250 + Math.floor(Math.random() * 100)), over: true },
      { label: '1+',   odds: -(200 + Math.floor(Math.random() * 100)), over: true },
      { label: '2+',   odds: +(150 + Math.floor(Math.random() * 100)), over: true },
      { label: '3+',   odds: +(500 + Math.floor(Math.random() * 300)), over: true },
    ];
  };

  const getLast5 = (market: Market): string => {
    if (market === 'ks') return `${(3 + Math.random() * 4).toFixed(1)} K/G`;
    if (market === 'hr') return `${(Math.random() * 0.5).toFixed(2)} HR/G`;
    if (market === 'total_bases') return `${(1 + Math.random() * 3).toFixed(1)} TB`;
    return `.${Math.floor(200 + Math.random() * 200)} AVG`;
  };

  return GAMES.map(g => {
    const isPitcher = market === 'ks';
    const awayNames = isPitcher ? PITCHER_NAMES[g.awayTeam] ?? [] : BATTER_NAMES[g.awayTeam] ?? [];
    const homeNames = isPitcher ? PITCHER_NAMES[g.homeTeam] ?? [] : BATTER_NAMES[g.homeTeam] ?? [];
    const allNames = [
      ...awayNames.slice(0, isPitcher ? 1 : 3).map(n => ({ name: n, team: g.awayTeam })),
      ...homeNames.slice(0, isPitcher ? 1 : 3).map(n => ({ name: n, team: g.homeTeam })),
    ];

    return {
      ...g,
      players: allNames.map(({ name, team }) => ({
        playerId: `${g.gamePk}-${name.replace(/\s/g, '-')}`,
        name,
        teamAbbrev: team,
        last5Avg: getLast5(market),
        buttons: getThresholds(market),
      })),
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatOdds(o: number): string {
  return o > 0 ? `+${o}` : `${o}`;
}

function oddsColor(o: number): string {
  if (o > 0) return 'text-emerald-500 dark:text-emerald-400';
  if (o < -200) return 'text-red-500 dark:text-red-400';
  return 'text-slate-700 dark:text-slate-300';
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const TEAM_COLORS: Record<string, string> = {
  NYY: '#003087', BOS: '#BD3039', CLE: '#E31937', CWS: '#27251F',
  KC:  '#004687', TB:  '#092C5C', SEA: '#005C5C', PIT: '#FDB827',
  BAL: '#DF4601', LAA: '#BA0021', ATL: '#CE1141', CHC: '#0E3386',
  CIN: '#C6011F', COL: '#33006F', DET: '#0C2340', HOU: '#EB6E1F',
  LAD: '#005A9C', MIA: '#00A3E0', MIL: '#12284B', MIN: '#002B5C',
  NYM: '#002D72', OAK: '#003831', PHI: '#E81828', SD:  '#2F241D',
  SF:  '#FD5A1E', STL: '#C41E3A', TEX: '#003278', TOR: '#134A8E',
  WSH: '#AB0003',
};

// ── Market config ─────────────────────────────────────────────────────────────
const MARKETS: { id: Market; label: string; icon: string }[] = [
  { id: 'h2h',        label: 'Game Lines',  icon: '≡' },
  { id: 'hr',         label: 'Home Runs',   icon: '💣' },
  { id: 'hits',       label: 'Hits',        icon: 'H' },
  { id: 'total_bases',label: 'Total Bases', icon: 'B' },
  { id: 'ks',         label: 'Strikeouts',  icon: 'K' },
  { id: 'yrfi',       label: 'YRFI',        icon: '½' },
  { id: 'first_five', label: 'First Five',  icon: 'F5' },
];

// ── Build PlayerInfo from a PlayerRow ─────────────────────────────────────────
function buildPlayerInfo(player: PlayerRow, market: Market): PlayerInfo {
  const isPitcher = market === 'ks';
  // Derive a stable numeric playerId from the string id (hash)
  const numId = Math.abs(
    player.playerId.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)
  ) % 1000000;

  return {
    playerId: numId,
    name: player.name,
    team: player.teamAbbrev,
    teamAbbrev: player.teamAbbrev,
    position: isPitcher ? 'P' : 'OF',
    isPitcher,
    games: 60 + Math.floor(Math.random() * 40),
    avg: isPitcher ? undefined : `.${Math.floor(240 + Math.random() * 80)}`,
    era: isPitcher ? (2.5 + Math.random() * 3).toFixed(2) : undefined,
    hr: isPitcher ? undefined : Math.floor(Math.random() * 30),
    wins: isPitcher ? Math.floor(Math.random() * 12) : undefined,
    losses: isPitcher ? Math.floor(Math.random() * 8) : undefined,
    rbi: isPitcher ? undefined : Math.floor(Math.random() * 70),
    strikeouts: isPitcher ? Math.floor(80 + Math.random() * 100) : undefined,
    ops: isPitcher ? undefined : `.${Math.floor(700 + Math.random() * 200)}`,
    whip: isPitcher ? (0.9 + Math.random() * 0.7).toFixed(2) : undefined,
    last5: Array.from({ length: 5 }, (_, i) => ({
      opp: ['NYY', 'BOS', 'CLE', 'KC', 'TB'][i],
      date: `6/${19 + i}`,
      value: isPitcher
        ? Math.floor(3 + Math.random() * 6)
        : Math.floor(Math.random() * 4),
      hit: !isPitcher && Math.random() > 0.4,
    })),
  };
}

// ── Build PropLines from a PlayerRow ─────────────────────────────────────────
function buildPropLines(player: PlayerRow, market: Market): PropLine[] {
  const marketKey = market === 'ks' ? 'pitcher_strikeouts'
    : market === 'hr' ? 'batter_home_runs'
    : market === 'total_bases' ? 'batter_total_bases'
    : 'batter_hits';

  const mainLine = player.buttons[Math.floor(player.buttons.length / 2)];
  const point = parseFloat(mainLine?.label?.replace('+', '') ?? '1');

  return [
    {
      market: marketKey,
      label: MARKETS.find(m => m.id === market)?.label ?? market,
      point,
      overOdds: mainLine?.odds ?? -110,
      underOdds: -(mainLine?.odds ?? -110) - 20,
      altLines: player.buttons.map(btn => ({
        threshold: parseFloat(btn.label.replace('+', '')),
        odds: btn.odds,
      })),
    },
  ];
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PlayerAvatar({ name, teamAbbrev }: { name: string; teamAbbrev: string }) {
  const color = TEAM_COLORS[teamAbbrev] ?? '#4f46e5';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 border-2 border-white/10"
      style={{ background: color }}
    >
      {initials(name)}
    </div>
  );
}

function OddsBtn({
  btn,
  selected,
  onToggle,
}: {
  btn: OddsButton;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-lg border text-sm font-semibold transition-all duration-150 active:scale-95 shrink-0 ${
        selected
          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <span className={`text-xs font-medium ${selected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
        {btn.label}
      </span>
      <span className={selected ? 'text-white' : oddsColor(btn.odds)}>
        {formatOdds(btn.odds)}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface PlayerPropsTabProps {
  defaultMarket?: Market;
}

export default function PlayerPropsTab({ defaultMarket = 'hits' }: PlayerPropsTabProps) {
  const [activeMarket, setActiveMarket] = useState<Market>(defaultMarket);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailPlayer, setDetailPlayer] = useState<{ player: PlayerRow; market: Market } | null>(null);
  const { addLeg, removeLeg, legs, hasLeg } = useBetSlip();

  const games = mockGames(activeMarket);

  const togglePick = useCallback((key: string, player: PlayerRow, btn: OddsButton, game: GameGroup) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Remove from global slip
        const leg = legs.find(l => l.player === player.name && l.selection === btn.label);
        if (leg) removeLeg(leg.id);
      } else {
        next.add(key);
        // Add to global slip
        addLeg({
          player: player.name,
          market: activeMarket,
          selection: btn.label,
          odds: btn.odds,
          game: `${game.awayTeam} @ ${game.homeTeam}`,
        });
      }
      return next;
    });
  }, [legs, addLeg, removeLeg, activeMarket]);

  const handlePlayerTap = useCallback((player: PlayerRow, market: Market) => {
    // Only open detail panel for real players (not YRFI / F5 rows)
    if (!player.teamAbbrev || player.playerId.includes('yrfi') || player.playerId.includes('f5')) return;
    setDetailPlayer({ player, market });
  }, []);

  const handleAddBet = useCallback((bet: { market: string; selection: string; odds: number; player: string }) => {
    const key = `${bet.player}-${bet.market}-${bet.selection}`;
    setSelected(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    addLeg({
      player: bet.player,
      market: bet.market,
      selection: bet.selection,
      odds: bet.odds,
      game: detailPlayer ? `${detailPlayer.player.teamAbbrev}` : '',
    });
  }, [addLeg, detailPlayer]);

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--props-bg, oklch(0.22 0.025 240))' }}
    >
      {/* Market filter pills */}
      <div
        className="sticky top-0 z-30 px-4 py-3 border-b border-white/10 backdrop-blur-sm"
        style={{ background: 'var(--props-bg, oklch(0.22 0.025 240))' }}
      >
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {MARKETS.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMarket(m.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                activeMarket === m.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Bet slip count */}
        {selected.size > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-white/60">{selected.size} pick{selected.size !== 1 ? 's' : ''} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Game groups */}
      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {games.map(game => (
          <div key={game.gamePk}>
            {/* Game header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-indigo-400 font-semibold text-sm hover:text-indigo-300 cursor-pointer">
                  {game.awayTeam} @ {game.homeTeam} ›
                </span>
                <span className="ml-2 text-xs text-white/50">{game.gameTime}</span>
              </div>
            </div>

            {game.note && (
              <p className="text-xs text-white/40 mb-2 italic">{game.note}</p>
            )}

            {/* Threshold header labels */}
            {game.players.length > 0 && game.players[0].buttons.length > 1 && (
              <div className="flex items-center gap-3 mb-1 pl-[52px]">
                <div className="flex-1 min-w-0" />
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {game.players[0].buttons.map(btn => (
                    <div
                      key={btn.label}
                      className="min-w-[64px] text-center text-xs text-white/40 font-semibold"
                    >
                      {btn.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Player rows */}
            <div className="space-y-2">
              {game.players.map(player => (
                <div
                  key={player.playerId}
                  className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 border border-white/8 hover:bg-white/8 transition-colors"
                >
                  {/* Avatar — tappable to open detail */}
                  <button
                    onClick={() => handlePlayerTap(player, activeMarket)}
                    className="shrink-0 focus:outline-none"
                    aria-label={`View ${player.name} details`}
                  >
                    <PlayerAvatar name={player.name} teamAbbrev={player.teamAbbrev} />
                  </button>

                  {/* Name + last 5 — also tappable */}
                  <button
                    className="flex-1 min-w-0 text-left focus:outline-none"
                    onClick={() => handlePlayerTap(player, activeMarket)}
                  >
                    <div className="text-sm font-semibold text-white truncate hover:text-indigo-300 transition-colors">
                      {player.name}
                    </div>
                    {player.last5Avg && (
                      <div className="text-xs text-white/50">LAST 5 AVG: {player.last5Avg}</div>
                    )}
                  </button>

                  {/* Threshold odds buttons */}
                  <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {player.buttons.map(btn => {
                      const key = `${player.playerId}-${btn.label}`;
                      return (
                        <OddsBtn
                          key={key}
                          btn={btn}
                          selected={selected.has(key)}
                          onToggle={() => togglePick(key, player, btn, game)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* See all link */}
            <button className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 pl-[52px]">
              See all ›
            </button>

            {/* Divider */}
            <div className="mt-4 border-b border-white/10" />
          </div>
        ))}
      </div>

      {/* Floating bet slip */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-slate-900/95 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                {selected.size}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Betslip</div>
                <div className="text-xs text-white/50">{selected.size} leg parlay</div>
              </div>
            </div>
            <a
              href="https://sportsbook.fanduel.com/baseball/mlb"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
            >
              Place on FanDuel →
            </a>
          </div>
        </div>
      )}

      {/* Player Detail Panel — full-screen overlay */}
      {detailPlayer && (
        <PlayerDetailPanel
          player={buildPlayerInfo(detailPlayer.player, detailPlayer.market)}
          propLines={buildPropLines(detailPlayer.player, detailPlayer.market)}
          onAddBet={handleAddBet}
          onClose={() => setDetailPlayer(null)}
        />
      )}
    </div>
  );
}
