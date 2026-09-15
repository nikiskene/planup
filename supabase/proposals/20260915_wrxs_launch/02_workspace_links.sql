-- WRXS Stage 2: prevent links between records in unrelated workspaces.
-- Stops if existing records conflict. Does not guess, move, or delete conflicting data.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create unique index if not exists wrxs_categories_workspace_id_id on public.categories(workspace_id,id);
create unique index if not exists wrxs_crm_companies_workspace_id_id on public.crm_companies(workspace_id,id);
create unique index if not exists wrxs_crm_contacts_workspace_id_id on public.crm_contacts(workspace_id,id);
create unique index if not exists wrxs_crm_deals_workspace_id_id on public.crm_deals(workspace_id,id);
create unique index if not exists wrxs_crm_interactions_workspace_id_id on public.crm_interactions(workspace_id,id);
create unique index if not exists wrxs_crm_tags_workspace_id_id on public.crm_tags(workspace_id,id);
create unique index if not exists wrxs_meeting_types_workspace_id_id on public.meeting_types(workspace_id,id);
create unique index if not exists wrxs_shopping_lists_workspace_id_id on public.shopping_lists(workspace_id,id);
create unique index if not exists wrxs_tasks_workspace_id_id on public.tasks(workspace_id,id);

do $$ begin
  if exists(select 1 from public.crm_contact_tags child left join public.crm_tags parent
    on parent.id=child.tag_id and parent.workspace_id=child.workspace_id
    where child.tag_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: crm_contact_tags.tag_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_crm_contact_tags_tag_id_workspace_fk' and conrelid='public.crm_contact_tags'::regclass) then
    alter table public.crm_contact_tags add constraint wrxs_crm_contact_tags_tag_id_workspace_fk
      foreign key (workspace_id,tag_id) references public.crm_tags(workspace_id,id) on delete cascade;
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.crm_contacts child left join public.crm_deals parent
    on parent.id=child.associated_deal_id and parent.workspace_id=child.workspace_id
    where child.associated_deal_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: crm_contacts.associated_deal_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_crm_contacts_associated_deal_id_workspace_fk' and conrelid='public.crm_contacts'::regclass) then
    alter table public.crm_contacts add constraint wrxs_crm_contacts_associated_deal_id_workspace_fk
      foreign key (workspace_id,associated_deal_id) references public.crm_deals(workspace_id,id) on delete set null (associated_deal_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.crm_interactions child left join public.crm_companies parent
    on parent.id=child.company_id and parent.workspace_id=child.workspace_id
    where child.company_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: crm_interactions.company_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_crm_interactions_company_id_workspace_fk' and conrelid='public.crm_interactions'::regclass) then
    alter table public.crm_interactions add constraint wrxs_crm_interactions_company_id_workspace_fk
      foreign key (workspace_id,company_id) references public.crm_companies(workspace_id,id) on delete set null (company_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.crm_interactions child left join public.tasks parent
    on parent.id=child.task_id and parent.workspace_id=child.workspace_id
    where child.task_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: crm_interactions.task_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_crm_interactions_task_id_workspace_fk' and conrelid='public.crm_interactions'::regclass) then
    alter table public.crm_interactions add constraint wrxs_crm_interactions_task_id_workspace_fk
      foreign key (workspace_id,task_id) references public.tasks(workspace_id,id) on delete set null (task_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.tasks child left join public.crm_companies parent
    on parent.id=child.crm_company_id and parent.workspace_id=child.workspace_id
    where child.crm_company_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: tasks.crm_company_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_tasks_crm_company_id_workspace_fk' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint wrxs_tasks_crm_company_id_workspace_fk
      foreign key (workspace_id,crm_company_id) references public.crm_companies(workspace_id,id) on delete set null (crm_company_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.tasks child left join public.crm_contacts parent
    on parent.id=child.crm_contact_id and parent.workspace_id=child.workspace_id
    where child.crm_contact_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: tasks.crm_contact_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_tasks_crm_contact_id_workspace_fk' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint wrxs_tasks_crm_contact_id_workspace_fk
      foreign key (workspace_id,crm_contact_id) references public.crm_contacts(workspace_id,id) on delete set null (crm_contact_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.tasks child left join public.crm_interactions parent
    on parent.id=child.crm_interaction_id and parent.workspace_id=child.workspace_id
    where child.crm_interaction_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: tasks.crm_interaction_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_tasks_crm_interaction_id_workspace_fk' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint wrxs_tasks_crm_interaction_id_workspace_fk
      foreign key (workspace_id,crm_interaction_id) references public.crm_interactions(workspace_id,id) on delete set null (crm_interaction_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.notes child left join public.categories parent
    on parent.id=child.category_id and parent.workspace_id=child.workspace_id
    where child.category_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: notes.category_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_notes_category_id_workspace_fk' and conrelid='public.notes'::regclass) then
    alter table public.notes add constraint wrxs_notes_category_id_workspace_fk
      foreign key (workspace_id,category_id) references public.categories(workspace_id,id) on delete set null (category_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.notes child left join public.tasks parent
    on parent.id=child.linked_task_id and parent.workspace_id=child.workspace_id
    where child.linked_task_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: notes.linked_task_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_notes_linked_task_id_workspace_fk' and conrelid='public.notes'::regclass) then
    alter table public.notes add constraint wrxs_notes_linked_task_id_workspace_fk
      foreign key (workspace_id,linked_task_id) references public.tasks(workspace_id,id) on delete set null (linked_task_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.dues child left join public.categories parent
    on parent.id=child.category_id and parent.workspace_id=child.workspace_id
    where child.category_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: dues.category_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_dues_category_id_workspace_fk' and conrelid='public.dues'::regclass) then
    alter table public.dues add constraint wrxs_dues_category_id_workspace_fk
      foreign key (workspace_id,category_id) references public.categories(workspace_id,id) on delete set null (category_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.bookings child left join public.meeting_types parent
    on parent.id=child.meeting_type_id and parent.workspace_id=child.workspace_id
    where child.meeting_type_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: bookings.meeting_type_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_bookings_meeting_type_id_workspace_fk' and conrelid='public.bookings'::regclass) then
    alter table public.bookings add constraint wrxs_bookings_meeting_type_id_workspace_fk
      foreign key (workspace_id,meeting_type_id) references public.meeting_types(workspace_id,id) on delete set null (meeting_type_id);
  end if;
end $$;

do $$ begin
  if exists(select 1 from public.shopping_items child left join public.shopping_lists parent
    on parent.id=child.list_id and parent.workspace_id=child.workspace_id
    where child.list_id is not null and parent.id is null) then
    raise exception 'Existing cross-workspace or missing link: shopping_items.list_id. Stop and inspect before continuing.';
  end if;
  if not exists(select 1 from pg_constraint where conname='wrxs_shopping_items_list_id_workspace_fk' and conrelid='public.shopping_items'::regclass) then
    alter table public.shopping_items add constraint wrxs_shopping_items_list_id_workspace_fk
      foreign key (workspace_id,list_id) references public.shopping_lists(workspace_id,id) on delete set null (list_id);
  end if;
end $$;


-- Existing composite SET NULL constraints would also null workspace_id.
-- Limit nulling to the optional reference while preserving workspace ownership.
alter table public.tasks drop constraint tasks_workspace_category_same_ws_fkey;
alter table public.tasks add constraint tasks_workspace_category_same_ws_fkey
  foreign key(workspace_id,category_id) references public.categories(workspace_id,id)
  on delete set null(category_id) deferrable initially deferred;
alter table public.crm_contacts drop constraint crm_contacts_company_id_fkey;
alter table public.crm_contacts add constraint crm_contacts_company_id_fkey
  foreign key(workspace_id,company_id) references public.crm_companies(workspace_id,id)
  on delete set null(company_id);

-- Repair two audited legacy self-referencing views. Both preserve their existing columns.
create or replace view public.shopping_item_suggestions with (security_invoker=true) as
select workspace_id,
  coalesce(nullif(name_norm,''),lower(btrim(name))) as name_norm,
  (array_agg(name order by created_at desc,id desc))[1] as display_name,
  max(created_at) as last_seen_at,
  count(*) as times_used
from public.shopping_items
where btrim(name)<>''
group by workspace_id,coalesce(nullif(name_norm,''),lower(btrim(name)));

create or replace view public.crm_contacts_with_tags with (security_invoker=true) as
select c.id as contact_id,c.workspace_id,c.first_name,c.last_name,c.email,c.linkedin_url,c.phone,
  coalesce(json_agg(json_build_object('id',t.id,'name',t.name) order by t.name)
    filter(where t.id is not null),'[]'::json) as tags
from public.crm_contacts c
left join public.crm_contact_tags ct on ct.contact_id=c.id and ct.workspace_id=c.workspace_id
left join public.crm_tags t on t.id=ct.tag_id and t.workspace_id=c.workspace_id
group by c.id;

CREATE OR REPLACE FUNCTION public.get_shopping_suggestions(p_workspace_id uuid, p_prefix text, p_limit integer DEFAULT 10)
 RETURNS TABLE(name text, name_norm text, last_seen_at timestamp with time zone, times_used bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.display_name as name,
    s.name_norm,
    s.last_seen_at,
    s.times_used
  from public.shopping_item_suggestions s
  where s.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
    and public.can_read_shopping(p_workspace_id)
    and s.name_norm like (lower(trim(p_prefix)) || '%')
  order by s.last_seen_at desc, s.times_used desc
  limit greatest(1, least(p_limit, 25));
$function$
;
commit;
select '02 complete: workspace-safe record links installed' as result;
