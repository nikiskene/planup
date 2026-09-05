import { useEffect, useState } from 'react';
import { ArchiveRestore, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { newLocalEntityId } from '../../lib/offline';

type Conflict = {
  id: string;
  entity_table: 'tasks' | 'notes';
  operation: 'insert' | 'update' | 'delete';
  reason: string;
  local_record: Record<string, any> | null;
  base_record: Record<string, any> | null;
  server_record: Record<string, any> | null;
  created_at: string;
};

function recordLabel(item: Conflict) {
  const record = item.local_record || item.base_record || item.server_record;
  return record?.title || record?.headline || record?.body?.slice(0, 80) || 'Untitled record';
}

export default function LostAndFoundSettings() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const [items, setItems] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeWorkspaceId || !navigator.onLine) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('offline_lost_and_found')
      .select('id,entity_table,operation,reason,local_record,base_record,server_record,created_at')
      .eq('workspace_id', activeWorkspaceId)
      .eq('status', 'unresolved')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) showToast(error.message || 'Could not load Lost & Found', 'error');
    else setItems(data || []);
  };

  useEffect(() => { load(); }, [activeWorkspaceId]);

  const resolve = async (item: Conflict, recover: boolean) => {
    if (!activeWorkspaceId || !navigator.onLine) return;
    try {
      if (recover) {
        const source = item.local_record || item.base_record;
        if (!source) throw new Error('No local version is available to recover');
        const now = new Date().toISOString();
        const recovered = {
          ...source,
          id: newLocalEntityId(),
          workspace_id: activeWorkspaceId,
          created_at: now,
          updated_at: now,
        };
        const { error } = await (supabase as any).from(item.entity_table).insert(recovered);
        if (error) throw error;
      }
      const { error } = await (supabase as any)
        .from('offline_lost_and_found')
        .update({
          status: recover ? 'kept_local' : 'kept_server',
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id || null,
        })
        .eq('id', item.id);
      if (error) throw error;
      showToast(recover ? 'Local version recovered as a new item' : 'Server version kept', 'success');
      await load();
    } catch (error: any) {
      showToast(error?.message || 'Could not resolve this item', 'error');
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ArchiveRestore size={19} className="text-amber-600" />
            <h2 className="font-semibold text-gray-900">Lost &amp; Found</h2>
          </div>
          <p className="mt-1 text-sm text-gray-600">Nothing is discarded when two devices make incompatible changes.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{items.length}</span>
      </div>

      {!navigator.onLine ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Lost &amp; Found is available again when you reconnect.</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-gray-500">Checking…</p>
      ) : items.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <ShieldCheck size={17} /> No unresolved sync conflicts.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="font-medium text-gray-900">{recordLabel(item)}</div>
              <div className="mt-1 text-xs text-gray-600">{item.entity_table === 'tasks' ? 'Task' : 'Note'} · {new Date(item.created_at).toLocaleString()}</div>
              <p className="mt-2 text-sm text-gray-700">{item.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(item.local_record || item.base_record) && (
                  <button onClick={() => resolve(item, true)} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
                    Recover local copy
                  </button>
                )}
                <button onClick={() => resolve(item, false)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Keep server version
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
