import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { crm } from './data';
import { scheduleFollowUp, updateTask } from './actions';
import { dueDay, modeFor, todayKey, type AttentionLead, type HomeTask, type LeadStatus } from './attention';

export type HomeAction = { kind: 'log' | 'follow' | 'status'; lead: AttentionLead } | { kind: 'task'; task: HomeTask };
const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2';
export default function ActionDialog({ action, statuses, userId, onClose, onSaved, saveTask }: {
  action: HomeAction; statuses: LeadStatus[]; userId: string; onClose: () => void;
  onSaved: (message: string, warning?: boolean) => void;
  saveTask: (task: HomeTask, patch: Partial<HomeTask>) => Promise<void>;
}) {
  const [date, setDate] = useState(action.kind === 'task' ? dueDay(action.task.due_at || todayKey()) : todayKey());
  const [channel, setChannel] = useState('email');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('contact');
  const [status, setStatus] = useState(action.kind !== 'task' ? action.lead.lead_status || '' : '');
  const [resolve, setResolve] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const deferred = modeFor(statuses.find(s => s.key === status)) === 'deferred';
  const title = { log: 'Log contact', follow: 'Schedule follow-up', status: 'Change status', task: 'Reschedule task' }[action.kind];
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    let savedContact = false;
    let savedFollowUp = false;
    try {
      if (action.kind === 'task') {
        await saveTask(action.task, { due_at: `${date}T00:00:00.000Z` });
      } else {
        if (!navigator.onLine) throw new Error('Lead actions need an internet connection.');
        const lead = action.lead;
        if (action.kind === 'follow' || (action.kind === 'status' && deferred)) {
          await scheduleFollowUp(lead, date, userId); savedFollowUp = true;
        }
        if (action.kind === 'status') {
          let query = crm.from('crm_contacts').update({ lead_status: status || null, attention_reopened_at: new Date().toISOString() })
            .eq('id', lead.id).eq('workspace_id', lead.workspace_id);
          query = lead.lead_status ? query.eq('lead_status', lead.lead_status) : query.is('lead_status', null);
          const { data, error: failure } = await query.select('id');
          if (failure) throw failure;
          if (!data?.length) throw new Error('The status changed elsewhere. Refresh before trying again.');
        }
        if (action.kind === 'log') {
          const occurred_at = date === todayKey() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
          if (Date.parse(occurred_at) > Date.now()) throw new Error('Contact activity cannot be in the future.');
          const { error: failure } = await crm.from('crm_interactions').insert({ workspace_id: lead.workspace_id,
            contact_id: lead.id, company_id: lead.company_id, created_by: userId, occurred_at, channel,
            activity_kind: kind, note: note.trim() || null, next_action: 'none' });
          if (failure) throw failure;
          savedContact = true;
          if (resolve && kind === 'contact') {
            for (const task of lead.followUps.filter(t => t.due_at && dueDay(t.due_at) <= todayKey())) await updateTask(task, { status: 'done' });
          }
        }
      }
      onSaved(action.kind === 'log' ? 'Activity recorded' : action.kind === 'status' ? 'Status updated' : 'Follow-up date saved');
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Unable to save. Please try again.';
      if (savedContact) onSaved(`Activity recorded, but a reminder could not be completed. ${message}`, true);
      else if (savedFollowUp) onSaved(`Follow-up saved, but status was not changed. ${message}`, true);
      else setError(message);
    } finally { setBusy(false); }
  };
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 backdrop:bg-black/40" aria-labelledby="action-title">
    <form onSubmit={submit} className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 id="action-title" className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-gray-500">{action.kind === 'task' ? action.task.title : action.lead.name}</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-gray-100"><X size={20} /></button></div>
      {action.kind === 'status' && <label className="block text-sm">Relationship status<select className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="">No status</option>{statuses.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}</select></label>}
      {action.kind === 'log' && <>
        <label className="block text-sm">Activity<select className={input} value={kind} onChange={e => setKind(e.target.value)}><option value="contact">Actual contact — sent, received or spoke</option><option value="attempt">Unanswered attempt</option><option value="note">Internal note</option></select></label>
        <label className="block text-sm">Channel<select className={input} value={channel} onChange={e => setChannel(e.target.value)}><option value="email">Email</option><option value="phone">Call / meeting</option><option value="text">SMS / WhatsApp</option><option value="social">LinkedIn / social</option><option value="website">Website / form</option></select></label>
      </>}
      {(action.kind !== 'status' || deferred) && <label className="block text-sm">{action.kind === 'log' ? 'Contact date' : 'Follow-up date'}<input required type="date" className={input} value={date} max={action.kind === 'log' ? todayKey() : undefined} onChange={e => setDate(e.target.value)} /></label>}
      {action.kind === 'log' && <><label className="block text-sm">Note (optional)<textarea className={input} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label>
        {kind === 'contact' && action.lead.followUps.some(t => t.due_at && dueDay(t.due_at) <= todayKey()) && <label className="flex gap-2 text-sm"><input type="checkbox" checked={resolve} onChange={e => setResolve(e.target.checked)} />Complete the due follow-up reminders</label>}
        <p className="text-xs text-gray-500">Unanswered attempts and internal notes do not reset last contact.</p></>}
      {action.kind === 'follow' && <p className="text-sm text-gray-500">Replaces existing follow-up reminders. This does not log contact.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy} className="rounded-lg bg-gray-950 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button></div>
    </form>
  </dialog>;
}
