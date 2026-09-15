-- WRXS / wrxs.cc — Stage 11. Shared feature board and platform moderation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table if not exists public.wrxs_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
insert into public.wrxs_platform_admins(user_id)
values ('f631a75e-e681-4188-ae63-756449d0dceb') on conflict do nothing;

create or replace function public.wrxs_is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.wrxs_platform_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.wrxs_is_platform_admin() from public, anon;
grant execute on function public.wrxs_is_platform_admin() to authenticated, service_role;

create table if not exists public.wrxs_feature_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 3000),
  status text not null default 'open' check (status in ('open','reviewing','planned','deployed','declined')),
  decision_note text check (decision_note is null or char_length(decision_note)<=1000),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deployed_at timestamptz,
  deployed_by uuid references auth.users(id) on delete set null,
  check ((status='deployed') = (deployed_at is not null))
);
create table if not exists public.wrxs_feature_votes (
  feature_request_id uuid not null references public.wrxs_feature_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(feature_request_id,user_id)
);
create index if not exists wrxs_feature_requests_status_created on public.wrxs_feature_requests(status,created_at desc);
create index if not exists wrxs_feature_votes_request on public.wrxs_feature_votes(feature_request_id);

alter table public.wrxs_feature_requests enable row level security;
alter table public.wrxs_feature_votes enable row level security;
alter table public.wrxs_platform_admins enable row level security;
revoke all on public.wrxs_feature_requests, public.wrxs_feature_votes, public.wrxs_platform_admins from public, anon, authenticated;
grant select,insert on public.wrxs_feature_requests to authenticated;
grant update on public.wrxs_feature_requests to authenticated;
grant insert,delete on public.wrxs_feature_votes to authenticated;
grant select on public.wrxs_platform_admins to authenticated;

drop policy if exists wrxs_feature_requests_read on public.wrxs_feature_requests;
drop policy if exists wrxs_feature_requests_create on public.wrxs_feature_requests;
drop policy if exists wrxs_feature_requests_admin_update on public.wrxs_feature_requests;
create policy wrxs_feature_requests_read on public.wrxs_feature_requests for select to authenticated using (true);
create policy wrxs_feature_requests_create on public.wrxs_feature_requests for insert to authenticated with check (created_by=(select auth.uid()));
create policy wrxs_feature_requests_admin_update on public.wrxs_feature_requests for update to authenticated using (public.wrxs_is_platform_admin()) with check (public.wrxs_is_platform_admin());
drop policy if exists wrxs_feature_votes_create on public.wrxs_feature_votes;
drop policy if exists wrxs_feature_votes_remove on public.wrxs_feature_votes;
create policy wrxs_feature_votes_create on public.wrxs_feature_votes for insert to authenticated with check (user_id=(select auth.uid()));
create policy wrxs_feature_votes_remove on public.wrxs_feature_votes for delete to authenticated using (user_id=(select auth.uid()));
drop policy if exists wrxs_platform_admin_self on public.wrxs_platform_admins;
create policy wrxs_platform_admin_self on public.wrxs_platform_admins for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.wrxs_feature_touch()
returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=clock_timestamp(); return new; end; $$;
drop trigger if exists wrxs_feature_requests_touch on public.wrxs_feature_requests;
create trigger wrxs_feature_requests_touch before update on public.wrxs_feature_requests for each row execute function public.wrxs_feature_touch();

create or replace view public.wrxs_feature_board with (security_invoker=false) as
select r.id,r.title,r.description,r.status,r.decision_note,r.created_at,r.updated_at,r.deployed_at,
  count(v.user_id)::int as vote_count,
  bool_or(v.user_id=(select auth.uid())) filter (where v.user_id is not null) as voted_by_me
from public.wrxs_feature_requests r left join public.wrxs_feature_votes v on v.feature_request_id=r.id
group by r.id;
revoke all on public.wrxs_feature_board from public, anon;
grant select on public.wrxs_feature_board to authenticated;
commit;
select '11 complete: shared feature board, per-user votes, and founder moderation installed' as result;
