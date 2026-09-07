-- REVIEW BEFORE RUNNING. Planup Home attention foundation.
-- Based on the schema export supplied on 2026-09-07.
-- Atomic migration; no contact history is guessed or deleted.
-- Existing ingestion and unclassified interaction behaviour are preserved.
begin;

alter table public.crm_interactions
  add column activity_kind text
  check (activity_kind in ('contact', 'attempt', 'note'));
comment on column public.crm_interactions.activity_kind is
  'NULL = unclassified legacy/imported activity; contact = actual communication; attempt/note do not reset last contact.';

alter table public.crm_lead_statuses
  add column home_attention_mode text
  check (home_attention_mode in ('normal', 'deferred', 'excluded'));
comment on column public.crm_lead_statuses.home_attention_mode is
  'Custom statuses require explicit classification. Built-in in_progress/connected are normal; bad_timing is deferred.';

alter table public.crm_contacts add column attention_reopened_at timestamptz;
alter table public.tasks add column is_crm_follow_up boolean not null default false;
comment on column public.tasks.is_crm_follow_up is
  'Explicitly scheduled follow-up. Legacy tasks also qualify when their linked interaction requests reconnect.';

create index crm_home_contact_activity_idx
  on public.crm_interactions (workspace_id, contact_id, occurred_at desc, id);
create index tasks_home_follow_up_idx
  on public.tasks (workspace_id, crm_contact_id, due_at)
  where status in ('inbox', 'next', 'waiting', 'scheduled');

CREATE OR REPLACE FUNCTION public.crm_sync_task_from_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contact_name text;
  v_company_name text;
  v_title text;
  v_desc text;
  v_due timestamptz;
  v_actor uuid;
  v_existing_created_by uuid;
begin
  -- Classified app activity with no next action must not create a task.
  -- NULL preserves the existing ingestion/legacy behaviour unchanged.
  if new.activity_kind is not null and new.next_action = 'none' then
    return new;
  end if;

  -- 1) Disconnect => archive any existing task and exit
  if new.next_action = 'disconnect' then
    update public.tasks
      set status = 'archived',
          updated_at = now()
    where workspace_id = new.workspace_id
      and crm_interaction_id = new.id;

    return new;
  end if;

  -- 2) Only create/update task for reconnect OR none
  if new.next_action not in ('reconnect','none') then
    return new;
  end if;

  -- 3) Resolve actor (created_by must never be null)
  v_actor := auth.uid();
  if v_actor is null then
    v_actor := new.created_by;
  end if;

  -- If still null, try to reuse existing task's created_by (update scenario)
  if v_actor is null then
    select t.created_by
      into v_existing_created_by
    from public.tasks t
    where t.workspace_id = new.workspace_id
      and t.crm_interaction_id = new.id
    limit 1;

    v_actor := v_existing_created_by;
  end if;

  if v_actor is null then
    raise exception 'Authentication required (cannot determine created_by for task)';
  end if;

  -- 4) Get contact + company names
  select
    trim(concat_ws(' ', c.first_name, c.last_name)),
    coalesce(co.name, '')
  into v_contact_name, v_company_name
  from public.crm_contacts c
  left join public.crm_companies co on co.id = c.company_id
  where c.id = new.contact_id;

  if v_contact_name is null or v_contact_name = '' then
    v_contact_name := 'Unknown contact';
  end if;

  -- 5) Due date = occurred_at (or now) + reconnect_in_days (or 0)
  v_due := coalesce(new.occurred_at, now())
           + ((coalesce(new.reconnect_in_days, 0))::text || ' days')::interval;

  -- 6) Title, description, next_step
  v_title := 'Follow up: ' || v_contact_name;

  v_desc :=
    concat_ws(
      E'\n',
      case when v_company_name <> '' then 'Company: ' || v_company_name else null end,
      case when new.title is not null and new.title <> '' then 'Interaction: ' || new.title else null end,
      case when new.note is not null and new.note <> '' then 'Note: ' || new.note else null end,
      case when new.link is not null and new.link <> '' then 'Link: ' || new.link else null end
    );

  -- next_step: make it a short actionable hint based on next_action
  -- (you can refine later)
  -- reconnect => "Reconnect"
  -- none => "Follow up"
  -- disconnect never reaches here
  -- NOTE: keeping this simple and consistent
  -- (You asked for "Next Step" included)
  -- We'll store in tasks.next_step
  -- and keep title/desc separate.
  -- 
  -- 7) Upsert task
  insert into public.tasks (
    workspace_id,
    title,
    description,
    status,
    next_step,
    priority,
    time_estimate_min,
    due_at,
    created_by,
    assigned_to,
    crm_company_id,
    crm_contact_id,
    crm_interaction_id
  )
  values (
    new.workspace_id,
    v_title,
    v_desc,
    'next'::task_status,
    case when new.next_action = 'reconnect' then 'Reconnect' else 'Follow up' end,
    'P1'::task_priority,
    5,
    v_due,
    v_actor,
    null,
    new.company_id,
    new.contact_id,
    new.id
  )
  on conflict (workspace_id, crm_interaction_id)
  do update set
    title = excluded.title,
    description = excluded.description,
    next_step = excluded.next_step,
    due_at = excluded.due_at,
    crm_company_id = excluded.crm_company_id,
    crm_contact_id = excluded.crm_contact_id,
    -- keep done unless user explicitly reopens; archived should reopen to next
    status = case
      when public.tasks.status = 'done' then public.tasks.status
      when public.tasks.status = 'archived' then 'next'::task_status
      else public.tasks.status
    end,
    updated_at = now();

  return new;
end;
$function$
;

commit;
