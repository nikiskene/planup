-- Runs inside a transaction that MUST be rolled back by the caller.
do $$
declare
  msg jsonb;
  result jsonb;
  before_count integer;
  after_count integer;
  route public.wrxs_email_routes%rowtype;
  sender text;
  test_email text := 'wrxs-cutover-' || gen_random_uuid()::text || '@example.invalid';
  test_id text := 'wrxs-cutover-' || gen_random_uuid()::text;
  saved_contact uuid;
begin
  select * into strict route from public.wrxs_email_routes where local_part='niki' and domain='wrxs.cc' and enabled;
  select email into strict sender from public.wrxs_email_senders where workspace_id=route.workspace_id and verified_at is not null and revoked_at is null limit 1;
  update public.wrxs_email_senders set capture_source='microsoft_sent' where workspace_id=route.workspace_id and email=sender;
  msg := jsonb_build_object('recipient',route.local_part||'@'||route.domain,'sender',sender,'event_id',test_id,
    'message_id','<'||test_id||'>','subject','WRXS cutover verification','text','Transactional verification, rolled back',
    'occurred_at',now(),'people',jsonb_build_array(jsonb_build_object('email',test_email,'name','Test Person')));
  result := public.wrxs_capture_email(msg || jsonb_build_object('sender','unauthorized@example.invalid'));
  if result->>'ignored' is distinct from 'true' then raise exception 'Unknown sender accepted'; end if;
  select count(*) into before_count from public.wrxs_email_deliveries where workspace_id=route.workspace_id;
  -- A failure after the delivery claim must roll back the claim and the contact.
  begin
    perform public.wrxs_capture_email(msg || jsonb_build_object('occurred_at','invalid-date'));
    raise exception 'Invalid date accepted';
  exception when invalid_datetime_format then null;
  end;
  select count(*) into after_count from public.wrxs_email_deliveries where workspace_id=route.workspace_id;
  if before_count<>after_count then raise exception 'Failed capture left a poisoned delivery claim'; end if;
  result := public.wrxs_capture_email(msg);
  if result->>'processed' is distinct from '1' then raise exception 'Capture did not create exactly one interaction: %',result; end if;
  select id into saved_contact from public.crm_contacts where workspace_id=route.workspace_id and email=test_email and lead_status='connected';
  if saved_contact is null then raise exception 'Missing contact/default Connected status'; end if;
  if (select count(*) from public.tasks where crm_contact_id=saved_contact)<>1 then raise exception 'Legacy follow-up task not preserved'; end if;
  result := public.wrxs_capture_email(msg);
  if result->>'duplicate' is distinct from 'true' then raise exception 'Duplicate not recognized'; end if;
  -- Different provider id with the same original email must reuse the history.
  result := public.wrxs_capture_email(msg || jsonb_build_object('event_id',test_id||'-replay'));
  if result->>'processed' is distinct from '0' then raise exception 'Original email duplicated'; end if;
  if (select count(*) from public.crm_interactions where contact_id=saved_contact)<>1 then raise exception 'Duplicate history'; end if;
  if has_function_privilege('anon','public.wrxs_capture_email(jsonb)','execute') or has_function_privilege('authenticated','public.wrxs_capture_email(jsonb)','execute') then raise exception 'Capture callable by browser'; end if;
end;
$$;
select 'PASS: sender authorization, atomic retry, Connected default, delivery and Message-ID deduplication, service-only access' result;
