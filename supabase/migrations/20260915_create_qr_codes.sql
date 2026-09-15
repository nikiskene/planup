-- Static, workspace-owned QR records. Generation never requires this table.
-- Apply after checking workspace_members has the deployed only_shopping flag.
begin;
create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  name text not null check (char_length(name) between 1 and 200),
  type text not null check (type in ('url','text','email','phone','whatsapp','wifi','vcard','event')),
  payload text not null check (octet_length(payload) between 1 and 20000),
  input_data jsonb not null check (jsonb_typeof(input_data) = 'object'),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qr_codes_workspace_created_idx on public.qr_codes(workspace_id, created_at desc, id);
alter table public.qr_codes enable row level security;
create policy qr_workspace_select on public.qr_codes for select to authenticated using (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = qr_codes.workspace_id and wm.user_id = (select auth.uid()) and not coalesce(wm.only_shopping, false))
);
create policy qr_workspace_insert on public.qr_codes for insert to authenticated with check (
  created_by = (select auth.uid()) and
  exists (select 1 from public.workspace_members wm where wm.workspace_id = qr_codes.workspace_id and wm.user_id = (select auth.uid()) and not coalesce(wm.only_shopping, false))
);
create policy qr_workspace_update on public.qr_codes for update to authenticated using (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = qr_codes.workspace_id and wm.user_id = (select auth.uid()) and not coalesce(wm.only_shopping, false))
) with check (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = qr_codes.workspace_id and wm.user_id = (select auth.uid()) and not coalesce(wm.only_shopping, false))
);
create policy qr_workspace_delete on public.qr_codes for delete to authenticated using (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = qr_codes.workspace_id and wm.user_id = (select auth.uid()) and not coalesce(wm.only_shopping, false))
);
-- Ownership and timestamps cannot be rewritten by callers.
create function public.qr_codes_before_update() returns trigger language plpgsql set search_path = '' as $$
begin
  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger qr_codes_before_update before update on public.qr_codes for each row execute function public.qr_codes_before_update();
revoke all on public.qr_codes from anon, authenticated;
grant select, insert, delete on public.qr_codes to authenticated;
grant update (name, type, payload, input_data, configuration) on public.qr_codes to authenticated;
comment on table public.qr_codes is 'Explicitly saved static QR content. No public access or scan tracking. source_type/source_id reserve future object associations. Dynamic redirect infrastructure is intentionally not enabled.';
commit;
