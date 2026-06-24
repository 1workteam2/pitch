/**
 * TabBar — compact grouped navigation
 *
 * Design: Two logical groups in a single scrollable row.
 * Each tab is an icon pill — no label text until active.
 * Active tab shows icon + short label inline.
 * Keeps the bar to ~36px tall so content starts immediately.
 */
import { useRef, useEffect } from 'react';
import { TABS, type TabId } from '@/lib/tabs';

// Logical groups — shown as subtle dividers
const GROUPS: { ids: TabId[]; label: string }[] = [
  { label: 'Game',  ids: ['live', 'rfi', 'lines', 'books'] },
  { label: 'Props', ids: ['hits', 'bases', 'hr', 'ks'] },
  { label: 'Tools', ids: ['parlays', 'ladder', 'community', 'library'] },
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
      style={{ scrollbarWidth: 'none', height: '38px', flexShrink: 0 }}
    >
      {GROUPS.map((group, gi) => (
        <div key={group.label} className="flex items-center gap-0.5">
          {/* Group divider (not before first group) */}
          {gi > 0 && (
            <div className="w-px h-4 bg-border mx-1 shrink-0" />
          )}
          {group.ids.map(id => {
            const tab = TABS.find(t => t.id === id)!;
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                data-tab={id}
                onClick={() => onTabChange(id)}
                title={tab.label}
                className={`compact-tab ${isActive ? 'active' : ''}`}
                style={isActive ? {
                  color: tab.accentColor,
                  background: `${tab.accentColor}18`,
                  borderColor: `${tab.accentColor}35`,
                } : undefined}
              >
                <span className="compact-tab-icon">{tab.icon}</span>
                {isActive && (
                  <span className="compact-tab-label">{tab.label}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
