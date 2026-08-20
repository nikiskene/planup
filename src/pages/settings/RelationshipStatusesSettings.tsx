// src/pages/settings/RelationshipStatusesSettings.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LockKeyhole, Pencil, Trash2, UsersRound, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useLeadStatuses, type LeadStatusOption } from '../crm/useLeadStatuses';

export default function RelationshipStatusesSettings() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const { showToast } = useToast();
  const canManage = Boolean(membership?.can_manage_members);
  const { statuses, loadingStatuses, reloadStatuses } = useLeadStatuses(activeWorkspaceId, showToast);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<LeadStatusOption | null>(null);
  const [editingName, setEditingName] = useState('');
  const [fallbackKey, setFallbackKey] = useState('connected');
  const [busy, setBusy] = useState(false);
  const systemStatuses = useMemo(() => statuses.filter((status) => status.is_system), [statuses]);

  const loadCounts = useCallback(async () => {
    if (!activeWorkspaceId) return;
    const { data } = await supabase.from('crm_contacts').select('lead_status').eq('workspace_id', activeWorkspaceId);
    const next: Record<string, number> = {};
    ((data || []) as unknown as Array<{ lead_status: string | null }>).forEach((row) => {
      if (row.lead_status) next[row.lead_status] = (next[row.lead_status] || 0) + 1;
    });
    setCounts(next);
  }, [activeWorkspaceId]);
  useEffect(() => { loadCounts(); }, [loadCounts, statuses]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); const name = newName.trim();
    if (!activeWorkspaceId || !canManage || !name) return;
    setBusy(true);
    // @ts-expect-error catalog table is newer than the generated database types.
    const { error } = await supabase.from('crm_lead_statuses').insert({ workspace_id: activeWorkspaceId, name });
    if (error) showToast(error.message || 'Failed to add relationship status', 'error');
    else { setNewName(''); showToast('Relationship status added', 'success'); await reloadStatuses(); }
    setBusy(false);
  };
  const save = async () => {
    const name = editingName.trim(); if (!activeWorkspaceId || !editing || !name) return;
    setBusy(true);
    // @ts-expect-error catalog table is newer than the generated database types.
    const { error } = await supabase.from('crm_lead_statuses').update({ name }).eq('workspace_id', activeWorkspaceId).eq('id', editing.id);
    if (error) showToast(error.message || 'Failed to rename relationship status', 'error');
    else { setEditing(null); showToast('Relationship status renamed', 'success'); await reloadStatuses(); }
    setBusy(false);
  };
  const remove = async (status: LeadStatusOption) => {
    if (!activeWorkspaceId || status.is_system || !confirm(`Delete “${status.name}”? Its people will move to the selected fallback status.`)) return;
    setBusy(true);
    // @ts-expect-error RPC is newer than the generated database types.
    const { data, error } = await supabase.rpc('delete_crm_lead_status', { p_workspace_id: activeWorkspaceId, p_status_key: status.key, p_fallback_key: fallbackKey });
    if (error) showToast(error.message || 'Failed to delete relationship status', 'error');
    else { showToast(`Status deleted. ${Number(data || 0)} people moved.`, 'success'); await reloadStatuses(); }
    setBusy(false);
  };

  return <section className="rounded-lg border border-gray-200 bg-white p-6">
    <div className="mb-2 flex items-center gap-2"><UsersRound size={20} /><h2 className="text-lg font-semibold text-gray-900">Relationship statuses</h2></div>
    <p className="mb-4 text-sm text-gray-600">These statuses create the tabs in Leads. Built-in statuses cannot be changed.</p>
    {canManage ? <label className="mb-5 block max-w-sm text-sm text-gray-700">When deleting a custom status, move its people to
      <select value={fallbackKey} onChange={(event) => setFallbackKey(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
        {systemStatuses.map((status) => <option key={status.key} value={status.key}>{status.name}</option>)}
      </select></label> : null}
    {loadingStatuses ? <p>Loading relationship statuses…</p> : <div className="mb-6 space-y-2">{statuses.map((status) => {
      const isEditing = editing?.id === status.id;
      return <div key={status.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
        <div className="min-w-0 flex-1">{isEditing ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" /> : <><div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-gray-900">{status.name}</p>{status.is_system ? <LockKeyhole size={13} className="text-gray-400" /> : null}</div><p className="text-xs text-gray-500">{counts[status.key] || 0} people</p></>}</div>
        {canManage && !status.is_system ? <div className="flex gap-2">{isEditing ? <><button onClick={save} disabled={busy} className="rounded-lg border bg-white p-2"><Check size={16} /></button><button onClick={() => setEditing(null)} className="rounded-lg border bg-white p-2"><X size={16} /></button></> : <><button onClick={() => { setEditing(status); setEditingName(status.name); }} className="rounded-lg border bg-white p-2"><Pencil size={16} /></button><button onClick={() => remove(status)} disabled={busy} className="rounded-lg border bg-white p-2"><Trash2 size={16} /></button></>}</div> : null}
      </div>;
    })}</div>}
    {canManage ? <form onSubmit={add} className="flex max-w-md gap-2 border-t pt-5"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New relationship status" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><button disabled={busy || !newName.trim()} className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50">Add</button></form> : <p className="text-sm text-gray-500">You don’t have permission to manage relationship statuses.</p>}
  </section>;
}
