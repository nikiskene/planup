// src/pages/settings/LeadTagsSettings.tsx
import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Tag, Trash2, X } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';

type LeadTag = { id: string; name: string; peopleCount: number };

export default function LeadTagsSettings() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const { showToast } = useToast();
  const canManage = Boolean(membership?.can_manage_members);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) { setTags([]); setLoading(false); return; }
    setLoading(true);
    const [tagResult, assignmentResult] = await Promise.all([
      supabase.from('crm_tags').select('id,name').eq('workspace_id', activeWorkspaceId).order('name'),
      supabase.from('crm_contact_tags').select('tag_id').eq('workspace_id', activeWorkspaceId),
    ]);
    if (tagResult.error || assignmentResult.error) {
      showToast(tagResult.error?.message || assignmentResult.error?.message || 'Failed to load Lead tags', 'error');
    } else {
      const counts = new Map<string, number>();
      const assignments = (assignmentResult.data || []) as unknown as Array<{ tag_id: string }>;
      const tagRows = (tagResult.data || []) as unknown as Array<{ id: string; name: string }>;
      assignments.forEach((row) => counts.set(row.tag_id, (counts.get(row.tag_id) || 0) + 1));
      setTags(tagRows.map((row) => ({ ...row, peopleCount: counts.get(row.id) || 0 })));
    }
    setLoading(false);
  }, [activeWorkspaceId, showToast]);

  useEffect(() => { load(); }, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!activeWorkspaceId || !canManage || !name) return;
    setBusy(true);
    // @ts-expect-error crm tables are not present in the generated database types yet.
    const { error } = await supabase.from('crm_tags').insert({ workspace_id: activeWorkspaceId, name });
    if (error) showToast(error.message || 'Failed to add Lead tag', 'error');
    else { setNewName(''); showToast('Lead tag added', 'success'); await load(); }
    setBusy(false);
  };

  const save = async () => {
    const name = editingName.trim();
    if (!activeWorkspaceId || !canManage || !editingId || !name) return;
    setBusy(true);
    // @ts-expect-error crm tables are not present in the generated database types yet.
    const { error } = await supabase.from('crm_tags').update({ name }).eq('workspace_id', activeWorkspaceId).eq('id', editingId);
    if (error) showToast(error.message || 'Failed to rename Lead tag', 'error');
    else { setEditingId(null); showToast('Lead tag renamed', 'success'); await load(); }
    setBusy(false);
  };

  const remove = async (tag: LeadTag) => {
    if (!activeWorkspaceId || !canManage) return;
    if (tag.peopleCount > 0) { showToast(`Remove “${tag.name}” from its people before deleting it.`, 'error'); return; }
    if (!confirm(`Delete the Lead tag “${tag.name}”?`)) return;
    setBusy(true);
    const { error } = await supabase.from('crm_tags').delete().eq('workspace_id', activeWorkspaceId).eq('id', tag.id);
    if (error) showToast(error.message || 'Failed to delete Lead tag', 'error');
    else { showToast('Lead tag deleted', 'success'); await load(); }
    setBusy(false);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-2 flex items-center gap-2"><Tag size={20} className="text-gray-700" /><h2 className="text-lg font-semibold text-gray-900">Lead tags</h2></div>
      <p className="mb-5 text-sm text-gray-600">Organize people across Speakercoaching, Tours, IOBS, Private, and other Lead groups.</p>
      {loading ? <p className="text-gray-600">Loading Lead tags…</p> : (
        <div className="mb-6 space-y-2">
          {tags.map((tag) => {
            const editing = editingId === tag.id;
            return <div key={tag.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <div className="min-w-0 flex-1">{editing ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm" /> : <><p className="truncate text-sm font-medium text-gray-900">{tag.name}</p><p className="text-xs text-gray-500">{tag.peopleCount} {tag.peopleCount === 1 ? 'person' : 'people'}</p></>}</div>
              {canManage ? <div className="flex gap-2">{editing ? <>
                <button type="button" onClick={save} disabled={busy || !editingName.trim()} className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-50" title="Save"><Check size={16} /></button>
                <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="rounded-lg border border-gray-200 bg-white p-2" title="Cancel"><X size={16} /></button>
              </> : <>
                <button type="button" onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }} className="rounded-lg border border-gray-200 bg-white p-2" title="Rename"><Pencil size={16} /></button>
                <button type="button" onClick={() => remove(tag)} disabled={busy} className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-50" title={tag.peopleCount ? 'Remove from people before deleting' : 'Delete'}><Trash2 size={16} /></button>
              </>}</div> : null}
            </div>;
          })}
        </div>
      )}
      {canManage ? <form onSubmit={add} className="flex max-w-md gap-2 border-t pt-5"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New Lead tag" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button disabled={busy || !newName.trim()} className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50">Add</button></form> : <p className="text-sm text-gray-500">You don’t have permission to manage Lead tags.</p>}
    </section>
  );
}
