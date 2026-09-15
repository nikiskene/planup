-- WRXS / wrxs.cc — Stage 1. Run manually after 00_preflight.sql.
-- Transactional and rerunnable. No business records are deleted or moved.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Read membership without recursively invoking workspace_members RLS.
-- Identity always comes from the authenticated session, never a supplied user ID.
create or replace function public.wrxs_can(p_workspace_id uuid, p_permission text default 'read')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid())
      and not coalesce(m.only_shopping, false)
      and not coalesce(m.shopping_only, false)
      and case
        when p_permission = 'read' then true
        when p_permission not in ('write','create_tasks','edit_others_tasks','assign_tasks','manage_members','manage_dues','manage_bookings') then false
        when m.role::text in ('owner','admin') then true
        when m.role::text = 'viewer' then false
        when p_permission = 'write' then true
        when p_permission = 'create_tasks' then coalesce(m.can_create_tasks,false)
        when p_permission = 'edit_others_tasks' then coalesce(m.can_edit_others_tasks,false)
        when p_permission = 'assign_tasks' then coalesce(m.can_assign_tasks,false)
        when p_permission = 'manage_members' then coalesce(m.can_manage_members,false)
        when p_permission = 'manage_dues' then coalesce(m.can_manage_dues,false)
        when p_permission = 'manage_bookings' then coalesce(m.can_manage_bookings,false)
        else false
      end
  );
$$;
revoke all on function public.wrxs_can(uuid,text) from public, anon;
grant execute on function public.wrxs_can(uuid,text) to authenticated, service_role;

create or replace function public.wrxs_can_read_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_profile_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_profile_id
      and not coalesce(mine.only_shopping,false) and not coalesce(mine.shopping_only,false)
  );
$$;
revoke all on function public.wrxs_can_read_profile(uuid) from public, anon;
grant execute on function public.wrxs_can_read_profile(uuid) to authenticated, service_role;

-- Replace the audited profile rules: an OR-combined "true" rule defeats narrower rules.
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_upsert_own on public.profiles;
drop policy if exists wrxs_profiles_read on public.profiles;
drop policy if exists wrxs_profiles_update on public.profiles;
create policy wrxs_profiles_read on public.profiles for select to authenticated
  using (public.wrxs_can_read_profile(id));
create policy wrxs_profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;
-- Signup continues to create profiles through the existing handle_new_user trigger.

-- Full workspace members can see collaborators; shopping-only users see themselves.
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or public.wrxs_can(workspace_id,'read'));
drop policy if exists wrxs_members_insert on public.workspace_members;
drop policy if exists wrxs_members_update on public.workspace_members;
drop policy if exists wrxs_members_delete on public.workspace_members;
create policy wrxs_members_insert on public.workspace_members as restrictive for insert to authenticated
  with check (public.wrxs_can(workspace_id,'manage_members'));
create policy wrxs_members_update on public.workspace_members as restrictive for update to authenticated
  using (public.wrxs_can(workspace_id,'manage_members')) with check (public.wrxs_can(workspace_id,'manage_members'));
create policy wrxs_members_delete on public.workspace_members as restrictive for delete to authenticated
  using (public.wrxs_can(workspace_id,'manage_members'));

-- RESTRICTIVE rules are AND-combined with all existing permissive rules.
-- Preserve existing collaboration semantics while enforcing the account/workspace boundary.
do $$
declare t text;
begin
  foreach t in array array['tasks','notes','categories','crm_companies','crm_contacts','crm_contact_tags',
    'crm_deals','crm_interactions','crm_tags','crm_lead_statuses','dues','bookings','meeting_types',
    'offline_lost_and_found','qr_codes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists wrxs_workspace_boundary on public.%I', t);
    execute format('create policy wrxs_workspace_boundary on public.%I as restrictive for all to authenticated using (public.wrxs_can(workspace_id,''read'')) with check (public.wrxs_can(workspace_id,''read''))', t);
  end loop;
end;
$$;

-- Honor task permissions even if an older broad rule would otherwise allow writes.
drop policy if exists wrxs_tasks_insert on public.tasks;
drop policy if exists wrxs_tasks_update on public.tasks;
drop policy if exists wrxs_tasks_delete on public.tasks;
create policy wrxs_tasks_insert on public.tasks as restrictive for insert to authenticated
  with check (created_by = (select auth.uid()) and public.wrxs_can(workspace_id,'create_tasks'));
create policy wrxs_tasks_update on public.tasks as restrictive for update to authenticated
  using (public.wrxs_can(workspace_id,'write') and (created_by = (select auth.uid()) or public.wrxs_can(workspace_id,'edit_others_tasks')))
  with check (public.wrxs_can(workspace_id,'write') and (created_by = (select auth.uid()) or public.wrxs_can(workspace_id,'edit_others_tasks')));
create policy wrxs_tasks_delete on public.tasks as restrictive for delete to authenticated
  using (public.wrxs_can(workspace_id,'write') and (created_by = (select auth.uid()) or public.wrxs_can(workspace_id,'edit_others_tasks')));

do $$
declare t text; permission text;
begin
  foreach t in array array['notes','crm_companies','crm_contacts','crm_contact_tags','crm_deals','crm_interactions','crm_tags','qr_codes','categories','crm_lead_statuses','dues','bookings','meeting_types','offline_lost_and_found'] loop
    permission := case when t in ('categories','crm_lead_statuses') then 'manage_members'
      when t='dues' then 'manage_dues' when t in ('bookings','meeting_types') then 'manage_bookings' else 'write' end;
    execute format('drop policy if exists wrxs_write_insert on public.%I',t);
    execute format('drop policy if exists wrxs_write_update on public.%I',t);
    execute format('drop policy if exists wrxs_write_delete on public.%I',t);
    execute format('create policy wrxs_write_insert on public.%I as restrictive for insert to authenticated with check (public.wrxs_can(workspace_id,%L))',t,permission);
    execute format('create policy wrxs_write_update on public.%I as restrictive for update to authenticated using (public.wrxs_can(workspace_id,%L)) with check (public.wrxs_can(workspace_id,%L))',t,permission,permission);
    execute format('create policy wrxs_write_delete on public.%I as restrictive for delete to authenticated using (public.wrxs_can(workspace_id,%L))',t,permission);
  end loop;
end;
$$;

-- Prevent moving a record or changing its attribution during a normal update.
-- Allows existing automation to update content; it has no reason to rewrite ownership.
create or replace function public.wrxs_protect_record_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new)->'workspace_id') is distinct from (to_jsonb(old)->'workspace_id')
     or (to_jsonb(new)->'created_by') is distinct from (to_jsonb(old)->'created_by')
     or (to_jsonb(new)->'id') is distinct from (to_jsonb(old)->'id') then
    raise exception 'Record identity and workspace cannot be changed' using errcode='42501';
  end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['tasks','notes','categories','crm_companies','crm_contacts','crm_contact_tags','crm_deals','crm_interactions','crm_tags','dues','bookings','meeting_types','shopping_items','shopping_lists'] loop
    execute format('drop trigger if exists wrxs_protect_identity on public.%I',t);
    execute format('create trigger wrxs_protect_identity before update on public.%I for each row execute function public.wrxs_protect_record_identity()',t);
  end loop;
end;
$$;

-- Signed-in writes cannot attribute new records to another person.
-- Null attribution is filled for older CRM forms that do not supply created_by.
create or replace function public.wrxs_set_record_actor()
returns trigger language plpgsql set search_path='' as $$
begin
  if auth.uid() is not null then
    if new.created_by is null then new.created_by:=auth.uid();
    elsif new.created_by<>auth.uid() then
      raise exception 'Record creator must match the signed-in user' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['tasks','notes','categories','crm_companies','crm_contacts','crm_contact_tags','crm_interactions','crm_tags','dues','bookings','meeting_types','shopping_items','shopping_lists','qr_codes'] loop
    execute format('drop trigger if exists wrxs_set_actor on public.%I',t);
    execute format('create trigger wrxs_set_actor before insert on public.%I for each row execute function public.wrxs_set_record_actor()',t);
  end loop;
end $$;

-- Existing views already use security_invoker. Reassert the audited setting.
do $$
declare v text;
begin
  foreach v in array array['crm_contacts_with_tags','shopping_item_suggestions','v_crm_contact_detail','v_crm_contact_task_status','v_crm_contacts_index','v_crm_contacts_status','v_tasks_with_crm'] loop
    execute format('alter view public.%I set (security_invoker=true)',v);
    execute format('revoke all on public.%I from anon',v);
  end loop;
end;
$$;

-- SECURITY DEFINER entrypoints bypass RLS and need the same explicit guards.
CREATE OR REPLACE FUNCTION public.crm_log_interaction(p_workspace_id uuid, p_contact_id uuid, p_channel crm_channel, p_occurred_at timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_next_action crm_next_action DEFAULT 'none'::crm_next_action, p_reconnect_in_days integer DEFAULT NULL::integer, p_create_task boolean DEFAULT true, p_task_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_interaction_id uuid;
  v_task_id uuid;
  v_due_at timestamptz;
  v_title text;
begin
  if not public.wrxs_can(p_workspace_id,'write') then raise exception 'Workspace write access required' using errcode='42501'; end if;
  if p_create_task and not public.wrxs_can(p_workspace_id,'create_tasks') then raise exception 'Task creation permission required' using errcode='42501'; end if;
  if not public.is_workspace_member(p_workspace_id, auth.uid()) then
    raise exception 'not a workspace member';
  end if;

  if p_next_action = 'reconnect' and p_reconnect_in_days is not null then
    v_due_at := now() + make_interval(days => p_reconnect_in_days);
  else
    v_due_at := null;
  end if;

  insert into public.crm_interactions (
    workspace_id,
    contact_id,
    occurred_at,
    channel,
    note,
    next_action,
    reconnect_in_days,
    created_by
  )
  values (
    p_workspace_id,
    p_contact_id,
    coalesce(p_occurred_at, now()),
    p_channel,
    p_note,
    coalesce(p_next_action, 'none'::public.crm_next_action),
    p_reconnect_in_days,
    auth.uid()
  )
  returning id into v_interaction_id;

  if p_create_task
     and p_next_action = 'reconnect'
     and p_reconnect_in_days is not null
     and p_reconnect_in_days > 0 then

    v_title := coalesce(nullif(trim(p_task_title), ''), 'Reconnect');

    insert into public.tasks (
      workspace_id,
      title,
      status,
      due_at,
      created_by,
      crm_contact_id
    )
    values (
      p_workspace_id,
      v_title,
      'next'::task_status,   -- adjust if your task_status enum differs
      v_due_at,
      auth.uid(),
      p_contact_id
    )
    returning id into v_task_id;
  end if;

  return v_interaction_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_member_contributor(p_workspace_id uuid, p_user_id uuid, p_can_set_p0 boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid;
begin
  if not public.wrxs_can(p_workspace_id,'manage_members') then raise exception 'Workspace member management required' using errcode='42501'; end if;
  uid := auth.uid();
  if uid is null then raise exception 'Authentication required'; end if;

  if not public.member_can(p_workspace_id, uid, 'manage_members') then
    raise exception 'Not allowed to manage members';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role,
    can_create_tasks, can_assign_tasks, can_set_priority_p0,
    can_edit_others_tasks, can_manage_dues, can_manage_bookings, can_manage_members
  ) values (
    p_workspace_id, p_user_id, 'contributor',
    true, true, p_can_set_p0,
    false, false, false, false
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        can_create_tasks = excluded.can_create_tasks,
        can_assign_tasks = excluded.can_assign_tasks,
        can_set_priority_p0 = excluded.can_set_priority_p0,
        can_edit_others_tasks = excluded.can_edit_others_tasks,
        can_manage_dues = excluded.can_manage_dues,
        can_manage_bookings = excluded.can_manage_bookings,
        can_manage_members = excluded.can_manage_members;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_member_by_email(p_workspace_id uuid, p_email text, p_can_set_p0 boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid;
  target_user_id uuid;
begin
  if not public.wrxs_can(p_workspace_id,'manage_members') then raise exception 'Workspace member management required' using errcode='42501'; end if;
  caller := auth.uid();
  if caller is null then
    raise exception 'Authentication required';
  end if;

  -- permission: only member managers can add members
  if not public.member_can(p_workspace_id, caller, 'manage_members') then
    raise exception 'Not allowed to manage members';
  end if;

  -- lookup user by email (must exist already)
  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No user found with that email';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role,
    can_create_tasks, can_assign_tasks, can_set_priority_p0,
    can_edit_others_tasks, can_manage_dues, can_manage_bookings, can_manage_members
  ) values (
    p_workspace_id, target_user_id, 'contributor',
    true, true, p_can_set_p0,
    false, false, false, false
  )
  on conflict (workspace_id, user_id) do update
    set can_set_priority_p0 = excluded.can_set_priority_p0;

  return target_user_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_crm_lead_status(p_workspace_id uuid, p_status_key text, p_fallback_key text DEFAULT 'connected'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  moved_people integer := 0;
begin
  if not public.wrxs_can(p_workspace_id,'manage_members') then raise exception 'Workspace member management required' using errcode='42501'; end if;
  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.can_manage_members = true
  ) then
    raise exception
      'You do not have permission to manage relationship statuses';
  end if;

  if not exists (
    select 1
    from public.crm_lead_statuses status
    where status.workspace_id = p_workspace_id
      and status.key = p_status_key
      and status.is_system = false
  ) then
    raise exception
      'Only custom relationship statuses can be deleted';
  end if;

  if not exists (
    select 1
    from public.crm_lead_statuses fallback
    where fallback.workspace_id = p_workspace_id
      and fallback.key = p_fallback_key
      and fallback.is_system = true
  ) then
    raise exception
      'The fallback must be an immutable system status';
  end if;

  update public.crm_contacts
  set
    lead_status = p_fallback_key,
    updated_at = now()
  where workspace_id = p_workspace_id
    and lead_status = p_status_key;

  get diagnostics moved_people = row_count;

  delete from public.crm_lead_statuses
  where workspace_id = p_workspace_id
    and key = p_status_key
    and is_system = false;

  return moved_people;
end;
$function$
;

commit;
select '01 complete: profile privacy and workspace restrictions installed' as result;
