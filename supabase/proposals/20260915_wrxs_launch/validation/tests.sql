-- Synthetic local-only fixtures. Never run this file against production.
insert into auth.users(id,email,email_confirmed_at) values
('10000000-0000-0000-0000-000000000001','owner-a@example.test',now()),
('10000000-0000-0000-0000-000000000002','owner-b@example.test',now()),
('10000000-0000-0000-0000-000000000003','member-a@example.test',now()),
('10000000-0000-0000-0000-000000000004','shopping-a@example.test',now()),
('10000000-0000-0000-0000-000000000005','viewer-a@example.test',now());
insert into public.profiles(id,email) select id,email from auth.users;
insert into public.workspaces(id,name,created_by) values
('20000000-0000-0000-0000-000000000001','Workspace A','10000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002','Workspace B','10000000-0000-0000-0000-000000000002');
insert into public.workspace_members(workspace_id,user_id,role,can_manage_members,can_create_tasks,only_shopping,shopping_only) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin',true,true,false,false),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','admin',true,true,false,false),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','contributor',false,true,false,false),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','viewer',false,false,true,true),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','viewer',false,false,false,false);
insert into public.tasks(id,workspace_id,title,created_by) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A task','10000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','B task','10000000-0000-0000-0000-000000000002');

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ declare n int; begin
  select count(*) into n from public.profiles;
  if n<>4 then raise exception 'Profile isolation failure: %',n; end if;
  select count(*) into n from public.workspace_members;
  if n<>4 then raise exception 'Member listing failure: %',n; end if;
  select count(*) into n from public.tasks;
  if n<>1 then raise exception 'Task isolation failure: %',n; end if;
  select count(*) into n from public.v_tasks_with_crm;
  if n<>1 then raise exception 'View isolation failure: %',n; end if;
  update public.profiles set full_name='Owner A' where id=auth.uid();
  begin
    update public.profiles set email='other@example.test' where id=auth.uid();
    raise exception 'Profile email forgery allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tasks(workspace_id,title,created_by) values('20000000-0000-0000-0000-000000000002','Cross tenant',auth.uid());
    raise exception 'Cross tenant task insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.tasks set workspace_id='20000000-0000-0000-0000-000000000002' where id='30000000-0000-0000-0000-000000000001';
    raise exception 'Task move allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.wrxs_access_grants(workspace_id,reason,expires_at,created_by) values('20000000-0000-0000-0000-000000000001','founder',now()+interval '1 day',auth.uid());
    raise exception 'Self granted paid access';
  exception when insufficient_privilege then null; end;
  if public.wrxs_has_active_access('20000000-0000-0000-0000-000000000001') then raise exception 'Paid access granted without subscription'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
do $$ declare n int; begin
 update public.tasks set title='Unauthorized edit' where id='30000000-0000-0000-0000-000000000001';
 get diagnostics n=row_count; if n<>0 then raise exception 'Contributor edited another author task'; end if;
 insert into public.tasks(workspace_id,title,created_by) values('20000000-0000-0000-0000-000000000001','Own task',auth.uid());
 begin
   insert into public.categories(workspace_id,name,created_by) values('20000000-0000-0000-0000-000000000001','Unauthorized category',auth.uid());
   raise exception 'Contributor managed categories';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
do $$ declare n int; begin
 select count(*) into n from public.profiles; if n<>1 then raise exception 'Shopping user sees other profiles'; end if;
 select count(*) into n from public.tasks; if n<>0 then raise exception 'Shopping user sees tasks'; end if;
 select count(*) into n from public.v_tasks_with_crm; if n<>0 then raise exception 'Shopping user sees task view'; end if;
 if public.wrxs_can('20000000-0000-0000-0000-000000000001','manage_members') then raise exception 'Shopping user can manage members'; end if;
 begin
   perform public.add_member_by_email('20000000-0000-0000-0000-000000000001','owner-b@example.test',false);
   raise exception 'Shopping user bypassed RPC permissions';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
do $$ begin
 begin
  insert into public.notes(workspace_id,body,created_by) values('20000000-0000-0000-0000-000000000001','Viewer write',auth.uid());
  raise exception 'Viewer wrote a note';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The service backend remains able to ingest legacy email records.
set role service_role;
select set_config('request.jwt.claim.sub','',false);
insert into public.wrxs_billing_accounts(workspace_id,billing_user_id) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.wrxs_subscriptions(workspace_id,stripe_subscription_id,stripe_price_id,status,billing_interval,access_until)
 values('20000000-0000-0000-0000-000000000001','sub_test','price_test','active','month',now()+interval '1 day');
insert into public.wrxs_email_routes(workspace_id,created_by) values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
do $$ begin
 if exists(select 1 from public.wrxs_email_routes where enabled) then raise exception 'Route enabled before provisioning'; end if;
 begin
  insert into public.wrxs_subscriptions(workspace_id,stripe_subscription_id,stripe_price_id,status,billing_interval,access_until)
   values('20000000-0000-0000-0000-000000000001','sub_duplicate','price_test','active','year',now()+interval '1 day');
  raise exception 'Duplicate live subscription allowed';
 exception when unique_violation then null; end;
 begin
  insert into public.notes(workspace_id,body,created_by,linked_task_id) values('20000000-0000-0000-0000-000000000001','Cross link','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
  raise exception 'Cross-workspace reference allowed';
 exception when foreign_key_violation then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ begin if not public.wrxs_has_active_access('20000000-0000-0000-0000-000000000001') then raise exception 'Valid subscription not recognized'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
do $$ begin if public.wrxs_has_active_access('20000000-0000-0000-0000-000000000001') then raise exception 'Cross-workspace paid access leak'; end if; end $$;
reset role;

set role service_role;
select set_config('request.jwt.claim.sub','',false);
insert into public.crm_contacts(id,workspace_id,first_name,email,created_by)
values('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Legacy email','legacy@example.test','10000000-0000-0000-0000-000000000001');
insert into public.crm_interactions(workspace_id,contact_id,created_by,channel,title,note,next_action)
values('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','email','Legacy ingestion','Test','none');
do $$ begin
 if not exists(select 1 from public.tasks where crm_contact_id='40000000-0000-0000-0000-000000000001') then raise exception 'Legacy email task trigger broken'; end if;
 update public.wrxs_subscriptions set access_until=now()-interval '1 minute' where stripe_subscription_id='sub_test';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$ begin
 if public.wrxs_has_active_access('20000000-0000-0000-0000-000000000001') then raise exception 'Expired subscription still grants access'; end if;
end $$;
reset role;
set role anon;
do $$ declare n int; begin
 select count(*) into n from public.wrxs_price_catalog where (billing_interval='month' and amount_cents=400) or (billing_interval='year' and amount_cents=4000);
 if n<>2 then raise exception 'Public prices do not match'; end if;
 begin
  select count(*) into n from public.profiles;
  raise exception 'Anonymous profile access allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
insert into public.categories(id,workspace_id,name) values('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Temporary');
update public.tasks set category_id='50000000-0000-0000-0000-000000000001' where id='30000000-0000-0000-0000-000000000001';
delete from public.categories where id='50000000-0000-0000-0000-000000000001';
insert into public.crm_companies(id,workspace_id,name) values('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Temporary');
update public.crm_contacts set company_id='50000000-0000-0000-0000-000000000002' where id='40000000-0000-0000-0000-000000000001';
delete from public.crm_companies where id='50000000-0000-0000-0000-000000000002';
do $$ begin
 if not exists(select 1 from public.tasks where id='30000000-0000-0000-0000-000000000001' and category_id is null and workspace_id='20000000-0000-0000-0000-000000000001') then raise exception 'Category deletion changed task ownership'; end if;
 if not exists(select 1 from public.crm_contacts where id='40000000-0000-0000-0000-000000000001' and company_id is null and workspace_id='20000000-0000-0000-0000-000000000001') then raise exception 'Company deletion changed contact ownership'; end if;
 perform * from public.crm_contacts_with_tags limit 1;
 perform * from public.get_shopping_suggestions('20000000-0000-0000-0000-000000000001','',10);
end $$;
reset role;
