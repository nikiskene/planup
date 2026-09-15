import { useEffect, useState } from 'react';
import { deleteQR, listQR, type QRRecord } from '../../lib/qr/persistence';
import { useToast } from '../../contexts/ToastContext';
import { buttonClass } from './QRForm';
export default function SavedQRList({ workspaceId, onOpen }: { workspaceId: string; onOpen: (record: QRRecord, duplicate?: boolean) => void }) {
  const [records, setRecords] = useState<QRRecord[]>([]);
  const [error, setError] = useState(false), [loading, setLoading] = useState(true), [revision, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  useEffect(() => {
    let active = true; setLoading(true); setError(false);
    listQR(workspaceId).then(rows => { if (active) setRecords(rows); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId, revision]);
  async function remove(record: QRRecord) {
    if (!window.confirm(`Delete “${record.name}” from PlanUp? Downloaded or printed static QR codes will continue to work.`)) return;
    setBusy(true);
    try { await deleteQR(record); refresh(n => n + 1); showToast('QR deleted', 'success'); }
    catch { showToast('Unable to delete. Check your connection and refresh before retrying.', 'error'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Saved QR codes">
    <p className="text-sm text-gray-500">Saved in this workspace. Open a QR to edit, rename, or download it. An internet connection is required.</p>
    <button className={buttonClass} disabled={loading || busy} onClick={() => refresh(n => n + 1)}>Refresh</button>
    {loading ? <p role="status">Loading saved QR codes…</p> : error ? <p role="alert">Unable to load saved QR codes. Check your connection and that QR saving is enabled for this workspace.</p> : !records.length ? <p>No saved QR codes yet.</p> : records.map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"><div className="min-w-0"><h2 className="break-words font-medium">{record.name}</h2><p className="text-sm text-gray-500">{record.type} · {new Date(record.updated_at).toLocaleDateString()}</p></div><div className="flex flex-wrap gap-2"><button className={buttonClass} onClick={() => onOpen(record)}>Open / Edit</button><button className={buttonClass} onClick={() => onOpen(record, true)}>Duplicate</button><button className={buttonClass} disabled={busy} onClick={() => remove(record)}>Delete</button></div></div>)}
  </section>;
}
