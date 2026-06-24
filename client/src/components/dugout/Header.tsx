import { KeyRound, RefreshCw } from 'lucide-react';

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
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold tracking-tight text-foreground font-[IBM_Plex_Sans]">
          ⚾ <span className="text-primary">The</span> Dugout
        </span>
        <span className="hidden sm:block text-xs text-muted-foreground ml-2 font-mono">
          {formatDate()}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onKeyClick}
          title="Manage API Keys"
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <KeyRound size={14} />
        </button>
        <button
          onClick={() => window.location.reload()}
          title="Refresh"
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
}
