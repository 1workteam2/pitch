import { useState, useCallback } from 'react';

export interface KeySlot {
  key: string;
  label: string;
  quota?: number; // remaining requests
}

const STORAGE_KEY = 'dugout_keys';
const ACTIVE_KEY  = 'dugout_active';

const DEFAULT_SLOTS: KeySlot[] = [
  { key: '79dfc5cdcde8f8d90bfec01e4e8c1943', label: 'Primary' },
  { key: 'c7d98a625775035ff6b3042edd5d2ed1', label: 'Backup 1' },
  { key: '93e0f27da2b62b45f3815041a70438a4', label: 'Backup 2' },
];

function loadSlots(): KeySlot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SLOTS;
}

function saveSlots(slots: KeySlot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}

function loadActiveIdx(): number {
  const raw = localStorage.getItem(ACTIVE_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

function saveActiveIdx(idx: number) {
  localStorage.setItem(ACTIVE_KEY, String(idx));
}

export function useKeyManager() {
  const [slots, setSlots] = useState<KeySlot[]>(() => {
    const stored = loadSlots();
    return stored.length ? stored : DEFAULT_SLOTS;
  });
  const [activeIdx, setActiveIdxState] = useState<number>(loadActiveIdx);

  const activeKey = slots[activeIdx]?.key ?? '';

  const setActiveIdx = useCallback((idx: number) => {
    setActiveIdxState(idx);
    saveActiveIdx(idx);
  }, []);

  const addSlot = useCallback((slot: KeySlot) => {
    setSlots(prev => {
      const next = [...prev, slot];
      saveSlots(next);
      return next;
    });
  }, []);

  const removeSlot = useCallback((idx: number) => {
    setSlots(prev => {
      const next = prev.filter((_, i) => i !== idx);
      saveSlots(next);
      return next;
    });
    setActiveIdxState(prev => {
      const next = prev >= idx && prev > 0 ? prev - 1 : prev;
      saveActiveIdx(next);
      return next;
    });
  }, []);

  const updateQuota = useCallback((idx: number, quota: number) => {
    setSlots(prev => {
      const next = prev.map((s, i) => i === idx ? { ...s, quota } : s);
      saveSlots(next);
      return next;
    });
  }, []);

  const testKey = useCallback(async (key: string): Promise<number | null> => {
    try {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/?apiKey=${key}`
      );
      const remaining = res.headers.get('x-requests-remaining');
      if (res.ok && remaining !== null) return parseInt(remaining, 10);
      return null;
    } catch {
      return null;
    }
  }, []);

  return {
    slots,
    activeIdx,
    activeKey,
    setActiveIdx,
    addSlot,
    removeSlot,
    updateQuota,
    testKey,
  };
}
