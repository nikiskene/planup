import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useLeadStatuses } from '../crm/useLeadStatuses';

type Rule = { id: string; subject_contains: string; lead_status_id: string; enabled: boolean };

export default function EmailSubjectRulesSettings() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const { showToast } = useToast();
  const canManage = Boolean(membership?.can_manage_members);
  const { statuses, loadingStatuses } = useLeadStatuses(activeWorkspaceId, showToast);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [marker, setMarker] = useState('');
  const [statusId, setStatusId] = useState('');
  const [editing, setEditing] = useState<Rule | null>(null);
  const [editMarker, setEditMarker] = useState('');
  const [editStatusId, setEditStatusId] = useState('');
  const [busy, setBusy] = useState(false);

  const statusName = useMemo(() => new Map(statuses.map(status => [status.id, status.name])), [statuses]);
  const load = useCallback(async () => {
    if (!activeWorkspaceId) { setRules([]); setLoading(false); return; }
    setLoading(true);
    // @ts-expect-error table is introduced by the WRXS subject-rule migration.
    const { data, error } = await supabase.from('crm_email_subject_rules').select('id,subject_contains,lead_status_id,enabled')
      .eq('workspace_id', activeWorkspaceId).order('created_at');
    if (error) showToast(error.message || 'Could not load email rules', 'error');
    else setRules((data || []) as Rule[]);
    setLoading(false);
  }, [activeWorkspaceId, showToast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!statusId && statuses[0]) setStatusId(statuses[0].id); }, [statusId, statuses]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); const subject_contains = marker.trim();
    if (!activeWorkspaceId || !canManage || !subject_contains || !statusId) return;
    setBusy(true);
    // @ts-expect-error table is introduced by the WRXS subject-rule migration.
    const { error } = await supabase.from('crm_email_subject_rules').insert({ workspace_id: activeWorkspaceId, subject_contains, lead_status_id: statusId });
    if (error) showToast(error.message || 'Could not add email rule', 'error');
    else { setMarker(''); showToast('Email rule added', 'success'); await load(); }
    setBusy(false);
  };
  const save = async () => {
    const subject_contains = editMarker.trim();
    if (!activeWorkspaceId || !editing || !subject_contains || !editStatusId) return;
    setBusy(true);
    // @ts-expect-error table is introduced by the WRXS subject-rule migration.
    const { error } = await supabase.from('crm_email_subject_rules').update({ subject_contains, lead_status_id: editStatusId })
      .eq('workspace_id', activeWorkspaceId).eq('id', editing.id);
    if (error) showToast(error.message || 'Could not save email rule', 'error');
    else { setEditing(null); showToast('Email rule saved', 'success'); await load(); }
    setBusy(false);
  };
  const remove = async (rule: Rule) => {
    if (!activeWorkspaceId || !confirm(`Delete the rule for “${rule.subject_contains}”?`)) return;
    setBusy(true);
    // @ts-expect-error table is introduced by the WRXS subject-rule migration.
    const { error } = await supabase.from('crm_email_subject_rules').delete().eq('workspace_id', activeWorkspaceId).eq('id', rule.id);
    if (error) showToast(error.message || 'Could not delete email rule', 'error');
    else { showToast('Email rule deleted', 'success'); await load(); }
    setBusy(false);
  };

  return <section className="rounded-lg border border-gray-200 bg-white p-6">
    <h2 className="text-lg font-semibold text-gray-900">Email rules</h2>
    <p className="mt-1 text-sm leading-6 text-gray-600">When a subject contains a marker, new people captured through your wrxs BCC address receive the selected relationship status. Existing people keep their current status.</p>
    {loading || loadingStatuses ? <p className="mt-4 text-sm text-gray-600">Loading email rules…</p> : <div className="mt-4 space-y-2">{rules.length ? rules.map(rule => {
      const isEditing = editing?.id === rule.id;
      return <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
        {isEditing ? <><input value={editMarker} onChange={event => setEditMarker(event.target.value)} maxLength={160} className="min-w-0 flex-1 rounded border px-2 py-1 text-sm" /><select value={editStatusId} onChange={event => setEditStatusId(event.target.value)} className="rounded border px-2 py-1 text-sm">{statuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select><button onClick={() => void save()} disabled={busy} className="rounded border bg-white p-2"><Check size={16} /></button><button onClick={() => setEditing(null)} className="rounded border bg-white p-2"><X size={16} /></button></> : <><p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">Subject contains “{rule.subject_contains}”</p><span className="rounded-full bg-white px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200">{statusName.get(rule.lead_status_id) || 'Status unavailable'}</span>{canManage ? <><button onClick={() => { setEditing(rule); setEditMarker(rule.subject_contains); setEditStatusId(rule.lead_status_id); }} className="rounded border bg-white p-2" title="Edit rule"><Pencil size={16} /></button><button onClick={() => void remove(rule)} disabled={busy} className="rounded border bg-white p-2" title="Delete rule"><Trash2 size={16} /></button></> : null}</>}
      </div>;
    }) : <p className="text-sm text-gray-500">No email rules yet.</p>}</div>}
    {canManage ? <form onSubmit={add} className="mt-5 flex flex-col gap-2 border-t pt-5 sm:flex-row"><input value={marker} onChange={event => setMarker(event.target.value)} placeholder="Subject marker, for example [Apollo Q4]" maxLength={160} required className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" /><select value={statusId} onChange={event => setStatusId(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">{statuses.map(status => <option key={status.id} value={status.id}>{status.name}</option>)}</select><button disabled={busy || !marker.trim() || !statusId} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add rule</button></form> : null}
  </section>;
}
