import { crm, allRows } from './data';
import { openTask, type Activity, type AttentionLead, type HomeTask } from './attention';

export async function updateTask(task: HomeTask, patch: Partial<HomeTask>) {
  const { data, error } = await crm.from('tasks').update(patch).eq('workspace_id', task.workspace_id)
    .eq('id', task.id).eq('updated_at', task.updated_at).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This task changed or is no longer editable. Refresh and try again.');
}
async function followUpId(workspace: string, contact: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`planup-follow-up:${workspace}:${contact}`)));
  bytes[6] = (bytes[6] & 15) | 128; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0,16), b => b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function scheduleFollowUp(lead: AttentionLead, date: string, userId: string) {
  const [tasks, activities] = await Promise.all([
    allRows<HomeTask>('tasks', '*', lead.workspace_id),
    allRows<Activity>('crm_interactions', 'id,contact_id,next_action', lead.workspace_id),
  ]);
  const reconnect = new Set(activities.filter(i => i.contact_id === lead.id && i.next_action === 'reconnect').map(i => i.id));
  const existing = tasks.filter(t => t.crm_contact_id === lead.id && openTask(t) &&
    (t.is_crm_follow_up || (t.crm_interaction_id && reconnect.has(t.crm_interaction_id))))
    .sort((a,b) => a.id.localeCompare(b.id));
  const due_at = `${date}T00:00:00.000Z`;
  if (existing.length) {
    await updateTask(existing[0], { due_at, is_crm_follow_up: true });
  } else {
    const id = await followUpId(lead.workspace_id, lead.id);
    const previous = tasks.find(t => t.id === id);
    if (previous) {
      if (previous.crm_contact_id !== lead.id || !previous.is_crm_follow_up) throw new Error('Follow-up conflict. Refresh before continuing.');
      await updateTask(previous, { status: 'scheduled', due_at });
    } else {
      const { error } = await crm.from('tasks').insert({ id, workspace_id: lead.workspace_id,
        title: `Follow up: ${lead.name}`, status: 'scheduled', priority: 'P1', due_at,
        created_by: userId, crm_contact_id: lead.id, crm_company_id: lead.company_id,
        is_crm_follow_up: true, next_step: 'Reconnect', time_estimate_min: 5 });
      if (error) throw error;
    }
  }
  // Keep one current reminder. Never touch generic contact-linked tasks.
  for (const extra of existing.slice(1)) {
    try { await updateTask(extra, { status: 'archived' as HomeTask['status'] }); }
    catch { throw new Error('The new date was saved, but an older reminder could not be archived. Refresh and review the remaining follow-ups.'); }
  }
}
