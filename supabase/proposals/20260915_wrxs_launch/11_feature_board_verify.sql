-- Run after 11_feature_board.sql. Read-only verification.
select json_build_object(
  'platform_admins', (select count(*) from public.wrxs_platform_admins),
  'feature_request_rls', (select relrowsecurity from pg_class where oid='public.wrxs_feature_requests'::regclass),
  'vote_rls', (select relrowsecurity from pg_class where oid='public.wrxs_feature_votes'::regclass),
  'feature_board_columns', (select count(*) from information_schema.columns where table_schema='public' and table_name='wrxs_feature_board')
) as wrxs_feature_board_verification;
