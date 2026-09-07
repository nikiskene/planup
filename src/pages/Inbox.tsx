import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { cacheEntities, getCachedEntities, updateOfflineEntity } from '../lib/offline';
import { dueDay, daysBetween, leadAttention, taskAttention, todayKey, type AttentionLead, type HomeTask } from './home/attention';
import { loadLeads, loadTasks } from './home/data';
import ActionDialog, { type HomeAction } from './home/ActionDialog';

const button = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50';
export default function Inbox() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  return activeWorkspaceId ? <Home key={activeWorkspaceId} workspace={activeWorkspaceId} name={activeWorkspace?.name || 'Workspace'} /> : null;
}
function Home({ workspace, name }: { workspace: string; name: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { syncNow } = useSync();
  const [tab, setTab] = useState<'tasks' | 'leads'>('tasks');
  const [tasks, setTasks] = useState<HomeTask[]>([]);
  const [leadData, setLeadData] = useState<Awaited<ReturnType<typeof loadLeads>> | null>(null);
  const [taskError, setTaskError] = useState('');
  const [leadError, setLeadError] = useState('');
  const [taskLoading, setTaskLoading] = useState(true);
  const [leadLoading, setLeadLoading] = useState(true);
  const [action, setAction] = useState<HomeAction | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [limit, setLimit] = useState(20);
  const generation = useRef(0);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    const current = () => mounted.current && version === generation.current;
    setNow(new Date()); setTaskLoading(true); setLeadLoading(true);
    await Promise.allSettled([
      (async () => {
        try {
          if (!navigator.onLine) throw new Error('Offline — showing tasks saved on this device.');
          const rows = await loadTasks(workspace);
          await cacheEntities('tasks', workspace, rows);
          const local = await getCachedEntities<HomeTask>('tasks', workspace);
          if (current()) { setTasks(local); setTaskError(''); }
        } catch (error) {
          const cached = await getCachedEntities<HomeTask>('tasks', workspace);
          if (current()) { setTasks(cached); setTaskError(navigator.onLine ? 'Couldn’t refresh tasks. Showing the saved copy, if available.' : String((error as Error).message)); }
        } finally { if (current()) setTaskLoading(false); }
      })(),
      (async () => {
        try {
          if (!navigator.onLine) throw new Error('Lead attention needs an internet connection.');
          const data = await loadLeads(workspace);
          if (current()) { setLeadData(data); setLeadError(''); }
        } catch (error) { if (current()) { setLeadData(null); setLeadError(error instanceof Error ? error.message : 'Couldn’t refresh leads. Connect to the internet and try again.'); } }
        finally { if (current()) setLeadLoading(false); }
      })(),
    ]);
  }, [workspace]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const updateLocal = () => { void getCachedEntities<HomeTask>('tasks', workspace).then(rows => { if (mounted.current) setTasks(rows); }); };
    const refetch = () => { void refresh(); };
    const clock = window.setInterval(() => setNow(new Date()), 60000);
    window.addEventListener('focus', refetch); window.addEventListener('online', refetch); window.addEventListener('offline', refetch);
    window.addEventListener('planup-sync-change', updateLocal);
    return () => { mounted.current = false; window.clearInterval(clock);
      window.removeEventListener('focus', refetch); window.removeEventListener('online', refetch); window.removeEventListener('offline', refetch);
      window.removeEventListener('planup-sync-change', updateLocal); };
  }, [refresh, workspace]);
  const today = todayKey(now);
  const dueTasks = useMemo(() => taskAttention(tasks, today), [tasks, today]);
  const leads = useMemo(() => leadData ? leadAttention(leadData.leads, leadData.activities, !taskLoading && !taskError ? tasks : leadData.tasks,
    leadData.statuses, leadData.ingestions, leadData.companies, now) : [], [leadData, now, tasks, taskLoading, taskError]);
  const mainLeads = leads.filter(l => ['follow_up', 'reconnect'].includes(l.reason));
  const never = leads.filter(l => l.reason === 'never');
  const setup = leads.filter(l => ['missing_date', 'classify'].includes(l.reason));
  const saveTask = async (task: HomeTask, patch: Partial<HomeTask>) => {
    if (!user) throw new Error('Please sign in again.');
    await updateOfflineEntity('tasks', task, patch, user.id);
    setTasks(await getCachedEntities<HomeTask>('tasks', workspace));
    void syncNow();
  };
  const complete = async (task: HomeTask) => {
    setBusyTask(task.id);
    try { await saveTask(task, { status: 'done' }); showToast('Task completed on this device; changes will sync.', 'success'); }
    catch { showToast('Could not complete the task.', 'error'); }
    finally { setBusyTask(null); }
  };
  const leadRow = (lead: AttentionLead) => {
    const due = lead.followUps.find(t => t.due_at && dueDay(t.due_at) <= today);
    const overdue = due?.due_at ? daysBetween(dueDay(due.due_at), today) : 0;
    const reason = lead.reason === 'follow_up' ? overdue > 0 ? `Follow-up overdue by ${overdue} day${overdue === 1 ? '' : 's'}` : 'Follow-up due today'
      : lead.reason === 'reconnect' ? `No contact for ${lead.age} days`
      : lead.reason === 'never' ? 'No contact recorded'
      : lead.reason === 'missing_date' ? 'Needs a follow-up date' : 'Relationship status needs a Home rule';
    return <article key={lead.id} className="space-y-3 border-b border-gray-100 p-4 last:border-b-0 sm:p-5">
      <div><Link to={`/crm/contacts/${lead.id}`} className="font-semibold text-gray-950 hover:underline">{lead.name}</Link>{lead.company && <span className="text-sm text-gray-500"> · {lead.company}</span>}
        <p className="mt-1 text-sm font-medium text-gray-700">{reason} <span className="font-normal text-gray-500">· {lead.statusName}{!lead.is_active ? ' · Passive' : ''}</span></p>
        <p className="mt-1 text-xs text-gray-500">{lead.lastContact ? `Last contact: ${new Date(lead.lastContact.occurred_at).toLocaleDateString()} · ${lead.lastContact.channel}` : lead.unknownHistory ? 'Older activity exists but is not classified as contact.' : 'No confirmed contact history.'}</p>
        {lead.followUps.length > 1 && <p className="mt-1 text-xs text-amber-700">{lead.followUps.length} open follow-ups. Scheduling a date will consolidate these reminders.</p>}
      </div>
      <div className="flex flex-wrap gap-2">{lead.reason === 'classify' ? <Link to="/settings" className={button}>Set status rule</Link> : <><button className={button} onClick={() => setAction({ kind: 'log', lead })}>Log contact</button><button className={button} onClick={() => setAction({ kind: 'follow', lead })}>Schedule follow-up</button></>}
        <button className={button} onClick={() => setAction({ kind: 'status', lead })}>Change status</button>
      </div>
    </article>;
  };
  return <div className="mx-auto max-w-4xl">
    <header className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-gray-500">{name} · {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">What needs your attention?</h1><p className="mt-2 text-sm text-gray-500">Today’s commitments and relationships worth following up.</p></div>
      <button aria-label="Refresh Home" title="Refresh" onClick={() => void refresh()} disabled={taskLoading || leadLoading} className={button}><RefreshCw size={17} /></button></header>
    <div className="mb-5 flex gap-2" role="tablist" aria-label="Home attention"><button id="tasks-tab" role="tab" aria-selected={tab === 'tasks'} aria-controls="tasks-panel" onClick={() => { setTab('tasks'); setLimit(20); }} className={`${button} ${tab === 'tasks' ? '!bg-gray-950 !text-white' : ''}`}>Tasks {taskLoading || taskError ? '' : `(${dueTasks.length})`}</button><button id="leads-tab" role="tab" aria-selected={tab === 'leads'} aria-controls="leads-panel" onClick={() => { setTab('leads'); setLimit(20); }} className={`${button} ${tab === 'leads' ? '!bg-gray-950 !text-white' : ''}`}>Leads {leadLoading || leadError ? '' : `(${mainLeads.length + never.length})`}</button></div>
    {tab === 'tasks' ? <section id="tasks-panel" role="tabpanel" aria-labelledby="tasks-tab">
      {taskError && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{taskError}</p>}
      {taskLoading ? <p className="py-8 text-gray-500">Loading tasks…</p> : <>
        {['Overdue', 'Due today'].map(section => {
          const rows = dueTasks.slice(0, limit).filter(t => section === 'Overdue' ? dueDay(t.due_at!) < today : dueDay(t.due_at!) === today);
          if (!rows.length) return null;
          return <div key={section} className="mb-6"><h2 className="mb-2 text-sm font-semibold text-gray-700">{section}</h2><div className="overflow-hidden rounded-xl border bg-white">{rows.map(task => <article key={task.id} className="flex items-start gap-3 border-b p-4 last:border-b-0">
            <button aria-label={`Complete ${task.title}`} className={`${button} mt-0.5 !px-2`} disabled={busyTask === task.id} onClick={() => void complete(task)}><Check size={17} /></button><div className="min-w-0 flex-1"><Link to={`/tasks/${task.id}`} className="font-medium hover:underline">{task.title}</Link><p className="mt-1 text-xs text-gray-500"><span className={task.priority === 'P0' ? 'font-semibold text-red-700' : 'font-semibold'}>{task.priority}</span> · {dueDay(task.due_at!)}{task.status === 'waiting' ? ` · Waiting${task.waiting_for ? ` for ${task.waiting_for}` : ''}` : ''}</p>{task.next_step && <p className="mt-2 text-sm text-gray-600">{task.next_step}</p>}<button onClick={() => setAction({ kind: 'task', task })} className="mt-2 text-sm text-gray-600 underline">Reschedule</button></div>
          </article>)}</div></div>;
        })}
        {!dueTasks.length && <p className="rounded-xl border bg-white p-6 text-gray-600">{taskError ? 'No due tasks in the saved copy.' : 'No overdue tasks or tasks due today.'}</p>}
        {dueTasks.length > limit && <button className={button} onClick={() => setLimit(n => n + 20)}>Show more tasks</button>}
        <Link to="/tasks" className="mt-5 block text-sm text-gray-600 underline">All tasks, including undated tasks</Link>
      </>}
    </section> : <section id="leads-panel" role="tabpanel" aria-labelledby="leads-tab">
      {leadLoading ? <p className="py-8 text-gray-500">Checking leads and follow-ups…</p> : leadError ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{leadError}<button className="ml-2 underline" onClick={() => void refresh()}>Retry</button></div> : <>
        {(['follow_up', 'reconnect'] as const).map(reason => { const rows = mainLeads.slice(0, limit).filter(l => l.reason === reason); return rows.length ? <div key={reason} className="mb-5"><h2 className="mb-2 text-sm font-semibold text-gray-700">{reason === 'follow_up' ? 'Follow-ups due' : 'Time to reconnect'}</h2><div className="rounded-xl border bg-white">{rows.map(leadRow)}</div></div> : null; })}
        {!mainLeads.length && <p className="mb-5 rounded-xl border bg-white p-6 text-gray-600">No due follow-ups or 30-day reminders.</p>}
        {mainLeads.length > limit && <button className={button} onClick={() => setLimit(n => n + 20)}>Show more leads</button>}
        {never.length > 0 && <details className="mt-5 rounded-xl border bg-white"><summary className="cursor-pointer p-4 font-medium">Never contacted ({never.length})</summary>{never.slice(0,limit).map(leadRow)}{never.length > limit && <button className={`${button} m-4`} onClick={() => setLimit(n => n + 20)}>Show more</button>}</details>}
        {setup.length > 0 && <details className="mt-5 rounded-xl border border-amber-200 bg-white"><summary className="cursor-pointer p-4 font-medium text-amber-900">Needs setup ({setup.length})</summary><p className="px-4 pb-3 text-sm text-gray-500">Add missing follow-up dates and classify custom statuses before including them in reminders.</p>{setup.slice(0,limit).map(leadRow)}{setup.length > limit && <button className={`${button} m-4`} onClick={() => setLimit(n => n + 20)}>Show more</button>}</details>}
        <Link to="/crm/contacts" className="mt-5 block text-sm text-gray-600 underline">All leads</Link>
      </>}
    </section>}
    {action && user && <ActionDialog action={action} statuses={leadData?.statuses || []} userId={user.id} saveTask={saveTask} onClose={() => setAction(null)} onSaved={(message, warning) => { setAction(null); showToast(message, warning ? 'error' : 'success'); void refresh(); }} />}
  </div>;
}
