-- Planup offline sync: preserve every ambiguous merge for later recovery.
-- Apply this migration in the Supabase SQL editor before enabling offline writes.

create table if not exists public.offline_lost_and_found (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  entity_table text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  reason text not null,
  base_record jsonb,
  local_record jsonb,
  server_record jsonb,
  status text not null default 'unresolved'
    check (status in ('unresolved', 'kept_local', 'kept_server', 'merged', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index if not exists offline_lost_and_found_workspace_status_idx
  on public.offline_lost_and_found (workspace_id, status, created_at desc);

create index if not exists offline_lost_and_found_entity_idx
  on public.offline_lost_and_found (workspace_id, entity_table, entity_id);

alter table public.offline_lost_and_found enable row level security;

drop policy if exists "Workspace members can view offline conflicts"
  on public.offline_lost_and_found;

create policy "Workspace members can view offline conflicts"
  on public.offline_lost_and_found
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = offline_lost_and_found.workspace_id
        and wm.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can preserve their own offline conflicts"
  on public.offline_lost_and_found;

create policy "Users can preserve their own offline conflicts"
  on public.offline_lost_and_found
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = offline_lost_and_found.workspace_id
        and wm.user_id = (select auth.uid())
    )
  );

drop policy if exists "Workspace members can resolve offline conflicts"
  on public.offline_lost_and_found;

create policy "Workspace members can resolve offline conflicts"
  on public.offline_lost_and_found
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = offline_lost_and_found.workspace_id
        and wm.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = offline_lost_and_found.workspace_id
        and wm.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.offline_lost_and_found to authenticated;

comment on table public.offline_lost_and_found is
  'Preserves local and server versions when Planup offline sync cannot safely merge them.';
