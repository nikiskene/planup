-- Run manually after stage 07. Grants permanent founder access to Niki's workspace.
-- This does not make the Niki profile globally privileged or enable paid-only access.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.wrxs_access_grants in share row exclusive mode;

alter table public.wrxs_access_grants
  alter column expires_at drop not null;

alter table public.wrxs_access_grants
  drop constraint if exists wrxs_access_grants_check;

alter table public.wrxs_access_grants
  add constraint wrxs_access_grants_check
  check (expires_at is null or expires_at > starts_at);

create or replace function public.wrxs_has_active_access(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.wrxs_can(p_workspace_id,'read') and (
    exists(select 1 from public.wrxs_subscriptions s where s.workspace_id=p_workspace_id
      and s.status in ('active','trialing') and s.access_until>now())
    or exists(select 1 from public.wrxs_access_grants g where g.workspace_id=p_workspace_id
      and g.revoked_at is null and g.starts_at<=now()
      and (g.expires_at is null or g.expires_at>now()))
  );
$$;

do $$
declare grant_row public.wrxs_access_grants;
begin
  if not exists(
    select 1 from public.workspaces
    where id = 'ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f'
      and created_by = 'f631a75e-e681-4188-ae63-756449d0dceb'
  ) then
    raise exception 'Niki workspace ownership does not match the confirmed profile. No access grant was changed.';
  end if;

  select * into grant_row from public.wrxs_access_grants
  where workspace_id = 'ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f'
    and reason = 'founder'
  order by created_at
  limit 1
  for update;

  if found and grant_row.created_by <> 'f631a75e-e681-4188-ae63-756449d0dceb' then
    raise exception 'A founder grant exists with a different creator. Review it before changing access.';
  end if;

  if found then
    update public.wrxs_access_grants
      set starts_at = least(starts_at, clock_timestamp()), expires_at = null, revoked_at = null
      where id = grant_row.id;
  else
    insert into public.wrxs_access_grants(workspace_id, reason, expires_at, created_by)
      values('ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f', 'founder', null, 'f631a75e-e681-4188-ae63-756449d0dceb');
  end if;
end $$;

commit;

select workspace_id, reason, starts_at, expires_at, revoked_at, created_by
from public.wrxs_access_grants
where workspace_id = 'ed0d87eb-2ec0-4ca8-8e2d-92d65b305c4f'
  and reason = 'founder';
