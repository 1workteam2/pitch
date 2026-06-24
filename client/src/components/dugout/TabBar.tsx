/**
 * TabBar — enlarged, always-labeled navigation
 *
 * Each tab shows icon + label at all times.
 * Active tab gets a colored underline + tinted background.
 * Groups are separated by subtle dividers.
 * Height: ~48px — comfortable tap target, still compact.
 */
import { useRef, useEffect } from 'react';
import { TABS, type TabId } from '@/lib/tabs';

// Logical groups — shown as subtle dividers
const GROUPS: { ids: TabId[]; label: string }[] = [
  { label: 'Game',   ids: ['live', 'rfi', 'lines', 'books', 'lineups'] },
  { label: 'Props',  ids: ['hits', 'bases', 'hr', 'ks'] },
  { label: 'Tools',  ids: ['parlays', 'ladder', 'community', 'library'] },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  return (
    <nav
      ref={scrollRef}
      className="flex items-center gap-0.5 px-2 border-b border-border bg-card/50 backdrop-blur-sm overflow-x-auto"
      style={{ scrollbarWidth: 'none', minHeight: '48px', flexShrink: 0 }}
    >
      {GROUPS.map((group, gi) => (
        <div key={group.label} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div className="w-px h-5 bg-border mx-1.5 shrink-0" />
          )}
          {group.ids.map(id => {
            const tab = TABS.find(t => t.id === id);
            if (!tab) return null;
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                data-tab={id}
                onClick={() => onTabChange(id)}
                title={tab.label}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 shrink-0 select-none"
                style={isActive ? {
                  color: tab.accentColor,
                  background: `${tab.accentColor}18`,
                } : {
                  color: 'var(--muted-foreground)',
                }}
              >
                {/* Active underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ background: tab.accentColor }}
                  />
                )}
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="text-xs font-semibold tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
