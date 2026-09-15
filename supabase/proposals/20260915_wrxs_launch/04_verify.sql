-- Force planning to confirm both repaired views no longer recurse. No content returned.
select * from public.shopping_item_suggestions limit 0;
select * from public.crm_contacts_with_tags limit 0;

-- WRXS postflight. Read-only; run after all three changes complete successfully.
select jsonb_build_object(
  'profile_global_read_removed',not exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and cmd='SELECT' and qual='true'),
  'workspace_boundary_policy_count',(select count(*) from pg_policies where schemaname='public' and policyname='wrxs_workspace_boundary' and permissive='RESTRICTIVE'),
  'workspace_link_constraint_count',(select count(*) from pg_constraint where connamespace='public'::regnamespace and conname like 'wrxs_%_workspace_fk' and convalidated),
  'private_foundation_tables',(select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'browser_can_insert',has_table_privilege('authenticated',c.oid,'INSERT'),'anonymous_can_read',has_table_privilege('anon',c.oid,'SELECT'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'wrxs_%' and c.relname<>'wrxs_price_catalog'),
  'prices',(select jsonb_agg(jsonb_build_object('interval',billing_interval,'currency',currency,'amount_cents',amount_cents,'checkout_enabled',checkout_enabled)) from public.wrxs_price_catalog),
  'active_email_routes',(select count(*) from public.wrxs_email_routes where enabled),
  'subscriptions',(select count(*) from public.wrxs_subscriptions),
  'invitation_count',(select count(*) from public.wrxs_workspace_invitations)
) as wrxs_verification;
