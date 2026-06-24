/**
 * PlayerPropsTab — FanDuel SGP-style layout
 *
 * Matches the screenshot exactly:
 *   - Game selector header: team logos (initials circles) + date + time
 *   - Collapsible market sections with [SGP] badge
 *   - Player rows: headshot circle + name + Last 5 AVG + threshold columns (1+, 2+, 3+, 4+)
 *   - Blue-outlined odds buttons (FD style), selected = blue fill
 *   - Sticky betslip bar at bottom: leg count + "$10 N-leg parlay wins $X.XX"
 *   - Tapping player name/avatar opens PlayerDetailPanel
 */

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PlayerDetailPanel, { type PlayerInfo, type PropLine } from '@/components/dugout/PlayerDetailPanel';
import { useBetSlip } from '@/contexts/BetSlipContext';

// ── Types ────────────────────────────────────────────────────────────────────
type Market = 'h2h' | 'hr' | 'hits' | 'total_bases' | 'ks' | 'yrfi' | 'first_five';

interface OddsButton {
  label: string;
  odds: number;
  over: boolean;
}

interface PlayerRow {
  playerId: string;
  name: string;
  teamAbbrev: string;
  last5Avg: string;
  buttons: OddsButton[];
}

interface MarketSection {
  id: string;
  label: string;
  players: PlayerRow[];
  isSGP: boolean;
}

interface GameGroup {
  gamePk: string;
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  gameDate: string;
  sections: MarketSection[];
}

// ── Team colors ───────────────────────────────────────────────────────────────
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

// ── Mock data ─────────────────────────────────────────────────────────────────
const BATTER_NAMES: Record<string, { name: string; last5: string }[]> = {
  NYY: [
    { name: 'Aaron Judge',       last5: '.476 AVG' },
    { name: 'Juan Soto',         last5: '.333 AVG' },
    { name: 'Giancarlo Stanton', last5: '.200 AVG' },
    { name: 'Gleyber Torres',    last5: '.286 AVG' },
    { name: 'Paul Goldschmidt',  last5: '.222 AVG' },
    { name: 'Ben Rice',          last5: '.190 AVG' },
  ],
  DET: [
    { name: 'Spencer Torkelson', last5: '.250 AVG' },
    { name: 'Riley Greene',      last5: '.350 AVG' },
    { name: 'Dillon Dingler',    last5: '.476 AVG' },
    { name: 'Matt Vierling',     last5: '.200 AVG' },
    { name: 'Cody Bellinger',    last5: '.200 AVG' },
    { name: 'Wenceel Perez',     last5: '.238 AVG' },
  ],
  BOS: [
    { name: 'Rafael Devers',     last5: '.333 AVG' },
    { name: 'Triston Casas',     last5: '.286 AVG' },
    { name: 'Jarren Duran',      last5: '.400 AVG' },
    { name: 'Masataka Yoshida',  last5: '.222 AVG' },
  ],
  CLE: [
    { name: 'Jose Ramirez',      last5: '.381 AVG' },
    { name: 'Josh Naylor',       last5: '.333 AVG' },
    { name: 'Steven Kwan',       last5: '.350 AVG' },
    { name: 'David Fry',         last5: '.200 AVG' },
  ],
  KC: [
    { name: 'Bobby Witt Jr.',    last5: '.400 AVG' },
    { name: 'Salvador Perez',    last5: '.286 AVG' },
    { name: 'Vinnie Pasquantino',last5: '.333 AVG' },
    { name: 'MJ Melendez',       last5: '.250 AVG' },
  ],
  SEA: [
    { name: 'Julio Rodriguez',   last5: '.350 AVG' },
    { name: 'Cal Raleigh',       last5: '.222 AVG' },
    { name: 'Ty France',         last5: '.286 AVG' },
    { name: 'Eugenio Suarez',    last5: '.200 AVG' },
  ],
  BAL: [
    { name: 'Gunnar Henderson',  last5: '.381 AVG' },
    { name: 'Adley Rutschman',   last5: '.333 AVG' },
    { name: 'Anthony Santander', last5: '.286 AVG' },
    { name: 'Ryan Mountcastle',  last5: '.250 AVG' },
  ],
  LAD: [
    { name: 'Freddie Freeman',   last5: '.350 AVG' },
    { name: 'Mookie Betts',      last5: '.333 AVG' },
    { name: 'Will Smith',        last5: '.286 AVG' },
    { name: 'Max Muncy',         last5: '.200 AVG' },
  ],
};

const PITCHER_NAMES: Record<string, { name: string; last5: string }[]> = {
  NYY: [{ name: 'Gerrit Cole',    last5: '8.2 K/G' }, { name: 'Carlos Rodon', last5: '7.1 K/G' }],
  DET: [{ name: 'Tarik Skubal',   last5: '9.4 K/G' }, { name: 'Casey Mize',   last5: '6.8 K/G' }],
  BOS: [{ name: 'Brayan Bello',   last5: '7.3 K/G' }, { name: 'Tanner Houck', last5: '6.5 K/G' }],
  CLE: [{ name: 'Tanner Bibee',   last5: '8.1 K/G' }, { name: 'Logan Allen',  last5: '6.2 K/G' }],
  KC:  [{ name: 'Cole Ragans',    last5: '9.0 K/G' }, { name: 'Brady Singer', last5: '7.4 K/G' }],
  SEA: [{ name: 'Luis Castillo',  last5: '8.5 K/G' }, { name: 'Bryan Woo',    last5: '7.0 K/G' }],
  BAL: [{ name: 'Corbin Burnes',  last5: '9.2 K/G' }, { name: 'Dean Kremer',  last5: '6.8 K/G' }],
  LAD: [{ name: 'Tyler Glasnow',  last5: '10.1 K/G'}, { name: 'Bobby Miller', last5: '7.5 K/G' }],
};

const GAMES_META = [
  { gamePk: '1', awayTeam: 'NYY', homeTeam: 'DET', gameTime: '6:41 PM ET', gameDate: 'Wed, Jun 24' },
  { gamePk: '2', awayTeam: 'BOS', homeTeam: 'CLE', gameTime: '7:10 PM ET', gameDate: 'Wed, Jun 24' },
  { gamePk: '3', awayTeam: 'KC',  homeTeam: 'SEA', gameTime: '4:11 PM ET', gameDate: 'Wed, Jun 24' },
  { gamePk: '4', awayTeam: 'BAL', homeTeam: 'LAD', gameTime: '10:10 PM ET', gameDate: 'Wed, Jun 24' },
];

function makeHitsButtons(seed: number): OddsButton[] {
  const base = [
    { label: '0.5+', odds: -(220 + (seed % 60)), over: true },
    { label: '1+',   odds: -(200 + (seed % 80)), over: true },
    { label: '2+',   odds: +(180 + (seed % 100)), over: true },
    { label: '3+',   odds: +(900 + (seed % 500)), over: true },
    { label: '4+',   odds: +(2500 + (seed % 800)), over: true },
  ];
  return base;
}

function makeHRButtons(seed: number): OddsButton[] {
  return [
    { label: '0.5+', odds: +(130 + (seed % 100)), over: true },
    { label: '1+',   odds: +(380 + (seed % 200)), over: true },
    { label: '2+',   odds: +(1400 + (seed % 600)), over: true },
  ];
}

function makeKButtons(seed: number): OddsButton[] {
  return [
    { label: '3+', odds: -(1800 + (seed % 1500)), over: true },
    { label: '4+', odds: -(350 + (seed % 400)), over: true },
    { label: '5+', odds: -(80 + (seed % 150)), over: true },
    { label: '6+', odds: +(120 + (seed % 180)), over: true },
    { label: '7+', odds: +(280 + (seed % 250)), over: true },
    { label: '8+', odds: +(500 + (seed % 300)), over: true },
  ];
}

function makeTBButtons(seed: number): OddsButton[] {
  return [
    { label: '1+', odds: -(180 + (seed % 80)), over: true },
    { label: '2+', odds: +(110 + (seed % 80)), over: true },
    { label: '3+', odds: +(220 + (seed % 120)), over: true },
    { label: '4+', odds: +(380 + (seed % 180)), over: true },
    { label: '5+', odds: +(650 + (seed % 300)), over: true },
  ];
}

function nameHash(s: string): number {
  return Math.abs(s.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 1000;
}

function buildGameSections(game: typeof GAMES_META[0]): MarketSection[] {
  const awayBatters = BATTER_NAMES[game.awayTeam] ?? [];
  const homeBatters = BATTER_NAMES[game.homeTeam] ?? [];
  const allBatters = [...awayBatters.slice(0, 3), ...homeBatters.slice(0, 3)];

  const awayPitchers = PITCHER_NAMES[game.awayTeam] ?? [];
  const homePitchers = PITCHER_NAMES[game.homeTeam] ?? [];
  const allPitchers = [...awayPitchers.slice(0, 1), ...homePitchers.slice(0, 1)];

  const toRow = (p: { name: string; last5: string }, market: string): PlayerRow => {
    const seed = nameHash(p.name);
    const buttons =
      market === 'hits' ? makeHitsButtons(seed)
      : market === 'hr' ? makeHRButtons(seed)
      : market === 'ks' ? makeKButtons(seed)
      : makeTBButtons(seed);
    return {
      playerId: `${game.gamePk}-${p.name.replace(/\s/g, '-')}-${market}`,
      name: p.name,
      teamAbbrev: awayBatters.some(b => b.name === p.name) ? game.awayTeam
                : homeBatters.some(b => b.name === p.name) ? game.homeTeam
                : awayPitchers.some(b => b.name === p.name) ? game.awayTeam
                : game.homeTeam,
      last5Avg: p.last5,
      buttons,
    };
  };

  // Total Strikeouts O/U (game total, not per-player)
  const ksOUSeed = nameHash(game.gamePk + 'ks');
  const ksLine = (14 + (ksOUSeed % 6) * 0.5).toFixed(1);
  const ksOUPlayers: PlayerRow[] = [
    {
      playerId: `${game.gamePk}-ks-ou`,
      name: `${game.awayTeam} @ ${game.homeTeam} — Total Ks`,
      teamAbbrev: '',
      last5Avg: '',
      buttons: [
        { label: `O ${ksLine}`, odds: -115 + (ksOUSeed % 20) - 10, over: true },
        { label: `U ${ksLine}`, odds: -105 + (ksOUSeed % 20) - 10, over: false },
      ],
    },
  ];

  // 1st Inning O/U
  const f1Seed = nameHash(game.gamePk + 'f1');
  const f1Line = (0.5).toFixed(1);
  const f1Players: PlayerRow[] = [
    {
      playerId: `${game.gamePk}-f1-ou`,
      name: `${game.awayTeam} @ ${game.homeTeam} — 1st Inning`,
      teamAbbrev: '',
      last5Avg: '',
      buttons: [
        { label: `O ${f1Line}`, odds: -130 + (f1Seed % 30) - 15, over: true },
        { label: `U ${f1Line}`, odds: +110 + (f1Seed % 20) - 10, over: false },
      ],
    },
  ];

  return [
    {
      id: 'ks-ou',
      label: 'Total Strikeouts O/U',
      players: ksOUPlayers,
      isSGP: true,
    },
    {
      id: 'hr',
      label: 'Player Home Runs',
      players: allBatters.map(p => toRow(p, 'hr')),
      isSGP: true,
    },
    {
      id: 'hits',
      label: 'Player Hits',
      players: allBatters.map(p => toRow(p, 'hits')),
      isSGP: true,
    },
    {
      id: 'ks',
      label: 'Player Strikeouts',
      players: allPitchers.map(p => toRow(p, 'ks')),
      isSGP: true,
    },
    {
      id: 'tb',
      label: 'Player Total Bases',
      players: allBatters.map(p => toRow(p, 'tb')),
      isSGP: true,
    },
    {
      id: 'f1-ou',
      label: '1st Inning O/U',
      players: f1Players,
      isSGP: true,
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtOdds(o: number): string {
  return o > 0 ? `+${o}` : `${o}`;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function calcParlayPayout(legs: { odds: number }[], stake: number): number {
  if (legs.length === 0) return 0;
  const dec = legs.map(l => l.odds > 0 ? l.odds / 100 + 1 : 100 / Math.abs(l.odds) + 1);
  const product = dec.reduce((a, b) => a * b, 1);
  return parseFloat((stake * product - stake).toFixed(2));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TeamBadge({ abbrev }: { abbrev: string }) {
  const color = TEAM_COLORS[abbrev] ?? '#4f46e5';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 border-2 border-white/20"
      style={{ background: color }}
    >
      {abbrev}
    </div>
  );
}

function PlayerAvatar({ name, teamAbbrev }: { name: string; teamAbbrev: string }) {
  const color = TEAM_COLORS[teamAbbrev] ?? '#4f46e5';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 border-2 border-white/20"
      style={{ background: color }}
    >
      {initials(name)}
    </div>
  );
}

function SGPBadge() {
  return (
    <span
      className="text-[10px] font-black px-1.5 py-0.5 rounded"
      style={{ background: '#1a1a2e', color: '#f5c518', border: '1px solid #f5c518', letterSpacing: '0.05em' }}
    >
      SGP
    </span>
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
      className={`flex flex-col items-center justify-center min-w-[64px] h-14 rounded-lg border-2 text-sm font-semibold transition-all duration-150 active:scale-95 shrink-0 ${
        selected
          ? 'border-[#1493ff] bg-[#1493ff] text-white shadow-lg shadow-blue-500/30'
          : 'border-[#1493ff] bg-transparent text-[#1493ff] hover:bg-[#1493ff]/10'
      }`}
    >
      <span className={`text-[11px] font-medium ${selected ? 'text-blue-100' : 'text-[#1493ff]/70'}`}>
        {btn.label}
      </span>
      <span className={`text-sm font-bold ${selected ? 'text-white' : 'text-[#1493ff]'}`}>
        {fmtOdds(btn.odds)}
      </span>
    </button>
  );
}

// ── Market section (collapsible) ──────────────────────────────────────────────
function MarketSectionBlock({
  section,
  selected,
  onToggle,
  onPlayerTap,
  defaultOpen,
}: {
  section: MarketSection;
  selected: Set<string>;
  onToggle: (key: string, player: PlayerRow, btn: OddsButton) => void;
  onPlayerTap: (player: PlayerRow) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Column headers from first player's buttons
  const headers = section.players[0]?.buttons.map(b => b.label) ?? [];
  const isMultiCol = headers.length > 1;

  return (
    <div className="border-b border-gray-200 dark:border-white/10">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900 dark:text-white">{section.label}</span>
          {section.isSGP && <SGPBadge />}
        </div>
        {open
          ? <ChevronUp size={18} className="text-gray-400 dark:text-white/40" />
          : <ChevronDown size={18} className="text-gray-400 dark:text-white/40" />
        }
      </button>

      {/* Expanded content */}
      {open && (
        <div className="pb-2">
          {/* "Listed player must start" note + column headers */}
          {isMultiCol && section.players.length > 0 && (
            <div className="px-4 pb-2">
              <div className="text-xs text-gray-500 dark:text-white/40 mb-2">Listed player must start.</div>
              {/* Column header row */}
              <div className="flex items-center gap-3 pl-[52px]">
                <div className="flex-1 min-w-0" />
                <div className="flex gap-2">
                  {headers.map(h => (
                    <div key={h} className="min-w-[64px] text-center text-xs font-bold text-gray-500 dark:text-white/40">
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player rows */}
          <div className="space-y-1 px-4">
            {section.players.map(player => (
              <div
                key={player.playerId}
                className="flex items-center gap-3 py-2"
              >
                {/* Avatar — tappable */}
                <button
                  onClick={() => onPlayerTap(player)}
                  className="shrink-0 focus:outline-none"
                  aria-label={`View ${player.name} details`}
                >
                  {player.teamAbbrev
                    ? <PlayerAvatar name={player.name} teamAbbrev={player.teamAbbrev} />
                    : <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-white/40">⚾</div>
                  }
                </button>

                {/* Name + last 5 */}
                <button
                  className="flex-1 min-w-0 text-left focus:outline-none"
                  onClick={() => onPlayerTap(player)}
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white truncate hover:text-[#1493ff] transition-colors">
                    {player.name}
                  </div>
                  {player.last5Avg && (
                    <div className="text-xs text-gray-500 dark:text-white/40">
                      LAST 5 AVG: {player.last5Avg}
                    </div>
                  )}
                </button>

                {/* Odds buttons */}
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {player.buttons.map(btn => {
                    const key = `${player.playerId}-${btn.label}`;
                    return (
                      <OddsBtn
                        key={key}
                        btn={btn}
                        selected={selected.has(key)}
                        onToggle={() => onToggle(key, player, btn)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* See all */}
          <button className="ml-4 mt-1 text-sm text-[#1493ff] hover:text-blue-400 font-medium">
            See all
          </button>
        </div>
      )}
    </div>
  );
}

// ── Game selector ─────────────────────────────────────────────────────────────
function GameSelector({
  games,
  activeIdx,
  onSelect,
}: {
  games: GameGroup[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 py-3 border-b border-gray-200 dark:border-white/10" style={{ scrollbarWidth: 'none' }}>
      {games.map((g, i) => (
        <button
          key={g.gamePk}
          onClick={() => onSelect(i)}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 shrink-0 transition-all ${
            activeIdx === i
              ? 'border-[#1493ff] bg-[#1493ff]/10'
              : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-[#1493ff]/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <TeamBadge abbrev={g.awayTeam} />
            <span className="text-xs text-gray-500 dark:text-white/40 font-semibold">@</span>
            <TeamBadge abbrev={g.homeTeam} />
          </div>
          <div className="text-xs font-bold text-gray-700 dark:text-white/80">{g.awayTeam} @ {g.homeTeam}</div>
          <div className="text-xs text-gray-500 dark:text-white/40">{g.gameTime}</div>
        </button>
      ))}
    </div>
  );
}

// ── Build PlayerInfo for detail panel ─────────────────────────────────────────
function buildPlayerInfo(player: PlayerRow, market: string): PlayerInfo {
  const isPitcher = market === 'ks';
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
      value: isPitcher ? Math.floor(3 + Math.random() * 6) : Math.floor(Math.random() * 4),
      hit: !isPitcher && Math.random() > 0.4,
    })),
  };
}

function buildPropLines(player: PlayerRow, market: string): PropLine[] {
  const marketKey = market === 'ks' ? 'pitcher_strikeouts'
    : market === 'hr' ? 'batter_home_runs'
    : market === 'tb' ? 'batter_total_bases'
    : 'batter_hits';
  const mainLine = player.buttons[Math.floor(player.buttons.length / 2)];
  const point = parseFloat(mainLine?.label?.replace('+', '').replace('O ', '').replace('U ', '') ?? '1');
  return [{
    market: marketKey,
    label: market === 'ks' ? 'Strikeouts' : market === 'hr' ? 'Home Runs' : market === 'tb' ? 'Total Bases' : 'Hits',
    point,
    overOdds: mainLine?.odds ?? -110,
    underOdds: -(mainLine?.odds ?? -110) - 20,
    altLines: player.buttons.map(btn => ({
      threshold: parseFloat(btn.label.replace('+', '').replace('O ', '').replace('U ', '')),
      odds: btn.odds,
    })),
  }];
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayerPropsTab() {
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailPlayer, setDetailPlayer] = useState<{ player: PlayerRow; market: string } | null>(null);
  const { addLeg, removeLeg, legs } = useBetSlip();

  // Build game data once
  const games: GameGroup[] = useMemo(() =>
    GAMES_META.map(g => ({
      ...g,
      sections: buildGameSections(g),
    })),
  []);

  const activeGame = games[activeGameIdx];

  const handleToggle = useCallback((key: string, player: PlayerRow, btn: OddsButton) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        const leg = legs.find(l => l.player === player.name && l.selection === btn.label);
        if (leg) removeLeg(leg.id);
      } else {
        next.add(key);
        addLeg({
          player: player.name,
          market: 'hits',
          selection: btn.label,
          odds: btn.odds,
          game: `${activeGame.awayTeam} @ ${activeGame.homeTeam}`,
        });
      }
      return next;
    });
  }, [legs, addLeg, removeLeg, activeGame]);

  const handlePlayerTap = useCallback((player: PlayerRow) => {
    if (!player.teamAbbrev) return;
    setDetailPlayer({ player, market: 'hits' });
  }, []);

  // Payout calculation for betslip bar
  const STAKE = 10;
  const parlayPayout = calcParlayPayout(legs, STAKE);
  const totalReturn = STAKE + parlayPayout;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background, #fff)', paddingBottom: legs.length > 0 ? '72px' : '0' }}
    >
      {/* Game selector */}
      <GameSelector
        games={games}
        activeIdx={activeGameIdx}
        onSelect={setActiveGameIdx}
      />

      {/* Active game header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-[#0a1628]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TeamBadge abbrev={activeGame.awayTeam} />
            <div className="text-center">
              <div className="text-xs font-bold text-white">{activeGame.gameDate}</div>
              <div className="text-xs text-white/50">{activeGame.gameTime}</div>
            </div>
            <TeamBadge abbrev={activeGame.homeTeam} />
          </div>
          {/* SGP tab bar */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#1493ff] border-b-2 border-[#1493ff] pb-0.5">Same Game Parlay™</span>
          </div>
        </div>
      </div>

      {/* Market sections */}
      <div className="flex-1 bg-white dark:bg-[#0a1628]">
        {activeGame.sections.map((section, i) => (
          <MarketSectionBlock
            key={section.id}
            section={section}
            selected={selected}
            onToggle={handleToggle}
            onPlayerTap={handlePlayerTap}
            defaultOpen={i === 2} // "Player Hits" open by default (index 2)
          />
        ))}
      </div>

      {/* Sticky betslip bar */}
      {legs.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-white/10"
          style={{ background: '#fff', boxShadow: '0 -2px 12px rgba(0,0,0,0.12)' }}
        >
          <div className="flex items-center gap-3">
            {/* Leg count badge */}
            <div className="w-8 h-8 rounded-full bg-[#1493ff] flex items-center justify-center text-sm font-black text-white">
              {legs.length}
            </div>
            {/* Betslip label */}
            <div>
              <div className="text-sm font-bold text-gray-900">Betslip</div>
              <div className="text-xs text-gray-500">
                ${STAKE} {legs.length}-leg parlay wins{' '}
                <span className="font-bold text-gray-900">${totalReturn.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {/* Expand chevron */}
          <ChevronUp size={20} className="text-gray-400" />
        </div>
      )}

      {/* Player detail panel overlay */}
      {detailPlayer && (
        <PlayerDetailPanel
          player={buildPlayerInfo(detailPlayer.player, detailPlayer.market)}
          propLines={buildPropLines(detailPlayer.player, detailPlayer.market)}
          onClose={() => setDetailPlayer(null)}
          onAddBet={(bet) => {
            addLeg({
              player: bet.player,
              market: bet.market,
              selection: bet.selection,
              odds: bet.odds,
              game: `${activeGame.awayTeam} @ ${activeGame.homeTeam}`,
            });
          }}
        />
      )}
    </div>
  );
}
