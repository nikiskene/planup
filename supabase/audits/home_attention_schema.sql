-- Planup Home attention: read-only schema inspection.
-- Run in the SQL editor of project zvdraynveyfktpfmoetv.
-- Returns one JSON document containing schema definitions, not contact data.
-- Does not change tables, functions, policies, or application records.
with relevant_tables as (
  select c.oid, n.nspname, c.relname, c.relkind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and (c.relname like 'crm_%' or c.relname like 'v_crm_%'
      or c.relname in ('tasks', 'workspace_members', 'workspaces'))
), relevant_functions as (
  select p.oid, p.proname
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and (p.proname ~* 'crm|contact|interaction|reconnect|follow|task|workspace|member'
      or p.oid in (
        select t.tgfoid from pg_trigger t
        where not t.tgisinternal and t.tgrelid in (select oid from relevant_tables)
      ))
)
select jsonb_pretty(jsonb_build_object(
  'columns', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select table_name, column_name, data_type, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name in (select relname from relevant_tables)
    order by table_name, ordinal_position
  ) x), '[]'::jsonb),
  'constraints', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select r.relname as table_name, c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c join relevant_tables r on r.oid = c.conrelid
    order by r.relname, c.conname
  ) x), '[]'::jsonb),
  'triggers', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select r.relname as table_name, t.tgname, t.tgenabled,
      pg_get_triggerdef(t.oid) as definition
    from pg_trigger t join relevant_tables r on r.oid = t.tgrelid
    where not t.tgisinternal order by r.relname, t.tgname
  ) x), '[]'::jsonb),
  'functions', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select proname, pg_get_functiondef(oid) as definition from relevant_functions
    order by proname, oid
  ) x), '[]'::jsonb),
  'views', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select relname, pg_get_viewdef(oid, true) as definition
    from relevant_tables where relkind in ('v', 'm') order by relname
  ) x), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'public'
      and tablename in (select relname from relevant_tables)
    order by tablename, policyname
  ) x), '[]'::jsonb),
  'row_security', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c where c.oid in (select oid from relevant_tables)
    order by c.relname
  ) x), '[]'::jsonb),
  'enums', coalesce((select jsonb_agg(to_jsonb(x)) from (
    select t.typname, e.enumlabel, e.enumsortorder
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' order by t.typname, e.enumsortorder
  ) x), '[]'::jsonb)
)) as home_attention_schema;
