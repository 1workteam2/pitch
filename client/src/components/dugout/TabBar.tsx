import { useRef, useEffect } from 'react';
import { TABS, type TabId } from '@/lib/tabs';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view on mount / change
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  return (
    <nav
      ref={scrollRef}
      className="flex items-center gap-1 px-3 py-1.5 border-b border-border overflow-x-auto scrollbar-none bg-card/40"
      style={{ scrollbarWidth: 'none' }}
    >
      {TABS.map(tab => (
        <button
          key={tab.id}
          data-tab={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`dg-tab ${activeTab === tab.id ? 'active' : ''}`}
          style={activeTab === tab.id ? { color: tab.accentColor } : undefined}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
