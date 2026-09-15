-- Run manually after stage 06. Installs service-only billing coordination.
-- Does not enable checkout or change existing application access.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.wrxs_billing_accounts
  add column if not exists operation_token uuid,
  add column if not exists operation_until timestamptz,
  add column if not exists checkout_key uuid,
  add column if not exists checkout_session_id text,
  add column if not exists checkout_expires_at timestamptz,
  add column if not exists checkout_interval text check(checkout_interval in ('month','year'));

create or replace function public.wrxs_billing_lock(p_workspace uuid,p_user uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.wrxs_billing_accounts; t uuid:=gen_random_uuid();
begin
  if p_user is not null then
    if not exists(select 1 from public.workspace_members m where m.workspace_id=p_workspace and m.user_id=p_user
      and m.role::text in ('admin','owner') and not coalesce(m.only_shopping,false) and not coalesce(m.shopping_only,false)) then
      raise exception 'Workspace administrator required';
    end if;
    insert into public.wrxs_billing_accounts(workspace_id,billing_user_id) values(p_workspace,p_user) on conflict(workspace_id) do nothing;
  end if;
  select * into a from public.wrxs_billing_accounts where workspace_id=p_workspace for update;
  if not found then raise exception 'Billing account not found'; end if;
  if p_user is not null and a.billing_user_id<>p_user then raise exception 'Only the billing owner can manage this subscription'; end if;
  if a.operation_until>clock_timestamp() then raise exception 'Billing operation in progress; retry shortly'; end if;
  update public.wrxs_billing_accounts set operation_token=t,operation_until=clock_timestamp()+interval '120 seconds'
    where workspace_id=p_workspace returning * into a;
  return to_jsonb(a);
end $$;

create or replace function public.wrxs_billing_save(p_workspace uuid,p_token uuid,p_account jsonb default '{}'::jsonb,p_subscription jsonb default null,p_event jsonb default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.wrxs_billing_accounts;
begin
  select * into a from public.wrxs_billing_accounts where workspace_id=p_workspace and operation_token=p_token
    and operation_until>clock_timestamp() for update;
  if not found then raise exception 'Billing lease expired'; end if;
  if p_account ? 'stripe_customer_id' and a.stripe_customer_id is not null and a.stripe_customer_id is distinct from p_account->>'stripe_customer_id' then
    raise exception 'Customer identity cannot be changed';
  end if;
  update public.wrxs_billing_accounts set
    stripe_customer_id=case when p_account ? 'stripe_customer_id' then p_account->>'stripe_customer_id' else stripe_customer_id end,
    checkout_key=case when p_account ? 'checkout_key' then (p_account->>'checkout_key')::uuid else checkout_key end,
    checkout_session_id=case when p_account ? 'checkout_session_id' then p_account->>'checkout_session_id' else checkout_session_id end,
    checkout_expires_at=case when p_account ? 'checkout_expires_at' then (p_account->>'checkout_expires_at')::timestamptz else checkout_expires_at end,
    checkout_interval=case when p_account ? 'checkout_interval' then p_account->>'checkout_interval' else checkout_interval end
    where workspace_id=p_workspace;
  if p_subscription is not null then
    if not exists(select 1 from public.wrxs_price_catalog where stripe_price_id=p_subscription->>'stripe_price_id'
       and billing_interval=p_subscription->>'billing_interval' and plan_key='standard') then raise exception 'Unrecognized subscription price'; end if;
    if exists(select 1 from public.wrxs_subscriptions where stripe_subscription_id=p_subscription->>'id' and workspace_id<>p_workspace) then
      raise exception 'Subscription belongs to another workspace';
    end if;
    insert into public.wrxs_subscriptions(workspace_id,stripe_subscription_id,stripe_price_id,status,billing_interval,access_until,cancel_at_period_end,last_reconciled_at)
    values(p_workspace,p_subscription->>'id',p_subscription->>'stripe_price_id',p_subscription->>'status',p_subscription->>'billing_interval',
      (p_subscription->>'access_until')::timestamptz,coalesce((p_subscription->>'cancel_at_period_end')::boolean,false),clock_timestamp())
    on conflict(stripe_subscription_id) do update set stripe_price_id=excluded.stripe_price_id,status=excluded.status,
      billing_interval=excluded.billing_interval,access_until=excluded.access_until,cancel_at_period_end=excluded.cancel_at_period_end,last_reconciled_at=excluded.last_reconciled_at;
  end if;
  if p_event is not null then
    insert into public.wrxs_billing_events(stripe_event_id,event_type,stripe_created_at,state,processed_at,attempts)
    values(p_event->>'id',p_event->>'type',to_timestamp((p_event->>'created')::double precision),'processed',clock_timestamp(),1)
    on conflict(stripe_event_id) do update set state='processed',processed_at=excluded.processed_at,attempts=public.wrxs_billing_events.attempts+1;
  end if;
end $$;

create or replace function public.wrxs_billing_unlock(p_workspace uuid,p_token uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  update public.wrxs_billing_accounts set operation_token=null,operation_until=null
  where workspace_id=p_workspace and operation_token=p_token;
$$;

revoke all on function public.wrxs_billing_lock(uuid,uuid) from public,anon,authenticated;
revoke all on function public.wrxs_billing_save(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.wrxs_billing_unlock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.wrxs_billing_lock(uuid,uuid) to service_role;
grant execute on function public.wrxs_billing_save(uuid,uuid,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.wrxs_billing_unlock(uuid,uuid) to service_role;
commit;
select '07 complete: billing coordination installed; checkout remains disabled' as result;
