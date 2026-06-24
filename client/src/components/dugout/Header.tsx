import { KeyRound, RefreshCw, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderProps {
  onKeyClick: () => void;
  activeKey: string;
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

export default function Header({ onKeyClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight text-foreground font-[IBM_Plex_Sans]">
          ⚾ <span className="text-primary">The</span> Dugout
        </span>
        <span className="hidden sm:block text-xs text-muted-foreground ml-2 font-mono">
          {formatDate()}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Dark / Light toggle */}
        {toggleTheme && (
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {/* API key manager */}
        <button
          onClick={onKeyClick}
          title="Manage API Keys"
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <KeyRound size={16} />
        </button>

        {/* Hard refresh */}
        <button
          onClick={() => window.location.reload()}
          title="Refresh"
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </header>
  );
}
