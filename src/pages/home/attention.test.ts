import { describe, expect, it } from 'vitest';
import { leadAttention, taskAttention, type Activity, type HomeTask, type Lead, type LeadStatus, type Ingestion } from './attention';
const now = new Date(2026, 8, 7, 15);
const lead: Lead = { id: 'a', workspace_id: 'w', first_name: 'Alex', last_name: null, email: null, company_id: null, lead_status: 'in_progress', is_active: true, attention_reopened_at: null, created_at: '2026-01-01' };
const statuses: LeadStatus[] = [{ id: 's', key: 'in_progress', name: 'In progress', is_system: true, home_attention_mode: null },
  { id: 'b', key: 'bad_timing', name: 'Bad timing', is_system: true, home_attention_mode: null },
  { id: 'l', key: 'custom_lost', name: 'Lost', is_system: false, home_attention_mode: 'excluded' }];
const activity: Activity = { id: 'i', contact_id: 'a', occurred_at: new Date(2026, 7, 8, 12).toISOString(), created_at: '2026-08-08T12:00:00Z', channel: 'email', activity_kind: 'contact', next_action: 'none', reconnect_in_days: null };
const task = (patch: Partial<HomeTask> = {}) => ({ id: 't', workspace_id: 'w', title: 'Follow up', status: 'next', priority: 'P1', due_at: '2026-09-07T00:00:00Z', crm_contact_id: 'a', is_crm_follow_up: true, updated_at: '2026-09-01T00:00:00Z', ...patch } as HomeTask);
const run = (l: Partial<Lead> = {}, a: Activity[] = [activity], t: HomeTask[] = [], ingestion: Ingestion[] = []) => leadAttention([{ ...lead, ...l }], a, t, statuses, ingestion, [], now);
describe('Home lead attention', () => {
  it('includes exactly 30 calendar days', () => expect(run()[0].reason).toBe('reconnect'));
  it('does not include 29 days', () => expect(run({}, [{ ...activity, occurred_at: new Date(2026,7,9,12).toISOString() }])).toHaveLength(0));
  it('keeps never-contacted leads separate', () => expect(run({}, [])[0].reason).toBe('never'));
  it('does not mistake attempts and notes for contact', () => {
    for (const activity_kind of ['attempt','note'] as const) expect(run({}, [{ ...activity, activity_kind }])[0].reason).toBe('never');
  });
  it('does not let recent internal notes reset contact', () => expect(run({}, [activity, { ...activity, id: 'n', occurred_at: now.toISOString(), activity_kind: 'note' }])[0].reason).toBe('reconnect'));
  it('does not assume unclassified historical activity was contact', () => expect(run({}, [{ ...activity, activity_kind: null }])[0]).toMatchObject({ reason: 'never', unknownHistory: true }));
  it('counts verified imported email without changing ingestion', () => expect(run({}, [{ ...activity, activity_kind: null }], [], [{ id: 'e', contact_id: 'a', interaction_id: 'i' }])[0].reason).toBe('reconnect'));
  it('does not match evidence from a different contact', () => expect(run({}, [{ ...activity, activity_kind: null }], [], [{ id: 'e', contact_id: 'other', interaction_id: 'i' }])[0].reason).toBe('never'));
  it('honours explicit note classification over ingestion evidence', () => expect(run({}, [{ ...activity, activity_kind: 'note' }], [], [{ id: 'e', contact_id: 'a', interaction_id: 'i' }])[0].reason).toBe('never'));
  it('ignores future activity', () => expect(run({}, [{ ...activity, occurred_at: '2030-01-01T00:00:00Z' }])[0].reason).toBe('never'));
  it('suppresses stale and never-contacted leads with future follow-up', () => {
    for (const a of [[activity], []]) expect(run({}, a, [task({ due_at: '2026-09-08T00:00:00Z' })])).toHaveLength(0);
  });
  it('does not let generic tasks suppress outreach', () => expect(run({}, [activity], [task({ is_crm_follow_up: false, due_at: '2026-09-08T00:00:00Z' })])[0].reason).toBe('reconnect'));
  it('recognizes legacy explicitly requested reconnect tasks', () => expect(run({}, [{ ...activity, next_action: 'reconnect' }], [task({ is_crm_follow_up: false, crm_interaction_id: 'i', due_at: '2026-09-08T00:00:00Z' })])).toHaveLength(0));
  it('ignores done and archived reminders', () => { for (const status of ['done', 'archived']) expect(run({}, [activity], [task({ status: status as HomeTask['status'], due_at: '2026-09-08T00:00:00Z' })])[0].reason).toBe('reconnect'); });
  it('brings bad timing back on the follow-up date', () => expect(run({ lead_status: 'bad_timing' }, [], [task()])[0].reason).toBe('follow_up'));
  it('puts bad timing without a date in setup', () => expect(run({ lead_status: 'bad_timing' })[0].reason).toBe('missing_date'));
  it('suppresses future bad timing', () => expect(run({ lead_status: 'bad_timing' }, [], [task({ due_at: '2026-09-08T00:00:00Z' })])).toHaveLength(0));
  it('excludes passive routine reminders, but honours explicit due dates', () => { expect(run({ is_active: false })).toHaveLength(0); expect(run({ is_active: false }, [], [task()])[0].reason).toBe('follow_up'); });
  it('excludes closed/lost even when a follow-up is due', () => expect(run({ lead_status: 'custom_lost' }, [], [task()])).toHaveLength(0));
  it('does not guess unclassified custom status rules', () => expect(run({ lead_status: 'unknown_custom' })[0].reason).toBe('classify'));
  it('excludes disconnected unless explicitly reopened', () => {
    expect(run({}, [{ ...activity, next_action: 'disconnect' }])).toHaveLength(0);
    expect(run({ attention_reopened_at: '2026-09-01T00:00:00Z' }, [{ ...activity, next_action: 'disconnect' }])[0].reason).toBe('reconnect');
  });
  it('shows each contact once and does not hide overdue commitments behind a second future task', () => expect(run({}, [activity], [task(), task({ id: 'future', due_at: '2026-09-09T00:00:00Z' })])).toMatchObject([{ reason: 'follow_up' }]));
});
describe('Home tasks', () => {
  it('groups overdue before today and sorts priorities within groups', () => {
    const rows = [task({ id: 'today', priority: 'P0' }), task({ id: 'old-low', priority: 'P2', due_at: '2026-08-01' }), task({ id: 'old-high', priority: 'P0', due_at: '2026-09-01' })];
    expect(taskAttention(rows, '2026-09-07').map(t => t.id)).toEqual(['old-high','old-low','today']);
  });
  it('includes waiting but excludes completed, archived, undated and future', () => {
    const rows = [task({ id: 'waiting', status: 'waiting' }), task({ status: 'done' }), task({ status: 'archived' as HomeTask['status'] }), task({ due_at: null }), task({ due_at: '2026-09-08' })];
    expect(taskAttention(rows, '2026-09-07').map(t => t.id)).toEqual(['waiting']);
  });
});
