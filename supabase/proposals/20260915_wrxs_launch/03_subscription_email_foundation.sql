-- WRXS Stage 3: backend-only subscription, email, invitation and account-lifecycle records.
-- No Stripe prices, trials, paid access, email routes, or mailboxes are activated here.
-- New table creation deliberately stops on name collisions instead of assuming compatibility.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';


-- Confirmed public pricing. Stripe IDs are assigned only after the real prices exist.
create table public.wrxs_price_catalog (
  plan_key text not null default 'standard' check(plan_key='standard'),
  billing_interval text not null check(billing_interval in ('month','year')),
  currency text not null default 'usd' check(currency='usd'),
  amount_cents integer not null check(amount_cents>0),
  stripe_price_id text unique,
  checkout_enabled boolean not null default false,
  primary key(plan_key,billing_interval),
  check(not checkout_enabled or stripe_price_id is not null)
);
insert into public.wrxs_price_catalog(plan_key,billing_interval,currency,amount_cents)
values('standard','month','usd',400),('standard','year','usd',4000);
alter table public.wrxs_price_catalog enable row level security;
revoke all on public.wrxs_price_catalog from public,anon,authenticated;
grant select on public.wrxs_price_catalog to anon,authenticated;
grant select,insert,update,delete on public.wrxs_price_catalog to service_role;
create policy wrxs_public_prices on public.wrxs_price_catalog for select to anon,authenticated using(true);

create table public.wrxs_billing_accounts (
  workspace_id uuid primary key references public.workspaces(id) on delete restrict,
  billing_user_id uuid not null references auth.users(id) on delete restrict,
  foreign key(workspace_id,billing_user_id) references public.workspace_members(workspace_id,user_id) on delete restrict,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.wrxs_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.wrxs_billing_accounts(workspace_id) on delete restrict,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  status text not null check (status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  billing_interval text not null check (billing_interval in ('month','year')),
  access_until timestamptz,
  cancel_at_period_end boolean not null default false,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wrxs_subscriptions_workspace on public.wrxs_subscriptions(workspace_id);
-- One nonterminal subscription per workspace, enforced even under concurrent Checkout flows.
create unique index wrxs_one_current_subscription on public.wrxs_subscriptions(workspace_id)
  where status not in ('canceled','incomplete_expired');

create table public.wrxs_billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  state text not null default 'pending' check (state in ('pending','processing','processed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_until timestamptz,
  error_code text
);
-- Full Stripe payloads and customer payment details are deliberately not stored here.
create table public.wrxs_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reason text not null check (reason in ('trial','founder','support')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index wrxs_access_grants_workspace on public.wrxs_access_grants(workspace_id);

create table public.wrxs_email_routes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  local_part text not null unique default ('w-' || replace(gen_random_uuid()::text,'-','')),
  domain text not null default 'in.wrxs.cc' check (domain='in.wrxs.cc'),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (local_part ~ '^w-[a-f0-9]{32}$'),
  unique(workspace_id,id)
);
create table public.wrxs_email_senders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (email=lower(btrim(email)) and position('@' in email)>1),
  verified_at timestamptz,
  verification_method text check (verification_method in ('confirmed_account','email_challenge','provider_oauth')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,email),
  check (verified_at is null or verification_method is not null)
);
create table public.wrxs_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  route_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  message_id text,
  status text not null default 'received' check (status in ('received','processing','processed','rejected','failed')),
  attempts integer not null default 0 check (attempts>=0),
  lease_until timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  foreign key(workspace_id,route_id) references public.wrxs_email_routes(workspace_id,id) on delete cascade,
  unique(workspace_id,provider,provider_event_id)
);
create index wrxs_email_deliveries_workspace on public.wrxs_email_deliveries(workspace_id,received_at desc);

-- Invitations store only SHA-256 hashes, never a usable invitation secret.
-- Creation, delivery, acceptance and role assignment will use authenticated Edge Functions.
create table public.wrxs_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  email text not null check(email=lower(btrim(email)) and position('@' in email)>1),
  role public.member_role not null default 'contributor' check(role::text in ('contributor','viewer')),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check(expires_at>created_at),
  check((accepted_at is null)=(accepted_by is null)),
  check(accepted_at is null or revoked_at is null)
);
create index wrxs_invitations_workspace on public.wrxs_workspace_invitations(workspace_id,email);

-- Intent only: requests never automatically delete an account or its shared workspaces.
create table public.wrxs_account_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('export','delete')),
  status text not null default 'requested' check(status in ('requested','processing','completed','cancelled','failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text
);
create unique index wrxs_one_pending_account_request on public.wrxs_account_requests(user_id,kind)
  where status in ('requested','processing');

-- Service-only by default. No browser can write a paid status, verified sender or invite.
do $$
declare t text;
begin
  foreach t in array array['wrxs_billing_accounts','wrxs_subscriptions','wrxs_billing_events','wrxs_access_grants','wrxs_email_routes','wrxs_email_senders','wrxs_email_deliveries','wrxs_workspace_invitations','wrxs_account_requests'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end;
$$;

-- Read-only UI summaries. These do not expose sender lists, tokens or event payloads.
grant select on public.wrxs_subscriptions to authenticated;
create policy wrxs_subscription_read on public.wrxs_subscriptions for select to authenticated
  using (public.wrxs_can(workspace_id,'manage_members'));
grant select on public.wrxs_email_routes to authenticated;
create policy wrxs_routes_read on public.wrxs_email_routes for select to authenticated
  using (public.wrxs_can(workspace_id,'manage_members'));
grant select on public.wrxs_account_requests to authenticated;
create policy wrxs_account_request_read on public.wrxs_account_requests for select to authenticated
  using (user_id=(select auth.uid()));

create or replace function public.wrxs_has_active_access(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select public.wrxs_can(p_workspace_id,'read') and (
    exists(select 1 from public.wrxs_subscriptions s where s.workspace_id=p_workspace_id
      and s.status in ('active','trialing') and s.access_until>now())
    or exists(select 1 from public.wrxs_access_grants g where g.workspace_id=p_workspace_id
      and g.revoked_at is null and g.starts_at<=now() and g.expires_at>now())
  );
$$;
revoke all on function public.wrxs_has_active_access(uuid) from public, anon;
grant execute on function public.wrxs_has_active_access(uuid) to authenticated,service_role;
-- This function is intentionally not yet attached to existing app RLS policies.
-- Activate payment enforcement only with tested Checkout, webhooks, recovery and an
-- explicit decision on the two existing workspaces. No trial duration or price is assumed.

create or replace function public.wrxs_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end;
$$;
create trigger wrxs_billing_accounts_touch before update on public.wrxs_billing_accounts for each row execute function public.wrxs_touch_updated_at();
create trigger wrxs_subscriptions_touch before update on public.wrxs_subscriptions for each row execute function public.wrxs_touch_updated_at();
create trigger wrxs_email_routes_touch before update on public.wrxs_email_routes for each row execute function public.wrxs_touch_updated_at();

comment on table public.wrxs_email_routes is 'Proposed inbound aliases at in.wrxs.cc. Rows do not create DNS records or receiving mailboxes. Enable only after a verified receiver is deployed.';
comment on table public.wrxs_email_senders is 'Verified address ownership is necessary but not sufficient: receiver must verify provider request authenticity, sender authentication, current membership and route status.';
comment on table public.wrxs_subscriptions is 'Updated only by trusted backend after Stripe reconciliation. The browser cannot grant paid access.';
comment on table public.wrxs_workspace_invitations is 'Backend must atomically check token hash, confirmed recipient email, expiry, inviter current authority, membership and seat rules before acceptance.';
commit;
select '03 complete: inactive service foundations installed; existing app access and email ingestion unchanged' as result;
