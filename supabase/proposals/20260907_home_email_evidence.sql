-- Companion to the Home attention migration. Run once in Planup SQL editor.
-- Exposes only processed contact/interaction identifiers in the caller's workspace.
-- Does not grant access to email contents or change existing ingestion.
begin;
create or replace function public.home_email_contact_evidence(
  p_workspace_id uuid, p_after uuid default null
) returns table (id uuid, contact_id uuid, interaction_id uuid)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
      and not coalesce(wm.only_shopping, false)
      and not coalesce(wm.shopping_only, false)
  ) then
    raise exception 'Workspace access required';
  end if;
  return query
    select e.id, e.contact_id, e.interaction_id
    from public.crm_email_ingestions e
    join public.crm_interactions i on i.id = e.interaction_id
      and i.workspace_id = e.workspace_id and i.contact_id = e.contact_id
    where e.workspace_id = p_workspace_id and e.status = 'processed'
      and i.channel = 'email' and (p_after is null or e.id > p_after)
    order by e.id limit 200;
end;
$$;
revoke all on function public.home_email_contact_evidence(uuid, uuid) from public, anon;
grant execute on function public.home_email_contact_evidence(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
