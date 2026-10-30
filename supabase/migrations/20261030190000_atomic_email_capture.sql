-- The WRXS route is the sole ingestion implementation. Existing contacts,
-- interaction links and historical ingestion ledgers remain intact.
begin;
alter table public.wrxs_email_senders add column if not exists capture_source text not null default 'postmark'
  check (capture_source in ('postmark','microsoft_sent'));
comment on column public.wrxs_email_senders.capture_source is
  'Service-managed capture enrichment. microsoft_sent preserves all BCC recipients using the verified sender mailbox.';
create or replace function public.wrxs_capture_email(p_message jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  route public.wrxs_email_routes%rowtype;
  delivery public.wrxs_email_deliveries%rowtype;
  person jsonb;
  sender text := lower(btrim(p_message->>'sender'));
  recipient text := lower(btrim(p_message->>'recipient'));
  event_id text := p_message->>'event_id';
  message_id text := p_message->>'message_id';
  subject text := coalesce(nullif(p_message->>'subject',''), '(No subject)');
  body text := nullif(p_message->>'text','');
  v_contact_id uuid;
  interaction_id uuid;
  person_email text;
  person_name text;
  interaction_link text;
  status_key text;
  sender_source text;
  processed integer := 0;
begin
  if sender is null or recipient is null or nullif(event_id,'') is null
     or nullif(message_id,'') is null or jsonb_typeof(p_message->'people') is distinct from 'array' then
    raise exception 'Invalid capture message';
  end if;
  select * into route from public.wrxs_email_routes r
    where r.local_part || '@' || r.domain = recipient and r.domain = 'wrxs.cc' and r.enabled;
  if route.id is null then return jsonb_build_object('received',true,'ignored',true); end if;
  if not exists(select 1 from public.wrxs_email_senders s where s.workspace_id = route.workspace_id
    and s.email = sender and s.verified_at is not null and s.revoked_at is null) then
    return jsonb_build_object('received',true,'ignored',true);
  end if;
  select s.capture_source into sender_source from public.wrxs_email_senders s
    where s.workspace_id=route.workspace_id and s.email=sender;
  -- Serializes capture within this workspace, including simultaneous different
  -- messages introducing the same contact. Released automatically on rollback.
  perform pg_advisory_xact_lock(hashtextextended('wrxs-capture:' || route.workspace_id::text,0));
  select * into delivery from public.wrxs_email_deliveries d
    where d.workspace_id=route.workspace_id and d.provider='postmark' and d.provider_event_id=event_id;
  if delivery.status='processed' then return jsonb_build_object('received',true,'duplicate',true); end if;
  if delivery.id is null then
    insert into public.wrxs_email_deliveries(workspace_id,route_id,provider,provider_event_id,message_id,status,attempts)
      values(route.workspace_id,route.id,'postmark',event_id,message_id,'processing',1) returning * into delivery;
  else
    update public.wrxs_email_deliveries set status='processing',attempts=attempts+1,error_code=null where id=delivery.id;
  end if;
  select s.key into status_key from public.crm_email_subject_rules r
    join public.crm_lead_statuses s on s.id=r.lead_status_id and s.workspace_id=r.workspace_id
    where r.workspace_id=route.workspace_id and r.enabled
      and position(lower(btrim(r.subject_contains)) in lower(subject))>0
    order by length(btrim(r.subject_contains)) desc, r.id limit 1;
  if status_key is null then
    select key into status_key from public.crm_lead_statuses where workspace_id=route.workspace_id and key='connected';
  end if;
  for person in select value from jsonb_array_elements(p_message->'people') loop
    person_email := lower(btrim(person->>'email'));
    if coalesce(person_email,'')='' or person_email=sender or person_email like '%@wrxs.cc' then continue; end if;
    person_name := nullif(btrim(person->>'name'),'');
    select c.id into v_contact_id from public.crm_contacts c where c.workspace_id=route.workspace_id
      and lower(c.email)=person_email order by c.created_at,c.id limit 1;
    if v_contact_id is null then
      insert into public.crm_contacts(workspace_id,created_by,email,first_name,last_name,lead_status,is_active)
      values(route.workspace_id,route.created_by,person_email,
        coalesce(split_part(person_name,' ',1),split_part(person_email,'@',1)),
        case when position(' ' in person_name)>0 then nullif(substring(person_name from position(' ' in person_name)+1),'') end,
        status_key,true) returning id into v_contact_id;
    end if;
    -- Keep the historical Message-ID key so replaying an old email through the
    -- new address cannot duplicate an interaction captured by the old receiver.
    interaction_link := 'crm-email:' || message_id || ':' || person_email;
    select i.id into interaction_id from public.crm_interactions i where i.workspace_id=route.workspace_id
      and i.contact_id=v_contact_id and i.link=interaction_link limit 1;
    if interaction_id is null then
      insert into public.crm_interactions(workspace_id,contact_id,created_by,occurred_at,channel,
        activity_kind,title,note,notes,type,link,next_action)
      values(route.workspace_id,v_contact_id,route.created_by,(p_message->>'occurred_at')::timestamptz,
        'email',case when sender_source='microsoft_sent' then null else 'contact' end,subject,body,body,'email',interaction_link,'none');
      processed := processed+1;
    end if;
  end loop;
  update public.wrxs_email_deliveries set status='processed',processed_at=now(),error_code=null,lease_until=null where id=delivery.id;
  return jsonb_build_object('received',true,'processed',processed);
end;
$$;
revoke all on function public.wrxs_capture_email(jsonb) from public,anon,authenticated;
grant execute on function public.wrxs_capture_email(jsonb) to service_role;
commit;
