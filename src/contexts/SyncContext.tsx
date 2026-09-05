import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { pendingMutationCount, syncPendingMutations } from '../lib/offline';

type SyncState = 'offline' | 'waiting' | 'syncing' | 'synced';

interface SyncContextValue {
  state: SyncState;
  pendingCount: number;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [online, setOnline] = useState(navigator.onLine);

  const refreshCount = useCallback(async () => setPendingCount(await pendingMutationCount()), []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) {
      await refreshCount();
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncPendingMutations();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    const changed = () => refreshCount();
    const wentOnline = () => {
      setOnline(true);
      window.setTimeout(() => syncNow(), 0);
    };
    const wentOffline = () => setOnline(false);
    window.addEventListener('planup-sync-change', changed);
    window.addEventListener('online', wentOnline);
    window.addEventListener('offline', wentOffline);
    refreshCount().then(() => {
      if (navigator.onLine) syncNow();
    });
    return () => {
      window.removeEventListener('planup-sync-change', changed);
      window.removeEventListener('online', wentOnline);
      window.removeEventListener('offline', wentOffline);
    };
  }, [refreshCount, syncNow]);

  const state: SyncState = !online ? 'offline' : syncing ? 'syncing' : pendingCount ? 'waiting' : 'synced';
  return <SyncContext.Provider value={{ state, pendingCount, syncNow }}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used within SyncProvider');
  return value;
}
