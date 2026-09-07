import type { Database } from '../../lib/types';

export type HomeTask = Database['public']['Tables']['tasks']['Row'] & {
  crm_contact_id?: string | null;
  crm_interaction_id?: string | null;
  is_crm_follow_up?: boolean;
};
export type AttentionMode = 'normal' | 'deferred' | 'excluded';
export type LeadStatus = { id: string; key: string; name: string; is_system: boolean; home_attention_mode: AttentionMode | null };
export type Lead = {
  id: string; workspace_id: string; first_name: string | null; last_name: string | null;
  email: string | null; company_id: string | null; lead_status: string | null;
  is_active: boolean; attention_reopened_at: string | null; created_at: string;
};
export type Activity = {
  id: string; contact_id: string; occurred_at: string; created_at: string;
  channel: string; activity_kind: 'contact' | 'attempt' | 'note' | null;
  next_action: string; reconnect_in_days: number | null;
};
export type Ingestion = { id: string; contact_id: string | null; interaction_id: string | null };
export type LeadReason = 'follow_up' | 'reconnect' | 'never' | 'missing_date' | 'classify';
export type AttentionLead = Lead & {
  name: string; company: string | null; statusName: string; mode: AttentionMode | null;
  reason: LeadReason; lastContact: Activity | null; unknownHistory: boolean;
  followUps: HomeTask[]; age: number | null;
};
export const openTask = (task: { status: string }) => ['inbox', 'next', 'waiting', 'scheduled'].includes(task.status);
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
// Tasks are edited as calendar dates throughout Planup; preserve their stored date.
export const dueDay = (value: string) => value.slice(0, 10);
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
export function modeFor(status: Pick<LeadStatus, 'key' | 'home_attention_mode'> | undefined): AttentionMode | null {
  if (!status) return 'normal';
  if (status.key === 'bad_timing') return 'deferred';
  if (['in_progress', 'connected'].includes(status.key)) return 'normal';
  return status.home_attention_mode;
}
export function taskAttention(tasks: HomeTask[], today: string) {
  return tasks.filter(t => openTask(t) && t.due_at && dueDay(t.due_at) <= today)
    .sort((a, b) => Number(dueDay(a.due_at!) === today) - Number(dueDay(b.due_at!) === today)
      || a.priority.localeCompare(b.priority) || a.due_at!.localeCompare(b.due_at!) || a.id.localeCompare(b.id));
}
export function leadAttention(leads: Lead[], activities: Activity[], tasks: HomeTask[], statuses: LeadStatus[],
  ingestions: Ingestion[], companies: { id: string; name: string }[], now = new Date()): AttentionLead[] {
  const today = todayKey(now);
  const statusMap = new Map(statuses.map(s => [s.key, s]));
  const companyMap = new Map(companies.map(c => [c.id, c.name]));
  const imported = new Set(ingestions.filter(i => i.contact_id && i.interaction_id).map(i => `${i.contact_id}:${i.interaction_id}`));
  const activityMap = new Map(activities.map(i => [i.id, i]));
  const byContact = new Map<string, Activity[]>();
  for (const activity of activities) {
    const rows = byContact.get(activity.contact_id) || [];
    rows.push(activity); byContact.set(activity.contact_id, rows);
  }
  const followByContact = new Map<string, HomeTask[]>();
  for (const task of tasks) {
    const origin = task.crm_interaction_id ? activityMap.get(task.crm_interaction_id) : undefined;
    if (!task.crm_contact_id || !openTask(task) || !(task.is_crm_follow_up ||
      (origin?.contact_id === task.crm_contact_id && origin.next_action === 'reconnect'))) continue;
    const rows = followByContact.get(task.crm_contact_id) || [];
    rows.push(task); followByContact.set(task.crm_contact_id, rows);
  }
  const result: AttentionLead[] = [];
  for (const lead of leads) {
    const status = lead.lead_status ? statusMap.get(lead.lead_status) : undefined;
    const mode = lead.lead_status && !status ? null : modeFor(status);
    const history = (byContact.get(lead.id) || []).sort((a,b) => b.occurred_at.localeCompare(a.occurred_at) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const decision = history.find(i => ['disconnect', 'reconnect'].includes(i.next_action) && Date.parse(i.occurred_at) <= now.getTime());
    if (mode === 'excluded' || (decision?.next_action === 'disconnect' &&
      (!lead.attention_reopened_at || Date.parse(decision.created_at) > Date.parse(lead.attention_reopened_at)))) continue;
    const lastContact = history.find(i => Date.parse(i.occurred_at) <= now.getTime() &&
      (i.activity_kind === 'contact' || (i.activity_kind === null && i.channel === 'email' && imported.has(`${lead.id}:${i.id}`)))) || null;
    const unknownHistory = history.some(i => i.activity_kind === null && !imported.has(`${lead.id}:${i.id}`));
    const followUps = (followByContact.get(lead.id) || []).sort((a,b) => (a.due_at || '9999').localeCompare(b.due_at || '9999') || a.id.localeCompare(b.id));
    const due = followUps.some(t => t.due_at && dueDay(t.due_at) <= today);
    const future = followUps.some(t => t.due_at && dueDay(t.due_at) > today);
    const age = lastContact ? daysBetween(todayKey(new Date(lastContact.occurred_at)), today) : null;
    let reason: LeadReason | null = null;
    if (mode === null) reason = 'classify';
    else if (due) reason = 'follow_up';
    else if (future) continue;
    else if (mode === 'deferred') reason = 'missing_date';
    else if (!lead.is_active) continue;
    else if (!lastContact) reason = 'never';
    else if (age !== null && age >= 30) reason = 'reconnect';
    if (reason) result.push({ ...lead, name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email || 'Unnamed person',
      company: lead.company_id ? companyMap.get(lead.company_id) || null : null,
      statusName: status?.name || 'No status', mode, reason, lastContact, unknownHistory, followUps, age });
  }
  const order = { follow_up: 0, reconnect: 1, never: 2, missing_date: 3, classify: 4 };
  return result.sort((a,b) => order[a.reason] - order[b.reason]
    || (a.reason === 'follow_up' ? (a.followUps[0]?.due_at || '').localeCompare(b.followUps[0]?.due_at || '') : 0)
    || (b.age || 0) - (a.age || 0) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
