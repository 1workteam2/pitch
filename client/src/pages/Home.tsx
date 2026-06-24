import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { TABS, type TabId } from '@/lib/tabs';
import { useKeyManager } from '@/hooks/useKeyManager';
import Header from '@/components/dugout/Header';
import TabBar from '@/components/dugout/TabBar';
import BooksTab from '@/components/dugout/tabs/BooksTab';
import LiveTab from '@/components/dugout/tabs/LiveTab';
import RfiTab from '@/components/dugout/tabs/RfiTab';
import LinesTab from '@/components/dugout/tabs/LinesTab';
import PlayerPropsTab from '@/components/dugout/tabs/PlayerPropsTab';
import ParlaysTab from '@/components/dugout/tabs/ParlaysTab';
import LadderTab from '@/components/dugout/tabs/LadderTab';
import CommunityTab from '@/components/dugout/tabs/CommunityTab';
import LibraryTab from '@/components/dugout/tabs/LibraryTab';
import LineupsTab from '@/components/dugout/tabs/LineupsTab';
import KeyManagerPanel from '@/components/dugout/KeyManagerPanel';

function getInitialTab(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabId | null;
  if (tab && TABS.find(t => t.id === tab)) return tab;
  return 'live';
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const [, setLocation] = useLocation();
  const keyManager = useKeyManager();

  const handleTabChange = useCallback((id: TabId) => {
    setActiveTab(id);
    setLocation(`/?tab=${id}`, { replace: true });
  }, [setLocation]);

  // Props tabs use the FanDuel-style PlayerPropsTab with different default markets
  const isPropsTab = ['hits', 'bases', 'hr', 'ks'].includes(activeTab);
  const propsMarket = activeTab === 'hr' ? 'hr'
    : activeTab === 'ks' ? 'ks'
    : activeTab === 'bases' ? 'total_bases'
    : 'hits';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        onKeyClick={() => setKeyPanelOpen(true)}
        activeKey={keyManager.activeKey}
      />

      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 overflow-auto">
        {activeTab === 'live'      && <LiveTab />}
        {activeTab === 'rfi'       && <RfiTab />}
        {activeTab === 'lines'     && <LinesTab />}
        {activeTab === 'lineups'   && <LineupsTab />}
        {activeTab === 'books'     && (
          <BooksTab
            keyManager={keyManager}
            onOpenKeyPanel={() => setKeyPanelOpen(true)}
          />
        )}
        {/* Props tabs — Hits, Bases, HR, Ks all use the FanDuel-style layout */}
        {isPropsTab && (
          <PlayerPropsTab key={activeTab} />
        )}
        {activeTab === 'parlays'   && <ParlaysTab />}
        {activeTab === 'ladder'    && <LadderTab />}
        {activeTab === 'community' && <CommunityTab />}
        {activeTab === 'library'   && <LibraryTab />}
      </main>

      {keyPanelOpen && (
        <KeyManagerPanel
          keyManager={keyManager}
          onClose={() => setKeyPanelOpen(false)}
        />
      )}

      <footer className="border-t border-border py-2 px-4 text-center text-xs text-muted-foreground">
        BenchSeats · The Dugout Beta
      </footer>
    </div>
  );
}
