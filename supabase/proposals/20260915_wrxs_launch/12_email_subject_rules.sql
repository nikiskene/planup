-- WRXS / wrxs.cc — Stage 12. Run manually after 11_feature_board.sql.
-- Subject rules classify newly captured people without overwriting existing CRM statuses.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create unique index if not exists wrxs_crm_lead_statuses_workspace_id_id
  on public.crm_lead_statuses(workspace_id, id);

create table if not exists public.crm_email_subject_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_contains text not null,
  lead_status_id uuid not null,
  enabled boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_email_subject_rules_subject_not_blank check (length(btrim(subject_contains)) between 1 and 160),
  constraint wrxs_crm_email_subject_rules_status_workspace_fk
    foreign key (workspace_id, lead_status_id)
    references public.crm_lead_statuses(workspace_id, id)
    on delete cascade
);

create unique index if not exists crm_email_subject_rules_workspace_marker_unique
  on public.crm_email_subject_rules(workspace_id, lower(btrim(subject_contains)));
create index if not exists crm_email_subject_rules_workspace_enabled
  on public.crm_email_subject_rules(workspace_id)
  where enabled;

alter table public.crm_email_subject_rules enable row level security;

drop policy if exists wrxs_email_subject_rules_read on public.crm_email_subject_rules;
drop policy if exists wrxs_email_subject_rules_insert on public.crm_email_subject_rules;
drop policy if exists wrxs_email_subject_rules_update on public.crm_email_subject_rules;
drop policy if exists wrxs_email_subject_rules_delete on public.crm_email_subject_rules;

create policy wrxs_email_subject_rules_read on public.crm_email_subject_rules
  for select to authenticated using (public.wrxs_can(workspace_id, 'manage_members'));
create policy wrxs_email_subject_rules_insert on public.crm_email_subject_rules
  for insert to authenticated with check (public.wrxs_can(workspace_id, 'manage_members'));
create policy wrxs_email_subject_rules_update on public.crm_email_subject_rules
  for update to authenticated using (public.wrxs_can(workspace_id, 'manage_members'))
  with check (public.wrxs_can(workspace_id, 'manage_members'));
create policy wrxs_email_subject_rules_delete on public.crm_email_subject_rules
  for delete to authenticated using (public.wrxs_can(workspace_id, 'manage_members'));

comment on table public.crm_email_subject_rules is
  'Workspace-private subject markers for wrxs capture. A matching rule assigns its selected relationship status only when capture creates a new CRM contact; existing contact statuses are never overwritten.';

commit;

select '12 complete: private WRXS subject rules installed; rules classify new capture contacts only' as result;
