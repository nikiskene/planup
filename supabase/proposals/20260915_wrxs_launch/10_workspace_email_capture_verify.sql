-- Run after 10_workspace_email_capture.sql. Read-only verification.
select json_build_object(
  'wrxs_email_route_domain', (select column_default from information_schema.columns where table_schema='public' and table_name='wrxs_email_routes' and column_name='domain'),
  'enabled_routes', (select count(*) from public.wrxs_email_routes where enabled),
  'root_domain_only', not exists(select 1 from public.wrxs_email_routes where domain <> 'wrxs.cc'),
  'private_delivery_ledger', (select relrowsecurity from pg_class where oid='public.wrxs_email_deliveries'::regclass)
) as wrxs_email_capture_verification;
