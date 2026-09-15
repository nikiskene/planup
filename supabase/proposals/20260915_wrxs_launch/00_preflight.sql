-- WRXS / wrxs.cc — RUN THIS FIRST. Read-only, no changes.
-- Return the single JSON result before continuing if any orphan_count is nonzero,
-- required_columns_present is false, or stage_3_already_installed is true.
select jsonb_build_object(
  'supported_postgres',current_setting('server_version_num')::int>=150000,
  'required_columns_present',(select count(*)=4 from information_schema.columns where table_schema='public' and ((table_name='profiles' and column_name in ('id','email')) or (table_name='workspace_members' and column_name in ('only_shopping','shopping_only')))),
  'workspace_count',(select count(*) from public.workspaces),
  'profile_policies',(select jsonb_agg(policyname) from pg_policies where schemaname='public' and tablename='profiles'),
  'inconsistent_shopping_flags',(select count(*) from public.workspace_members where coalesce(only_shopping,false)<>coalesce(shopping_only,false)),
  'stage_3_already_installed',to_regclass('public.wrxs_price_catalog') is not null,
  'workspace_link_checks',(select jsonb_agg(checks) from (
select 'crm_contact_tags.tag_id' as relationship, count(*) as orphan_count from public.crm_contact_tags child left join public.crm_tags parent on parent.id=child.tag_id and parent.workspace_id=child.workspace_id where child.tag_id is not null and parent.id is null union all
select 'crm_contacts.associated_deal_id' as relationship, count(*) as orphan_count from public.crm_contacts child left join public.crm_deals parent on parent.id=child.associated_deal_id and parent.workspace_id=child.workspace_id where child.associated_deal_id is not null and parent.id is null union all
select 'crm_interactions.company_id' as relationship, count(*) as orphan_count from public.crm_interactions child left join public.crm_companies parent on parent.id=child.company_id and parent.workspace_id=child.workspace_id where child.company_id is not null and parent.id is null union all
select 'crm_interactions.task_id' as relationship, count(*) as orphan_count from public.crm_interactions child left join public.tasks parent on parent.id=child.task_id and parent.workspace_id=child.workspace_id where child.task_id is not null and parent.id is null union all
select 'tasks.crm_company_id' as relationship, count(*) as orphan_count from public.tasks child left join public.crm_companies parent on parent.id=child.crm_company_id and parent.workspace_id=child.workspace_id where child.crm_company_id is not null and parent.id is null union all
select 'tasks.crm_contact_id' as relationship, count(*) as orphan_count from public.tasks child left join public.crm_contacts parent on parent.id=child.crm_contact_id and parent.workspace_id=child.workspace_id where child.crm_contact_id is not null and parent.id is null union all
select 'tasks.crm_interaction_id' as relationship, count(*) as orphan_count from public.tasks child left join public.crm_interactions parent on parent.id=child.crm_interaction_id and parent.workspace_id=child.workspace_id where child.crm_interaction_id is not null and parent.id is null union all
select 'notes.category_id' as relationship, count(*) as orphan_count from public.notes child left join public.categories parent on parent.id=child.category_id and parent.workspace_id=child.workspace_id where child.category_id is not null and parent.id is null union all
select 'notes.linked_task_id' as relationship, count(*) as orphan_count from public.notes child left join public.tasks parent on parent.id=child.linked_task_id and parent.workspace_id=child.workspace_id where child.linked_task_id is not null and parent.id is null union all
select 'dues.category_id' as relationship, count(*) as orphan_count from public.dues child left join public.categories parent on parent.id=child.category_id and parent.workspace_id=child.workspace_id where child.category_id is not null and parent.id is null union all
select 'bookings.meeting_type_id' as relationship, count(*) as orphan_count from public.bookings child left join public.meeting_types parent on parent.id=child.meeting_type_id and parent.workspace_id=child.workspace_id where child.meeting_type_id is not null and parent.id is null union all
select 'shopping_items.list_id' as relationship, count(*) as orphan_count from public.shopping_items child left join public.shopping_lists parent on parent.id=child.list_id and parent.workspace_id=child.workspace_id where child.list_id is not null and parent.id is null
  ) checks)
) as wrxs_preflight;
