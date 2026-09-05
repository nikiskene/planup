import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';

export default function SyncStatus() {
  const { state, pendingCount, syncNow } = useSync();
  const label = state === 'offline'
    ? `Offline${pendingCount ? ` · ${pendingCount} waiting` : ''}`
    : state === 'syncing'
      ? 'Syncing…'
      : state === 'waiting'
        ? `${pendingCount} waiting`
        : 'Synced';

  return (
    <button
      type="button"
      onClick={syncNow}
      disabled={state === 'offline' || state === 'syncing'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        state === 'offline' ? 'bg-amber-100 text-amber-800' :
        state === 'waiting' ? 'bg-blue-100 text-blue-800' :
        'bg-emerald-50 text-emerald-700'
      }`}
      title={state === 'offline' ? 'Changes will sync when the connection returns' : 'Sync now'}
    >
      {state === 'offline' ? <CloudOff size={14} /> : state === 'syncing' ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
