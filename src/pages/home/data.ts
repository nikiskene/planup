import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Activity, HomeTask, Ingestion, Lead, LeadStatus } from './attention';

// CRM tables are not yet included in the older generated Database type.
export const crm = supabase as unknown as SupabaseClient;
export async function allRows<T>(table: string, columns: string, workspace: string, filter?: [string, string]): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    let query = crm.from(table).select(columns).eq('workspace_id', workspace).order('id').limit(200);
    if (cursor) query = query.gt('id', cursor);
    if (filter) query = query.eq(...filter);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data as unknown as T[]);
    const next = (data[data.length - 1] as unknown as { id: string }).id;
    if (!next || next === cursor) throw new Error('Unable to finish loading records. Please refresh.');
    cursor = next;
  }
}
async function loadEmailEvidence(workspace: string): Promise<Ingestion[]> {
  const rows: Ingestion[] = [];
  let cursor: string | null = null;
  for (;;) {
    const { data, error } = await crm.rpc('home_email_contact_evidence', { p_workspace_id: workspace, p_after: cursor });
    if (error) throw new Error('Confirmed email history is unavailable. The Home email-evidence SQL must be installed.');
    const page = data as Ingestion[];
    if (!page?.length) return rows;
    rows.push(...page);
    const next = page[page.length - 1].id;
    if (next === cursor) throw new Error('Unable to finish loading email history.');
    cursor = next;
  }
}
export const loadTasks = (workspace: string) => allRows<HomeTask>('tasks', '*', workspace);
export async function loadLeads(workspace: string) {
  const [leads, activities, statuses, ingestions, companies, tasks] = await Promise.all([
    allRows<Lead>('crm_contacts', 'id,workspace_id,first_name,last_name,email,company_id,lead_status,is_active,attention_reopened_at,created_at', workspace),
    allRows<Activity>('crm_interactions', 'id,contact_id,occurred_at,created_at,channel,activity_kind,next_action,reconnect_in_days', workspace),
    allRows<LeadStatus>('crm_lead_statuses', 'id,key,name,is_system,home_attention_mode', workspace),
    loadEmailEvidence(workspace),
    allRows<{ id: string; name: string }>('crm_companies', 'id,name', workspace),
    loadTasks(workspace),
  ]);
  return { leads, activities, statuses, ingestions, companies, tasks };
}
