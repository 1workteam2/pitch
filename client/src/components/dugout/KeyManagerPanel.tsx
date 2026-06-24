import { useState } from 'react';
import { X, Plus, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import type { useKeyManager } from '@/hooks/useKeyManager';

type KeyManager = ReturnType<typeof useKeyManager>;

interface Props {
  keyManager: KeyManager;
  onClose: () => void;
}

function maskKey(key: string) {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••••••••••' + key.slice(-4);
}

export default function KeyManagerPanel({ keyManager, onClose }: Props) {
  const { slots, activeIdx, setActiveIdx, addSlot, removeSlot, updateQuota, testKey } = keyManager;
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, number | null>>({});

  const handleTest = async (idx: number) => {
    setTesting(idx);
    const quota = await testKey(slots[idx].key);
    setTestResult(prev => ({ ...prev, [idx]: quota }));
    if (quota !== null) updateQuota(idx, quota);
    setTesting(null);
  };

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    addSlot({ key: newKey.trim(), label: newLabel.trim() || `Slot ${slots.length + 1}` });
    setNewKey('');
    setNewLabel('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            🔑 API Key Manager
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Active key display */}
        <div className="mb-4 p-3 rounded-lg bg-background border border-border">
          <div className="text-xs text-muted-foreground mb-1">Active Key</div>
          <div className="font-mono text-sm text-foreground">{maskKey(slots[activeIdx]?.key ?? '')}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Slot {activeIdx + 1} · {slots[activeIdx]?.label}</div>
        </div>

        {/* Slot list */}
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                idx === activeIdx
                  ? 'border-primary/40 bg-primary/8'
                  : 'border-border bg-background hover:border-border/60'
              }`}
            >
              <span className="text-xs text-muted-foreground w-4 text-center">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-foreground truncate">{maskKey(slot.key)}</div>
                <div className="text-xs text-muted-foreground">{slot.label}</div>
              </div>

              {/* Quota */}
              {slot.quota !== undefined && (
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  slot.quota === 0 ? 'bg-destructive/20 text-destructive' :
                  slot.quota < 50 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {slot.quota} left
                </span>
              )}

              {/* Test result */}
              {testResult[idx] !== undefined && testResult[idx] === null && (
                <AlertCircle size={14} className="text-destructive shrink-0" />
              )}

              {/* Actions */}
              <button
                onClick={() => handleTest(idx)}
                disabled={testing === idx}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Test key"
              >
                {testing === idx ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              </button>

              {idx !== activeIdx && (
                <button
                  onClick={() => { setActiveIdx(idx); }}
                  className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                >
                  Activate
                </button>
              )}

              {idx === activeIdx && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">Active</span>
              )}

              {slots.length > 1 && (
                <button
                  onClick={() => removeSlot(idx)}
                  className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  title="Remove slot"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new key */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="text-xs text-muted-foreground mb-2">Add Key Slot</div>
          <input
            type="text"
            placeholder="API key"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (e.g. Backup 3)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
