export type TabId =
  | 'live'
  | 'rfi'
  | 'lines'
  | 'books'
  | 'lineups'
  | 'hits'
  | 'bases'
  | 'hr'
  | 'ks'
  | 'parlays'
  | 'ladder'
  | 'community'
  | 'library';

export interface TabDef {
  id: TabId;
  label: string;
  icon: string;
  color: string; // tailwind text color class
  accentColor: string; // hex/oklch for active indicator
}

export const TABS: TabDef[] = [
  { id: 'live',      label: 'Live',      icon: '●',  color: 'text-red-400',    accentColor: '#f87171' },
  { id: 'rfi',       label: 'Y/N-RFI',  icon: '½',  color: 'text-yellow-400', accentColor: '#facc15' },
  { id: 'lines',     label: 'Lines',     icon: '≡',  color: 'text-blue-400',   accentColor: '#60a5fa' },
  { id: 'books',     label: 'Books',     icon: '📖', color: 'text-indigo-400', accentColor: '#818cf8' },
  { id: 'lineups',   label: 'Lineups',   icon: '📋', color: 'text-cyan-400',   accentColor: '#22d3ee' },
  { id: 'hits',      label: 'Hits',      icon: 'H',  color: 'text-green-400',  accentColor: '#4ade80' },
  { id: 'bases',     label: 'Bases',     icon: 'B',  color: 'text-purple-400', accentColor: '#c084fc' },
  { id: 'hr',        label: 'HR',        icon: '💣', color: 'text-red-400',    accentColor: '#f87171' },
  { id: 'ks',        label: 'Ks',        icon: 'K',  color: 'text-red-300',    accentColor: '#fca5a5' },
  { id: 'parlays',   label: 'Parlays',   icon: '🔗', color: 'text-indigo-400', accentColor: '#818cf8' },
  { id: 'ladder',    label: 'Ladder',    icon: '$',  color: 'text-amber-400',  accentColor: '#fbbf24' },
  { id: 'community', label: 'Community', icon: '💬', color: 'text-green-400',  accentColor: '#4ade80' },
  { id: 'library',   label: 'Library',   icon: '📚', color: 'text-slate-400',  accentColor: '#94a3b8' },
];
