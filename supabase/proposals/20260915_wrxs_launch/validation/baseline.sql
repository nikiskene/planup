create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on all functions in schema auth to anon,authenticated,service_role;
set check_function_bodies=false;
create type public."booking_status" as enum ('requested','confirmed','canceled');
create type public."crm_channel" as enum ('phone','text','social','email','website');
create type public."crm_deal_state" as enum ('planned','executed','cancelled');
create type public."crm_next_action" as enum ('reconnect','none','disconnect');
create type public."due_status" as enum ('planned','paid','disputed','archived','overdue','pending');
create type public."member_role" as enum ('owner','admin','contributor','viewer');
create type public."task_priority" as enum ('P0','P1','P2');
create type public."task_status" as enum ('inbox','next','waiting','scheduled','done','archived');
create table public."bookings" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"meeting_type_id" uuid,"guest_name" text not null,"guest_email" text not null,"guest_note" text,"requested_start" timestamp with time zone not null,"requested_end" timestamp with time zone not null,"confirmed_start" timestamp with time zone,"confirmed_end" timestamp with time zone,"status" public."booking_status" default 'requested'::booking_status not null,"ms_event_id" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."categories" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"name" text not null,"sort_order" integer default 0 not null,"is_system" boolean default false not null,"created_at" timestamp with time zone default now() not null,"created_by" uuid default auth.uid() not null);
create table public."crm_companies" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"name" text not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"linkedin_url" text,"notes" text,"website_url" text);
create table public."crm_contact_tags" ("contact_id" uuid not null,"tag_id" uuid not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"workspace_id" uuid not null);
create table public."crm_contacts" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"company_id" uuid,"first_name" text,"last_name" text,"email" text,"linkedin_url" text,"phone" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"lead_status" text,"associated_deal_id" uuid,"is_active" boolean default true not null,"attention_reopened_at" timestamp with time zone);
create table public."crm_deals" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"name" text not null,"start_date" date,"end_date" date,"value" numeric,"capacity" integer,"details" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"is_active" boolean default true not null,"state" public."crm_deal_state" default 'planned'::crm_deal_state not null);
create table public."crm_email_ingestions" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"internet_message_id" text not null,"sender_email" text,"recipient_email" text,"subject" text,"graph_message_id" text,"contact_id" uuid,"interaction_id" uuid,"status" text default 'processed'::text not null,"error_message" text,"processed_at" timestamp with time zone default now() not null,"created_at" timestamp with time zone default now() not null);
create table public."crm_interactions" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"contact_id" uuid not null,"occurred_at" timestamp with time zone default now() not null,"channel" public."crm_channel" not null,"note" text,"next_action" public."crm_next_action" default 'none'::crm_next_action not null,"reconnect_in_days" integer,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"company_id" uuid,"title" text,"notes" text,"type" text,"link" text,"task_id" uuid,"activity_kind" text);
create table public."crm_lead_statuses" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"key" text default ('custom_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)) not null,"name" text not null,"is_system" boolean default false not null,"sort_order" integer default 100 not null,"created_by" uuid default auth.uid(),"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"home_attention_mode" text);
create table public."crm_tags" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"name" text not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."dues" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"payee" text not null,"amount" numeric not null,"currency" text default 'EUR'::text not null,"due_date" date not null,"status" public."due_status" default 'planned'::due_status not null,"reference" text,"category_id" uuid,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."meeting_types" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"title" text not null,"duration_min" integer not null,"is_active" boolean default true not null,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null);
create table public."notes" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"headline" text,"body" text not null,"source" text,"priority" public."task_priority" default 'P2'::task_priority not null,"category_id" uuid,"linked_task_id" uuid,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null);
create table public."offline_lost_and_found" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"user_id" uuid not null,"device_id" text not null,"entity_table" text not null,"entity_id" uuid not null,"operation" text not null,"reason" text not null,"base_record" jsonb,"local_record" jsonb,"server_record" jsonb,"status" text default 'unresolved'::text not null,"created_at" timestamp with time zone default now() not null,"resolved_at" timestamp with time zone,"resolved_by" uuid);
create table public."profiles" ("id" uuid not null,"full_name" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"email" text);
create table public."qr_codes" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"created_by" uuid not null,"name" text not null,"type" text not null,"payload" text not null,"input_data" jsonb not null,"configuration" jsonb not null,"source_type" text,"source_id" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."shopping_items" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"list_id" uuid not null,"name" text not null,"name_norm" text,"is_checked" boolean default false not null,"checked_by" uuid,"checked_at" timestamp with time zone,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null,"normalized_text" text);
create table public."shopping_lists" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"title" text default 'Shopping List'::text not null,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null,"archived_at" timestamp with time zone);
create table public."tasks" ("id" uuid default gen_random_uuid() not null,"workspace_id" uuid not null,"title" text not null,"description" text,"status" public."task_status" default 'inbox'::task_status not null,"next_step" text,"priority" public."task_priority" default 'P2'::task_priority not null,"time_estimate_min" integer default 15 not null,"due_at" timestamp with time zone,"category_id" uuid,"created_by" uuid not null,"assigned_to" uuid,"waiting_for" text,"energy_level" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"crm_company_id" uuid,"crm_contact_id" uuid,"crm_interaction_id" uuid,"is_crm_follow_up" boolean default false not null);
create table public."workspace_members" ("workspace_id" uuid not null,"user_id" uuid not null,"role" public."member_role" default 'contributor'::member_role not null,"can_create_tasks" boolean default true not null,"can_assign_tasks" boolean default true not null,"can_set_priority_p0" boolean default false not null,"can_edit_others_tasks" boolean default false not null,"can_manage_dues" boolean default false not null,"can_manage_bookings" boolean default false not null,"can_manage_members" boolean default false not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"can_add_shopping" boolean default false not null,"can_check_shopping" boolean default false not null,"can_write_shopping" boolean default false not null,"shopping_only" boolean default false not null,"only_shopping" boolean default false not null);
create table public."workspaces" ("id" uuid default gen_random_uuid() not null,"name" text not null,"created_by" uuid not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"photo_url" text);
alter table public."profiles" add constraint "profiles_email_unique" UNIQUE (email);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."workspaces" add constraint "workspaces_pkey" PRIMARY KEY (id);
alter table public."workspace_members" add constraint "workspace_members_pkey" PRIMARY KEY (workspace_id, user_id);
alter table public."categories" add constraint "categories_pkey" PRIMARY KEY (id);
alter table public."categories" add constraint "categories_workspace_id_id_uniq" UNIQUE (workspace_id, id);
alter table public."categories" add constraint "categories_workspace_id_name_key" UNIQUE (workspace_id, name);
alter table public."tasks" add constraint "tasks_energy_level_check" CHECK ((energy_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public."tasks" add constraint "tasks_pkey" PRIMARY KEY (id);
alter table public."notes" add constraint "notes_pkey" PRIMARY KEY (id);
alter table public."dues" add constraint "dues_pkey" PRIMARY KEY (id);
alter table public."meeting_types" add constraint "meeting_types_duration_min_check" CHECK ((duration_min = ANY (ARRAY[30, 60])));
alter table public."meeting_types" add constraint "meeting_types_pkey" PRIMARY KEY (id);
alter table public."meeting_types" add constraint "meeting_types_workspace_id_title_duration_min_key" UNIQUE (workspace_id, title, duration_min);
alter table public."bookings" add constraint "bookings_pkey" PRIMARY KEY (id);
alter table public."shopping_lists" add constraint "shopping_lists_pkey" PRIMARY KEY (id);
alter table public."shopping_items" add constraint "shopping_items_pkey" PRIMARY KEY (id);
alter table public."crm_companies" add constraint "crm_companies_pkey" PRIMARY KEY (id);
alter table public."crm_companies" add constraint "crm_companies_ws_id_unique" UNIQUE (workspace_id, id);
alter table public."crm_contacts" add constraint "crm_contacts_pkey" PRIMARY KEY (id);
alter table public."crm_contacts" add constraint "crm_contacts_workspace_id_id_uniq" UNIQUE (workspace_id, id);
alter table public."crm_contacts" add constraint "crm_contacts_workspace_id_id_unique" UNIQUE (workspace_id, id);
alter table public."crm_interactions" add constraint "crm_interactions_activity_kind_check" CHECK ((activity_kind = ANY (ARRAY['contact'::text, 'attempt'::text, 'note'::text])));
alter table public."crm_interactions" add constraint "crm_interactions_pkey" PRIMARY KEY (id);
alter table public."crm_tags" add constraint "crm_tags_pkey" PRIMARY KEY (id);
alter table public."crm_tags" add constraint "crm_tags_workspace_id_name_key" UNIQUE (workspace_id, name);
alter table public."crm_contact_tags" add constraint "crm_contact_tags_pkey" PRIMARY KEY (contact_id, tag_id);
alter table public."crm_contact_tags" add constraint "crm_contact_tags_unique" UNIQUE (workspace_id, contact_id, tag_id);
alter table public."crm_deals" add constraint "crm_deals_pkey" PRIMARY KEY (id);
alter table public."crm_email_ingestions" add constraint "crm_email_ingestions_message_recipient_unique" UNIQUE (workspace_id, internet_message_id, recipient_email);
alter table public."crm_email_ingestions" add constraint "crm_email_ingestions_pkey" PRIMARY KEY (id);
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_home_attention_mode_check" CHECK ((home_attention_mode = ANY (ARRAY['normal'::text, 'deferred'::text, 'excluded'::text])));
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_key_format" CHECK ((key ~ '^[a-z0-9_]+$'::text));
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_name_not_blank" CHECK ((length(TRIM(BOTH FROM name)) > 0));
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_pkey" PRIMARY KEY (id);
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_workspace_key_unique" UNIQUE (workspace_id, key);
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_operation_check" CHECK ((operation = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])));
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_pkey" PRIMARY KEY (id);
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_status_check" CHECK ((status = ANY (ARRAY['unresolved'::text, 'kept_local'::text, 'kept_server'::text, 'merged'::text, 'dismissed'::text])));
alter table public."qr_codes" add constraint "qr_codes_configuration_check" CHECK ((jsonb_typeof(configuration) = 'object'::text));
alter table public."qr_codes" add constraint "qr_codes_input_data_check" CHECK ((jsonb_typeof(input_data) = 'object'::text));
alter table public."qr_codes" add constraint "qr_codes_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 200)));
alter table public."qr_codes" add constraint "qr_codes_payload_check" CHECK (((octet_length(payload) >= 1) AND (octet_length(payload) <= 20000)));
alter table public."qr_codes" add constraint "qr_codes_pkey" PRIMARY KEY (id);
alter table public."qr_codes" add constraint "qr_codes_type_check" CHECK ((type = ANY (ARRAY['url'::text, 'text'::text, 'email'::text, 'phone'::text, 'whatsapp'::text, 'wifi'::text, 'vcard'::text, 'event'::text])));
alter table public."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."workspaces" add constraint "workspaces_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."workspace_members" add constraint "workspace_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."workspace_members" add constraint "workspace_members_user_id_profiles_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."workspace_members" add constraint "workspace_members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."categories" add constraint "categories_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."categories" add constraint "categories_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."tasks" add constraint "tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."tasks" add constraint "tasks_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public."tasks" add constraint "tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."tasks" add constraint "tasks_workspace_category_same_ws_fkey" FOREIGN KEY (workspace_id, category_id) REFERENCES categories(workspace_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
alter table public."tasks" add constraint "tasks_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."notes" add constraint "notes_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public."notes" add constraint "notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."notes" add constraint "notes_linked_task_id_fkey" FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
alter table public."notes" add constraint "notes_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."dues" add constraint "dues_category_id_fkey" FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public."dues" add constraint "dues_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."dues" add constraint "dues_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."meeting_types" add constraint "meeting_types_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public."meeting_types" add constraint "meeting_types_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."bookings" add constraint "bookings_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."bookings" add constraint "bookings_meeting_type_id_fkey" FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id) ON DELETE SET NULL;
alter table public."bookings" add constraint "bookings_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."shopping_lists" add constraint "shopping_lists_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."shopping_items" add constraint "shopping_items_list_id_fkey" FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE;
alter table public."shopping_items" add constraint "shopping_items_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_companies" add constraint "crm_companies_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_contacts" add constraint "crm_contacts_associated_deal_fk" FOREIGN KEY (associated_deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
alter table public."crm_contacts" add constraint "crm_contacts_associated_deal_id_fkey" FOREIGN KEY (associated_deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL;
alter table public."crm_contacts" add constraint "crm_contacts_company_id_fkey" FOREIGN KEY (workspace_id, company_id) REFERENCES crm_companies(workspace_id, id) ON DELETE SET NULL;
alter table public."crm_contacts" add constraint "crm_contacts_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_contacts" add constraint "crm_contacts_workspace_lead_status_fkey" FOREIGN KEY (workspace_id, lead_status) REFERENCES crm_lead_statuses(workspace_id, key) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public."crm_interactions" add constraint "crm_interactions_company_fk" FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL;
alter table public."crm_interactions" add constraint "crm_interactions_contact_fk" FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
alter table public."crm_interactions" add constraint "crm_interactions_contact_id_fkey" FOREIGN KEY (workspace_id, contact_id) REFERENCES crm_contacts(workspace_id, id) ON DELETE CASCADE;
alter table public."crm_interactions" add constraint "crm_interactions_contact_ws_fkey" FOREIGN KEY (workspace_id, contact_id) REFERENCES crm_contacts(workspace_id, id) ON DELETE CASCADE;
alter table public."crm_interactions" add constraint "crm_interactions_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_tags" add constraint "crm_tags_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_contact_tags" add constraint "crm_contact_tags_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE;
alter table public."crm_contact_tags" add constraint "crm_contact_tags_contact_workspace_fkey" FOREIGN KEY (contact_id, workspace_id) REFERENCES crm_contacts(id, workspace_id) ON DELETE CASCADE;
alter table public."crm_contact_tags" add constraint "crm_contact_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE;
alter table public."crm_contact_tags" add constraint "crm_contact_tags_workspace_fk" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."crm_email_ingestions" add constraint "crm_email_ingestions_contact_id_fkey" FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;
alter table public."crm_email_ingestions" add constraint "crm_email_ingestions_interaction_id_fkey" FOREIGN KEY (interaction_id) REFERENCES crm_interactions(id) ON DELETE SET NULL;
alter table public."crm_lead_statuses" add constraint "crm_lead_statuses_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id);
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."offline_lost_and_found" add constraint "offline_lost_and_found_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
alter table public."qr_codes" add constraint "qr_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."qr_codes" add constraint "qr_codes_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX categories_workspace_idx ON public.categories USING btree (workspace_id);
CREATE INDEX notes_workspace_idx ON public.notes USING btree (workspace_id);
CREATE INDEX notes_created_by_idx ON public.notes USING btree (created_by);
CREATE INDEX dues_workspace_idx ON public.dues USING btree (workspace_id);
CREATE INDEX dues_due_date_idx ON public.dues USING btree (due_date);
CREATE INDEX meeting_types_workspace_idx ON public.meeting_types USING btree (workspace_id);
CREATE INDEX bookings_workspace_idx ON public.bookings USING btree (workspace_id);
CREATE INDEX bookings_requested_start_idx ON public.bookings USING btree (requested_start);
CREATE INDEX shopping_lists_workspace_id_idx ON public.shopping_lists USING btree (workspace_id);
CREATE INDEX crm_companies_workspace_id_idx ON public.crm_companies USING btree (workspace_id);
CREATE INDEX workspace_members_user_idx ON public.workspace_members USING btree (user_id);
CREATE INDEX workspace_members_only_shopping_idx ON public.workspace_members USING btree (workspace_id, user_id, only_shopping);
CREATE INDEX crm_contacts_workspace_lead_status_idx ON public.crm_contacts USING btree (workspace_id, lead_status);
CREATE INDEX crm_contacts_workspace_id_idx ON public.crm_contacts USING btree (workspace_id);
CREATE INDEX crm_contacts_company_id_idx ON public.crm_contacts USING btree (company_id);
CREATE INDEX crm_contacts_associated_deal_id_idx ON public.crm_contacts USING btree (associated_deal_id);
CREATE INDEX idx_crm_contacts_workspace_active ON public.crm_contacts USING btree (workspace_id, is_active);
CREATE INDEX shopping_items_workspace_id_idx ON public.shopping_items USING btree (workspace_id);
CREATE INDEX shopping_items_list_id_idx ON public.shopping_items USING btree (list_id);
CREATE INDEX shopping_items_name_norm_idx ON public.shopping_items USING btree (workspace_id, name_norm);
CREATE INDEX idx_shopping_items_workspace_name_lower ON public.shopping_items USING btree (workspace_id, lower(name));
CREATE INDEX idx_shopping_items_workspace_created_at ON public.shopping_items USING btree (workspace_id, created_at DESC);
CREATE INDEX shopping_items_normalized_idx ON public.shopping_items USING btree (workspace_id, normalized_text);
CREATE INDEX crm_email_ingestions_workspace_idx ON public.crm_email_ingestions USING btree (workspace_id);
CREATE INDEX crm_email_ingestions_contact_idx ON public.crm_email_ingestions USING btree (contact_id);
CREATE INDEX crm_interactions_workspace_id_idx ON public.crm_interactions USING btree (workspace_id);
CREATE INDEX crm_interactions_contact_id_idx ON public.crm_interactions USING btree (contact_id);
CREATE INDEX crm_interactions_workspace_contact_occurred_idx ON public.crm_interactions USING btree (workspace_id, contact_id, occurred_at DESC);
CREATE INDEX crm_home_contact_activity_idx ON public.crm_interactions USING btree (workspace_id, contact_id, occurred_at DESC, id);
CREATE INDEX tasks_category_id_idx ON public.tasks USING btree (category_id);
CREATE INDEX tasks_workspace_idx ON public.tasks USING btree (workspace_id);
CREATE INDEX tasks_created_by_idx ON public.tasks USING btree (created_by);
CREATE INDEX tasks_assigned_to_idx ON public.tasks USING btree (assigned_to);
CREATE INDEX tasks_due_at_idx ON public.tasks USING btree (due_at);
CREATE INDEX tasks_home_follow_up_idx ON public.tasks USING btree (workspace_id, crm_contact_id, due_at) WHERE (status = ANY (ARRAY['inbox'::task_status, 'next'::task_status, 'waiting'::task_status, 'scheduled'::task_status]));
CREATE INDEX tasks_crm_company_id_idx ON public.tasks USING btree (crm_company_id);
CREATE INDEX tasks_crm_contact_id_idx ON public.tasks USING btree (crm_contact_id);
CREATE UNIQUE INDEX tasks_one_reconnect_per_interaction ON public.tasks USING btree (crm_interaction_id) WHERE (crm_interaction_id IS NOT NULL);
CREATE UNIQUE INDEX tasks_workspace_interaction_uq ON public.tasks USING btree (workspace_id, crm_interaction_id) WHERE (crm_interaction_id IS NOT NULL);
CREATE UNIQUE INDEX tasks_unique_workspace_crm_interaction_id ON public.tasks USING btree (workspace_id, crm_interaction_id) WHERE (crm_interaction_id IS NOT NULL);
CREATE UNIQUE INDEX tasks_crm_interaction_id_uniq ON public.tasks USING btree (crm_interaction_id) WHERE (crm_interaction_id IS NOT NULL);
CREATE UNIQUE INDEX tasks_workspace_crm_interaction_id_uq ON public.tasks USING btree (workspace_id, crm_interaction_id);
CREATE INDEX crm_tags_workspace_id_idx ON public.crm_tags USING btree (workspace_id);
CREATE INDEX crm_contact_tags_tag_id_idx ON public.crm_contact_tags USING btree (tag_id);
CREATE INDEX crm_contact_tags_contact_id_idx ON public.crm_contact_tags USING btree (contact_id);
CREATE UNIQUE INDEX crm_deals_workspace_name_uq ON public.crm_deals USING btree (workspace_id, name);
CREATE INDEX crm_deals_workspace_id_idx ON public.crm_deals USING btree (workspace_id);
CREATE INDEX idx_crm_deals_workspace_active ON public.crm_deals USING btree (workspace_id, is_active);
CREATE INDEX idx_crm_deals_workspace_state ON public.crm_deals USING btree (workspace_id, state);
CREATE INDEX offline_lost_and_found_workspace_status_idx ON public.offline_lost_and_found USING btree (workspace_id, status, created_at DESC);
CREATE INDEX offline_lost_and_found_entity_idx ON public.offline_lost_and_found USING btree (workspace_id, entity_table, entity_id);
CREATE UNIQUE INDEX crm_lead_statuses_workspace_name_unique ON public.crm_lead_statuses USING btree (workspace_id, lower(name));
CREATE INDEX qr_codes_workspace_created_idx ON public.qr_codes USING btree (workspace_id, created_at DESC, id);
CREATE OR REPLACE FUNCTION public.crm_log_interaction(p_workspace_id uuid, p_contact_id uuid, p_channel crm_channel, p_occurred_at timestamp with time zone DEFAULT now(), p_note text DEFAULT NULL::text, p_next_action crm_next_action DEFAULT 'none'::crm_next_action, p_reconnect_in_days integer DEFAULT NULL::integer, p_create_task boolean DEFAULT true, p_task_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_interaction_id uuid;
  v_task_id uuid;
  v_due_at timestamptz;
  v_title text;
begin
  if not public.is_workspace_member(p_workspace_id, auth.uid()) then
    raise exception 'not a workspace member';
  end if;

  if p_next_action = 'reconnect' and p_reconnect_in_days is not null then
    v_due_at := now() + make_interval(days => p_reconnect_in_days);
  else
    v_due_at := null;
  end if;

  insert into public.crm_interactions (
    workspace_id,
    contact_id,
    occurred_at,
    channel,
    note,
    next_action,
    reconnect_in_days,
    created_by
  )
  values (
    p_workspace_id,
    p_contact_id,
    coalesce(p_occurred_at, now()),
    p_channel,
    p_note,
    coalesce(p_next_action, 'none'::public.crm_next_action),
    p_reconnect_in_days,
    auth.uid()
  )
  returning id into v_interaction_id;

  if p_create_task
     and p_next_action = 'reconnect'
     and p_reconnect_in_days is not null
     and p_reconnect_in_days > 0 then

    v_title := coalesce(nullif(trim(p_task_title), ''), 'Reconnect');

    insert into public.tasks (
      workspace_id,
      title,
      status,
      due_at,
      created_by,
      crm_contact_id
    )
    values (
      p_workspace_id,
      v_title,
      'open'::task_status,   -- adjust if your task_status enum differs
      v_due_at,
      auth.uid(),
      p_contact_id
    )
    returning id into v_task_id;
  end if;

  return v_interaction_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_interaction_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.next_action = 'reconnect'
     and new.reconnect_in_days is not null
     and new.reconnect_in_days > 0 then

    insert into public.tasks (
      workspace_id,
      title,
      description,
      status,
      priority,
      due_at,
      created_by,
      crm_contact_id
    )
    values (
      new.workspace_id,
      'Reconnect',
      coalesce(new.note, 'Follow up'),
      'next',
      'medium',
      now() + (new.reconnect_in_days || ' days')::interval,
      new.created_by,
      new.contact_id
    );

  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_delete_tasks_for_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.tasks
  where workspace_id = old.workspace_id
    and crm_interaction_id = old.id;

  return old;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_shopping_only(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(wm.shopping_only, false)
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
  limit 1
$function$
;
CREATE OR REPLACE FUNCTION public.member_can(p_workspace_id uuid, p_user_id uuid, p_perm text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v record;
begin
  select * into v
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;

  if not found then return false; end if;

  if v.role in ('owner','admin') then
    -- owners/admins can do everything in v1
    return true;
  end if;

  case p_perm
    when 'create_tasks' then return v.can_create_tasks;
    when 'assign_tasks' then return v.can_assign_tasks;
    when 'set_p0' then return v.can_set_priority_p0;
    when 'edit_others_tasks' then return v.can_edit_others_tasks;
    when 'manage_dues' then return v.can_manage_dues;
    when 'manage_bookings' then return v.can_manage_bookings;
    when 'manage_members' then return v.can_manage_members;
    else return false;
  end case;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_only_shopping_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- if one is set, mirror it to the other
  new.only_shopping := coalesce(new.only_shopping, new.shopping_only, false);
  new.shopping_only := coalesce(new.shopping_only, new.only_shopping, false);
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_list_contacts_with_tags(p_workspace_id uuid)
 RETURNS TABLE(contact_id uuid, workspace_id uuid, first_name text, last_name text, email text, linkedin_url text, phone text, tags json)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select
    contact_id,
    workspace_id,
    first_name,
    last_name,
    email,
    linkedin_url,
    phone,
    tags
  from public.crm_contacts_with_tags
  where workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id, auth.uid());
$function$
;
CREATE OR REPLACE FUNCTION public.can_check_shopping(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (
        wm.role = any (array['owner'::member_role, 'admin'::member_role])
        or wm.only_shopping = true
        or wm.shopping_only = true
        or wm.can_check_shopping = true
        or wm.can_write_shopping = true
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_add_shopping(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (wm.role = 'admin' or coalesce(wm.can_add_shopping, false) = true)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.crm_due_at(occurred_at timestamp with time zone, reconnect_in_days integer)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(occurred_at, now()) + make_interval(days => coalesce(reconnect_in_days, 0));
$function$
;
CREATE OR REPLACE FUNCTION public.toggle_shopping_item(p_item_id uuid, p_is_checked boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.shopping_items
  where id = p_item_id;

  if v_workspace_id is null then
    raise exception 'shopping item not found';
  end if;

  -- Permission gate: must be allowed to check in this workspace
  if not public.can_check_shopping(v_workspace_id) then
    raise exception 'not allowed to check shopping items';
  end if;

  update public.shopping_items
  set
    is_checked = p_is_checked,
    checked_by = case when p_is_checked then auth.uid() else null end,
    checked_at = case when p_is_checked then now() else null end
  where id = p_item_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_task_priority_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  uid uuid;
  allowed boolean;
begin
  uid := auth.uid();

  -- P0 remains strictly protected and requires an authenticated user.
  if new.priority = 'P0' then
    if uid is null then
      raise exception 'Authentication required to set priority P0';
    end if;

    allowed := public.member_can(new.workspace_id, uid, 'set_p0');

    if not allowed then
      raise exception 'Not allowed to set priority P0';
    end if;
  end if;

  -- Automated P1/P2/P3 tasks are allowed when created_by is provided.
  if uid is null and new.created_by is null then
    raise exception 'Authentication or created_by required';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_workspace_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workspaces (name, created_by)
  values (p_name, v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    can_manage_members,
    can_manage_dues,
    can_set_priority_p0,
    can_edit_others_tasks
  )
  values (
    v_workspace_id,
    v_user_id,
    'admin',
    true,
    true,
    true,
    true
  );

  return v_workspace_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_shopping_item_update_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Writers can change anything
  if public.can_write_shopping(new.workspace_id) then
    return new;
  end if;

  -- Non-writers must be checkers to update at all
  if not public.can_check_shopping(new.workspace_id) then
    raise exception 'not allowed to update shopping items';
  end if;

  -- Block changes to non-check fields
  if (coalesce(new.name,'') <> coalesce(old.name,''))
     or (new.list_id <> old.list_id)
     or (new.workspace_id <> old.workspace_id)
     or (coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
         <> coalesce(old.created_by, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'check-only users may not edit item details';
  end if;

  -- Allow only is_checked / checked_by / checked_at changes
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_dues(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (wm.role = 'admin' or wm.can_manage_dues = true)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.qr_codes_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.id := old.id;
  new.workspace_id := old.workspace_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_member_contributor(p_workspace_id uuid, p_user_id uuid, p_can_set_p0 boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'Authentication required'; end if;

  if not public.member_can(p_workspace_id, uid, 'manage_members') then
    raise exception 'Not allowed to manage members';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role,
    can_create_tasks, can_assign_tasks, can_set_priority_p0,
    can_edit_others_tasks, can_manage_dues, can_manage_bookings, can_manage_members
  ) values (
    p_workspace_id, p_user_id, 'contributor',
    true, true, p_can_set_p0,
    false, false, false, false
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        can_create_tasks = excluded.can_create_tasks,
        can_assign_tasks = excluded.can_assign_tasks,
        can_set_priority_p0 = excluded.can_set_priority_p0,
        can_edit_others_tasks = excluded.can_edit_others_tasks,
        can_manage_dues = excluded.can_manage_dues,
        can_manage_bookings = excluded.can_manage_bookings,
        can_manage_members = excluded.can_manage_members;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.add_member_by_email(p_workspace_id uuid, p_email text, p_can_set_p0 boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid;
  target_user_id uuid;
begin
  caller := auth.uid();
  if caller is null then
    raise exception 'Authentication required';
  end if;

  -- permission: only member managers can add members
  if not public.member_can(p_workspace_id, caller, 'manage_members') then
    raise exception 'Not allowed to manage members';
  end if;

  -- lookup user by email (must exist already)
  select id into target_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No user found with that email';
  end if;

  insert into public.workspace_members (
    workspace_id, user_id, role,
    can_create_tasks, can_assign_tasks, can_set_priority_p0,
    can_edit_others_tasks, can_manage_dues, can_manage_bookings, can_manage_members
  ) values (
    p_workspace_id, target_user_id, 'contributor',
    true, true, p_can_set_p0,
    false, false, false, false
  )
  on conflict (workspace_id, user_id) do update
    set can_set_priority_p0 = excluded.can_set_priority_p0;

  return target_user_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
  );
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_member_of_workspace(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_manage_members(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (wm.role = 'admin' or wm.can_manage_members = true)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$function$
;
CREATE OR REPLACE FUNCTION public.get_shopping_suggestions(p_workspace_id uuid, p_prefix text, p_limit integer DEFAULT 10)
 RETURNS TABLE(name text, name_norm text, last_seen_at timestamp with time zone, times_used bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.display_name as name,
    s.name_norm,
    s.last_seen_at,
    s.times_used
  from public.shopping_item_suggestions s
  where s.workspace_id = p_workspace_id
    and public.is_workspace_member(p_workspace_id)
    and s.name_norm like (lower(trim(p_prefix)) || '%')
  order by s.last_seen_at desc, s.times_used desc
  limit greatest(1, least(p_limit, 25));
$function$
;
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'admin'::member_role
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_read_shopping(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (
        wm.role = any (array['owner'::member_role, 'admin'::member_role])
        or wm.only_shopping = true
        or wm.shopping_only = true
        or wm.can_add_shopping = true
        or wm.can_check_shopping = true
        or wm.can_write_shopping = true
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_write_shopping(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and (
        wm.role = any (array['owner'::member_role, 'admin'::member_role])
        or wm.only_shopping = true
        or wm.shopping_only = true
        or wm.can_add_shopping = true
        or wm.can_write_shopping = true
      )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_only_shopping(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select wm.only_shopping
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
    limit 1
  ), false);
$function$
;
CREATE OR REPLACE FUNCTION public.is_only_shopping(p_workspace_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((
    select wm.only_shopping
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_user_id
    limit 1
  ), false);
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_only_shopping()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.only_shopping then
    -- lock everything down
    new.can_manage_members := false;
    new.can_manage_dues := false;
    new.can_set_priority_p0 := false;

    -- optional columns: only touch if they exist on the row type
    if to_jsonb(new) ? 'can_edit_others_tasks' then
      new.can_edit_others_tasks := false;
    end if;

    -- IMPORTANT: use a valid enum value
    new.role := 'viewer'::member_role;

    -- keep shopping permissions as-is (admin decides what to allow)
    -- (so we do NOT overwrite can_add_shopping / can_write_shopping / can_check_shopping)
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_crm_lead_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'System relationship statuses cannot be deleted';
    end if;

    return old;
  end if;

  if old.is_system then
    raise exception 'System relationship statuses cannot be changed';
  end if;

  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'A relationship status cannot be moved to another workspace';
  end if;

  if new.key is distinct from old.key then
    raise exception 'A relationship status key cannot be changed';
  end if;

  if new.is_system is distinct from old.is_system then
    raise exception 'A custom relationship status cannot become a system status';
  end if;

  new.name := trim(new.name);
  new.updated_at := now();

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.seed_default_crm_lead_statuses()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.crm_lead_statuses (
    workspace_id,
    key,
    name,
    is_system,
    sort_order
  )
  values
    (
      new.id,
      'in_progress',
      'In Progress',
      true,
      10
    ),
    (
      new.id,
      'connected',
      'Connected',
      true,
      20
    ),
    (
      new.id,
      'bad_timing',
      'Bad Timing',
      true,
      30
    )
  on conflict (workspace_id, key)
  do nothing;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_crm_lead_status(p_workspace_id uuid, p_status_key text, p_fallback_key text DEFAULT 'connected'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  moved_people integer := 0;
begin
  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.can_manage_members = true
  ) then
    raise exception
      'You do not have permission to manage relationship statuses';
  end if;

  if not exists (
    select 1
    from public.crm_lead_statuses status
    where status.workspace_id = p_workspace_id
      and status.key = p_status_key
      and status.is_system = false
  ) then
    raise exception
      'Only custom relationship statuses can be deleted';
  end if;

  if not exists (
    select 1
    from public.crm_lead_statuses fallback
    where fallback.workspace_id = p_workspace_id
      and fallback.key = p_fallback_key
      and fallback.is_system = true
  ) then
    raise exception
      'The fallback must be an immutable system status';
  end if;

  update public.crm_contacts
  set
    lead_status = p_fallback_key,
    updated_at = now()
  where workspace_id = p_workspace_id
    and lead_status = p_status_key;

  get diagnostics moved_people = row_count;

  delete from public.crm_lead_statuses
  where workspace_id = p_workspace_id
    and key = p_status_key
    and is_system = false;

  return moved_people;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.crm_sync_task_from_interaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contact_name text;
  v_company_name text;
  v_title text;
  v_desc text;
  v_due timestamptz;
  v_actor uuid;
  v_existing_created_by uuid;
begin
  -- Classified app activity with no next action must not create a task.
  -- NULL preserves the existing ingestion/legacy behaviour unchanged.
  if new.activity_kind is not null and new.next_action = 'none' then
    return new;
  end if;

  -- 1) Disconnect => archive any existing task and exit
  if new.next_action = 'disconnect' then
    update public.tasks
      set status = 'archived',
          updated_at = now()
    where workspace_id = new.workspace_id
      and crm_interaction_id = new.id;

    return new;
  end if;

  -- 2) Only create/update task for reconnect OR none
  if new.next_action not in ('reconnect','none') then
    return new;
  end if;

  -- 3) Resolve actor (created_by must never be null)
  v_actor := auth.uid();
  if v_actor is null then
    v_actor := new.created_by;
  end if;

  -- If still null, try to reuse existing task's created_by (update scenario)
  if v_actor is null then
    select t.created_by
      into v_existing_created_by
    from public.tasks t
    where t.workspace_id = new.workspace_id
      and t.crm_interaction_id = new.id
    limit 1;

    v_actor := v_existing_created_by;
  end if;

  if v_actor is null then
    raise exception 'Authentication required (cannot determine created_by for task)';
  end if;

  -- 4) Get contact + company names
  select
    trim(concat_ws(' ', c.first_name, c.last_name)),
    coalesce(co.name, '')
  into v_contact_name, v_company_name
  from public.crm_contacts c
  left join public.crm_companies co on co.id = c.company_id
  where c.id = new.contact_id;

  if v_contact_name is null or v_contact_name = '' then
    v_contact_name := 'Unknown contact';
  end if;

  -- 5) Due date = occurred_at (or now) + reconnect_in_days (or 0)
  v_due := coalesce(new.occurred_at, now())
           + ((coalesce(new.reconnect_in_days, 0))::text || ' days')::interval;

  -- 6) Title, description, next_step
  v_title := 'Follow up: ' || v_contact_name;

  v_desc :=
    concat_ws(
      E'\n',
      case when v_company_name <> '' then 'Company: ' || v_company_name else null end,
      case when new.title is not null and new.title <> '' then 'Interaction: ' || new.title else null end,
      case when new.note is not null and new.note <> '' then 'Note: ' || new.note else null end,
      case when new.link is not null and new.link <> '' then 'Link: ' || new.link else null end
    );

  -- next_step: make it a short actionable hint based on next_action
  -- (you can refine later)
  -- reconnect => "Reconnect"
  -- none => "Follow up"
  -- disconnect never reaches here
  -- NOTE: keeping this simple and consistent
  -- (You asked for "Next Step" included)
  -- We'll store in tasks.next_step
  -- and keep title/desc separate.
  --
  -- 7) Upsert task
  insert into public.tasks (
    workspace_id,
    title,
    description,
    status,
    next_step,
    priority,
    time_estimate_min,
    due_at,
    created_by,
    assigned_to,
    crm_company_id,
    crm_contact_id,
    crm_interaction_id
  )
  values (
    new.workspace_id,
    v_title,
    v_desc,
    'next'::task_status,
    case when new.next_action = 'reconnect' then 'Reconnect' else 'Follow up' end,
    'P1'::task_priority,
    5,
    v_due,
    v_actor,
    null,
    new.company_id,
    new.contact_id,
    new.id
  )
  on conflict (workspace_id, crm_interaction_id)
  do update set
    title = excluded.title,
    description = excluded.description,
    next_step = excluded.next_step,
    due_at = excluded.due_at,
    crm_company_id = excluded.crm_company_id,
    crm_contact_id = excluded.crm_contact_id,
    -- keep done unless user explicitly reopens; archived should reopen to next
    status = case
      when public.tasks.status = 'done' then public.tasks.status
      when public.tasks.status = 'archived' then 'next'::task_status
      else public.tasks.status
    end,
    updated_at = now();

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.home_email_contact_evidence(p_workspace_id uuid, p_after uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, contact_id uuid, interaction_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
      and not coalesce(wm.only_shopping, false)
      and not coalesce(wm.shopping_only, false)
  ) then
    raise exception 'Workspace access required';
  end if;
  return query
    select e.id, e.contact_id, e.interaction_id
    from public.crm_email_ingestions e
    join public.crm_interactions i on i.id = e.interaction_id
      and i.workspace_id = e.workspace_id and i.contact_id = e.contact_id
    where e.workspace_id = p_workspace_id and e.status = 'processed'
      and i.channel = 'email' and (p_after is null or e.id > p_after)
    order by e.id limit 200;
end;
$function$
;
alter table public."bookings" enable row level security;
alter table public."categories" enable row level security;
alter table public."crm_companies" enable row level security;
alter table public."crm_contact_tags" enable row level security;
alter table public."crm_contacts" enable row level security;
alter table public."crm_deals" enable row level security;
alter table public."crm_email_ingestions" enable row level security;
alter table public."crm_interactions" enable row level security;
alter table public."crm_lead_statuses" enable row level security;
alter table public."crm_tags" enable row level security;
alter table public."dues" enable row level security;
alter table public."meeting_types" enable row level security;
alter table public."notes" enable row level security;
alter table public."offline_lost_and_found" enable row level security;
alter table public."profiles" enable row level security;
alter table public."qr_codes" enable row level security;
alter table public."shopping_items" enable row level security;
alter table public."shopping_lists" enable row level security;
alter table public."tasks" enable row level security;
alter table public."workspace_members" enable row level security;
alter table public."workspaces" enable row level security;
create policy "bookings_delete_manager" on public."bookings" as PERMISSIVE for DELETE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text)));
create policy "bookings_select_member" on public."bookings" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "bookings_update_manager" on public."bookings" as PERMISSIVE for UPDATE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text))) with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text)));
create policy "bookings_write_manager" on public."bookings" as PERMISSIVE for INSERT to public with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text)));
create policy "categories_delete" on public."categories" as PERMISSIVE for DELETE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "categories_delete_manager" on public."categories" as PERMISSIVE for DELETE to "authenticated" using (can_manage_members(workspace_id));
create policy "categories_insert" on public."categories" as PERMISSIVE for INSERT to "authenticated" with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "categories_insert_manager" on public."categories" as PERMISSIVE for INSERT to "authenticated" with check ((can_manage_members(workspace_id) AND (created_by = auth.uid())));
create policy "categories_select" on public."categories" as PERMISSIVE for SELECT to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "categories_select_member" on public."categories" as PERMISSIVE for SELECT to "authenticated" using (is_workspace_member(workspace_id));
create policy "categories_update" on public."categories" as PERMISSIVE for UPDATE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id)))) with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "categories_update_manager" on public."categories" as PERMISSIVE for UPDATE to "authenticated" using (can_manage_members(workspace_id)) with check (can_manage_members(workspace_id));
create policy "categories_write_manager" on public."categories" as PERMISSIVE for INSERT to public with check (member_can(workspace_id, auth.uid(), 'manage_members'::text));
create policy "crm_companies_delete" on public."crm_companies" as PERMISSIVE for DELETE to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_companies_insert" on public."crm_companies" as PERMISSIVE for INSERT to public with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_companies_select" on public."crm_companies" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_companies_update" on public."crm_companies" as PERMISSIVE for UPDATE to public using (is_workspace_member(workspace_id, auth.uid())) with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_contact_tags_delete" on public."crm_contact_tags" as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM crm_contacts c
  WHERE ((c.id = crm_contact_tags.contact_id) AND is_workspace_member(c.workspace_id, auth.uid())))));
create policy "crm_contact_tags_insert" on public."crm_contact_tags" as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM crm_contacts c
  WHERE ((c.id = crm_contact_tags.contact_id) AND is_workspace_member(c.workspace_id, auth.uid())))));
create policy "crm_contact_tags_select" on public."crm_contact_tags" as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM crm_contacts c
  WHERE ((c.id = crm_contact_tags.contact_id) AND is_workspace_member(c.workspace_id, auth.uid())))));
create policy "crm_contacts_delete" on public."crm_contacts" as PERMISSIVE for DELETE to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_contacts_insert" on public."crm_contacts" as PERMISSIVE for INSERT to public with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_contacts_select" on public."crm_contacts" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_contacts_update" on public."crm_contacts" as PERMISSIVE for UPDATE to public using (is_workspace_member(workspace_id, auth.uid())) with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_deals_delete" on public."crm_deals" as PERMISSIVE for DELETE to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_deals_insert" on public."crm_deals" as PERMISSIVE for INSERT to public with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_deals_select" on public."crm_deals" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_deals_update" on public."crm_deals" as PERMISSIVE for UPDATE to public using (is_workspace_member(workspace_id, auth.uid())) with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_interactions_delete" on public."crm_interactions" as PERMISSIVE for DELETE to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_interactions_insert" on public."crm_interactions" as PERMISSIVE for INSERT to public with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_interactions_select" on public."crm_interactions" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_interactions_update" on public."crm_interactions" as PERMISSIVE for UPDATE to public using (is_workspace_member(workspace_id, auth.uid())) with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_lead_statuses_insert" on public."crm_lead_statuses" as PERMISSIVE for INSERT to public with check (((is_system = false) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = crm_lead_statuses.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.can_manage_members = true))))));
create policy "crm_lead_statuses_select" on public."crm_lead_statuses" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_lead_statuses_update" on public."crm_lead_statuses" as PERMISSIVE for UPDATE to public using (((is_system = false) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = crm_lead_statuses.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.can_manage_members = true)))))) with check (((is_system = false) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = crm_lead_statuses.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.can_manage_members = true))))));
create policy "crm_tags_delete" on public."crm_tags" as PERMISSIVE for DELETE to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_tags_insert" on public."crm_tags" as PERMISSIVE for INSERT to public with check (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_tags_select" on public."crm_tags" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "crm_tags_update" on public."crm_tags" as PERMISSIVE for UPDATE to public using (is_workspace_member(workspace_id, auth.uid())) with check (is_workspace_member(workspace_id, auth.uid()));
create policy "dues_delete" on public."dues" as PERMISSIVE for DELETE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "dues_delete_manager" on public."dues" as PERMISSIVE for DELETE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_dues'::text)));
create policy "dues_insert" on public."dues" as PERMISSIVE for INSERT to "authenticated" with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "dues_select" on public."dues" as PERMISSIVE for SELECT to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "dues_select_member" on public."dues" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "dues_update" on public."dues" as PERMISSIVE for UPDATE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id)))) with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "dues_update_manager" on public."dues" as PERMISSIVE for UPDATE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_dues'::text))) with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_dues'::text)));
create policy "dues_write_manager" on public."dues" as PERMISSIVE for INSERT to public with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_dues'::text) AND (created_by = auth.uid())));
create policy "meeting_types_delete_manager" on public."meeting_types" as PERMISSIVE for DELETE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text)));
create policy "meeting_types_select_member" on public."meeting_types" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "meeting_types_update_manager" on public."meeting_types" as PERMISSIVE for UPDATE to public using ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text))) with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text)));
create policy "meeting_types_write_manager" on public."meeting_types" as PERMISSIVE for INSERT to public with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'manage_bookings'::text) AND (created_by = auth.uid())));
create policy "notes_delete" on public."notes" as PERMISSIVE for DELETE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "notes_delete_own" on public."notes" as PERMISSIVE for DELETE to public using (((created_by = auth.uid()) AND is_workspace_member(workspace_id, auth.uid())));
create policy "notes_insert" on public."notes" as PERMISSIVE for INSERT to "authenticated" with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "notes_insert_own" on public."notes" as PERMISSIVE for INSERT to public with check ((is_workspace_member(workspace_id, auth.uid()) AND (created_by = auth.uid())));
create policy "notes_select" on public."notes" as PERMISSIVE for SELECT to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "notes_select_member" on public."notes" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "notes_update" on public."notes" as PERMISSIVE for UPDATE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id)))) with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "notes_update_own" on public."notes" as PERMISSIVE for UPDATE to public using (((created_by = auth.uid()) AND is_workspace_member(workspace_id, auth.uid()))) with check (((created_by = auth.uid()) AND is_workspace_member(workspace_id, auth.uid())));
create policy "Users can preserve their own offline conflicts" on public."offline_lost_and_found" as PERMISSIVE for INSERT to "authenticated" with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = offline_lost_and_found.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "Workspace members can resolve offline conflicts" on public."offline_lost_and_found" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = offline_lost_and_found.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = offline_lost_and_found.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid))))));
create policy "Workspace members can view offline conflicts" on public."offline_lost_and_found" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = offline_lost_and_found.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid))))));
create policy "profiles_select_authenticated" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (true);
create policy "profiles_select_own" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using ((email = (auth.jwt() ->> 'email'::text)));
create policy "profiles_update_own" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((email = (auth.jwt() ->> 'email'::text))) with check ((email = (auth.jwt() ->> 'email'::text)));
create policy "profiles_upsert_own" on public."profiles" as PERMISSIVE for INSERT to "authenticated" with check ((email = (auth.jwt() ->> 'email'::text)));
create policy "qr_workspace_delete" on public."qr_codes" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = qr_codes.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE(wm.only_shopping, false))))));
create policy "qr_workspace_insert" on public."qr_codes" as PERMISSIVE for INSERT to "authenticated" with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = qr_codes.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE(wm.only_shopping, false)))))));
create policy "qr_workspace_select" on public."qr_codes" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = qr_codes.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE(wm.only_shopping, false))))));
create policy "qr_workspace_update" on public."qr_codes" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = qr_codes.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE(wm.only_shopping, false)))))) with check ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = qr_codes.workspace_id) AND (wm.user_id = ( SELECT auth.uid() AS uid)) AND (NOT COALESCE(wm.only_shopping, false))))));
create policy "shopping_items_delete" on public."shopping_items" as PERMISSIVE for DELETE to "authenticated" using (can_write_shopping(workspace_id));
create policy "shopping_items_insert" on public."shopping_items" as PERMISSIVE for INSERT to "authenticated" with check (can_write_shopping(workspace_id));
create policy "shopping_items_select" on public."shopping_items" as PERMISSIVE for SELECT to "authenticated" using (can_read_shopping(workspace_id));
create policy "shopping_items_update" on public."shopping_items" as PERMISSIVE for UPDATE to "authenticated" using (can_write_shopping(workspace_id)) with check (can_write_shopping(workspace_id));
create policy "shopping_items_update_check" on public."shopping_items" as PERMISSIVE for UPDATE to "authenticated" using (can_check_shopping(workspace_id)) with check (can_check_shopping(workspace_id));
create policy "shopping_items_update_write" on public."shopping_items" as PERMISSIVE for UPDATE to "authenticated" using (can_write_shopping(workspace_id)) with check (can_write_shopping(workspace_id));
create policy "shopping_lists_delete_admin" on public."shopping_lists" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = shopping_lists.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))));
create policy "shopping_lists_insert_member" on public."shopping_lists" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = shopping_lists.workspace_id) AND (wm.user_id = auth.uid()) AND ((wm.only_shopping = true) OR (wm.shopping_only = true) OR (wm.can_add_shopping = true) OR (wm.can_write_shopping = true) OR (wm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])))))));
create policy "shopping_lists_select_member" on public."shopping_lists" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = shopping_lists.workspace_id) AND (wm.user_id = auth.uid()) AND ((wm.only_shopping = true) OR (wm.shopping_only = true) OR (wm.can_add_shopping = true) OR (wm.can_check_shopping = true) OR (wm.can_write_shopping = true) OR (wm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])))))));
create policy "shopping_lists_update_member" on public."shopping_lists" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = shopping_lists.workspace_id) AND (wm.user_id = auth.uid()) AND ((wm.only_shopping = true) OR (wm.shopping_only = true) OR (wm.can_add_shopping = true) OR (wm.can_write_shopping = true) OR (wm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role]))))))) with check ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = shopping_lists.workspace_id) AND (wm.user_id = auth.uid()) AND ((wm.only_shopping = true) OR (wm.shopping_only = true) OR (wm.can_add_shopping = true) OR (wm.can_write_shopping = true) OR (wm.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role])))))));
create policy "tasks_delete" on public."tasks" as PERMISSIVE for DELETE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "tasks_delete_own_or_editor" on public."tasks" as PERMISSIVE for DELETE to public using ((is_workspace_member(workspace_id, auth.uid()) AND ((created_by = auth.uid()) OR member_can(workspace_id, auth.uid(), 'edit_others_tasks'::text))));
create policy "tasks_insert" on public."tasks" as PERMISSIVE for INSERT to "authenticated" with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "tasks_insert_permitted" on public."tasks" as PERMISSIVE for INSERT to public with check ((is_workspace_member(workspace_id, auth.uid()) AND member_can(workspace_id, auth.uid(), 'create_tasks'::text) AND (created_by = auth.uid())));
create policy "tasks_select" on public."tasks" as PERMISSIVE for SELECT to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "tasks_select_member" on public."tasks" as PERMISSIVE for SELECT to public using (is_workspace_member(workspace_id, auth.uid()));
create policy "tasks_update" on public."tasks" as PERMISSIVE for UPDATE to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id)))) with check ((is_workspace_member(workspace_id) AND (NOT is_only_shopping(workspace_id))));
create policy "tasks_update_own_or_editor" on public."tasks" as PERMISSIVE for UPDATE to public using ((is_workspace_member(workspace_id, auth.uid()) AND ((created_by = auth.uid()) OR member_can(workspace_id, auth.uid(), 'edit_others_tasks'::text)))) with check ((is_workspace_member(workspace_id, auth.uid()) AND ((created_by = auth.uid()) OR member_can(workspace_id, auth.uid(), 'edit_others_tasks'::text))));
create policy "tasks_write" on public."tasks" as PERMISSIVE for ALL to "authenticated" using ((is_workspace_member(workspace_id) AND (NOT is_shopping_only(workspace_id)))) with check ((is_workspace_member(workspace_id) AND (NOT is_shopping_only(workspace_id))));
create policy "members_delete" on public."workspace_members" as PERMISSIVE for DELETE to "authenticated" using (can_manage_members(workspace_id));
create policy "members_insert" on public."workspace_members" as PERMISSIVE for INSERT to "authenticated" with check (can_manage_members(workspace_id));
create policy "members_select" on public."workspace_members" as PERMISSIVE for SELECT to "authenticated" using ((user_id = auth.uid()));
create policy "members_update" on public."workspace_members" as PERMISSIVE for UPDATE to "authenticated" using (can_manage_members(workspace_id)) with check (can_manage_members(workspace_id));
create policy "workspaces_insert" on public."workspaces" as PERMISSIVE for INSERT to "authenticated" with check ((created_by = auth.uid()));
create policy "workspaces_select" on public."workspaces" as PERMISSIVE for SELECT to "authenticated" using (((created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()))))));
create policy "workspaces_select_members" on public."workspaces" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid())))));
create policy "workspaces_update_admins" on public."workspaces" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::member_role))))) with check ((EXISTS ( SELECT 1
   FROM workspace_members wm
  WHERE ((wm.workspace_id = workspaces.id) AND (wm.user_id = auth.uid()) AND (wm.role = 'admin'::member_role)))));
grant INSERT on public."profiles" to "anon";
grant SELECT on public."profiles" to "anon";
grant UPDATE on public."profiles" to "anon";
grant DELETE on public."profiles" to "anon";
grant TRUNCATE on public."profiles" to "anon";
grant REFERENCES on public."profiles" to "anon";
grant TRIGGER on public."profiles" to "anon";
grant INSERT on public."profiles" to "authenticated";
grant SELECT on public."profiles" to "authenticated";
grant UPDATE on public."profiles" to "authenticated";
grant DELETE on public."profiles" to "authenticated";
grant TRUNCATE on public."profiles" to "authenticated";
grant REFERENCES on public."profiles" to "authenticated";
grant TRIGGER on public."profiles" to "authenticated";
grant INSERT on public."profiles" to "service_role";
grant SELECT on public."profiles" to "service_role";
grant UPDATE on public."profiles" to "service_role";
grant DELETE on public."profiles" to "service_role";
grant TRUNCATE on public."profiles" to "service_role";
grant REFERENCES on public."profiles" to "service_role";
grant TRIGGER on public."profiles" to "service_role";
grant INSERT on public."workspaces" to "anon";
grant SELECT on public."workspaces" to "anon";
grant UPDATE on public."workspaces" to "anon";
grant DELETE on public."workspaces" to "anon";
grant TRUNCATE on public."workspaces" to "anon";
grant REFERENCES on public."workspaces" to "anon";
grant TRIGGER on public."workspaces" to "anon";
grant INSERT on public."workspaces" to "authenticated";
grant SELECT on public."workspaces" to "authenticated";
grant UPDATE on public."workspaces" to "authenticated";
grant DELETE on public."workspaces" to "authenticated";
grant TRUNCATE on public."workspaces" to "authenticated";
grant REFERENCES on public."workspaces" to "authenticated";
grant TRIGGER on public."workspaces" to "authenticated";
grant INSERT on public."workspaces" to "service_role";
grant SELECT on public."workspaces" to "service_role";
grant UPDATE on public."workspaces" to "service_role";
grant DELETE on public."workspaces" to "service_role";
grant TRUNCATE on public."workspaces" to "service_role";
grant REFERENCES on public."workspaces" to "service_role";
grant TRIGGER on public."workspaces" to "service_role";
grant INSERT on public."categories" to "anon";
grant SELECT on public."categories" to "anon";
grant UPDATE on public."categories" to "anon";
grant DELETE on public."categories" to "anon";
grant TRUNCATE on public."categories" to "anon";
grant REFERENCES on public."categories" to "anon";
grant TRIGGER on public."categories" to "anon";
grant INSERT on public."categories" to "authenticated";
grant SELECT on public."categories" to "authenticated";
grant UPDATE on public."categories" to "authenticated";
grant DELETE on public."categories" to "authenticated";
grant TRUNCATE on public."categories" to "authenticated";
grant REFERENCES on public."categories" to "authenticated";
grant TRIGGER on public."categories" to "authenticated";
grant INSERT on public."categories" to "service_role";
grant SELECT on public."categories" to "service_role";
grant UPDATE on public."categories" to "service_role";
grant DELETE on public."categories" to "service_role";
grant TRUNCATE on public."categories" to "service_role";
grant REFERENCES on public."categories" to "service_role";
grant TRIGGER on public."categories" to "service_role";
grant INSERT on public."notes" to "anon";
grant SELECT on public."notes" to "anon";
grant UPDATE on public."notes" to "anon";
grant DELETE on public."notes" to "anon";
grant TRUNCATE on public."notes" to "anon";
grant REFERENCES on public."notes" to "anon";
grant TRIGGER on public."notes" to "anon";
grant INSERT on public."notes" to "authenticated";
grant SELECT on public."notes" to "authenticated";
grant UPDATE on public."notes" to "authenticated";
grant DELETE on public."notes" to "authenticated";
grant TRUNCATE on public."notes" to "authenticated";
grant REFERENCES on public."notes" to "authenticated";
grant TRIGGER on public."notes" to "authenticated";
grant INSERT on public."notes" to "service_role";
grant SELECT on public."notes" to "service_role";
grant UPDATE on public."notes" to "service_role";
grant DELETE on public."notes" to "service_role";
grant TRUNCATE on public."notes" to "service_role";
grant REFERENCES on public."notes" to "service_role";
grant TRIGGER on public."notes" to "service_role";
grant INSERT on public."dues" to "anon";
grant SELECT on public."dues" to "anon";
grant UPDATE on public."dues" to "anon";
grant DELETE on public."dues" to "anon";
grant TRUNCATE on public."dues" to "anon";
grant REFERENCES on public."dues" to "anon";
grant TRIGGER on public."dues" to "anon";
grant INSERT on public."dues" to "authenticated";
grant SELECT on public."dues" to "authenticated";
grant UPDATE on public."dues" to "authenticated";
grant DELETE on public."dues" to "authenticated";
grant TRUNCATE on public."dues" to "authenticated";
grant REFERENCES on public."dues" to "authenticated";
grant TRIGGER on public."dues" to "authenticated";
grant INSERT on public."dues" to "service_role";
grant SELECT on public."dues" to "service_role";
grant UPDATE on public."dues" to "service_role";
grant DELETE on public."dues" to "service_role";
grant TRUNCATE on public."dues" to "service_role";
grant REFERENCES on public."dues" to "service_role";
grant TRIGGER on public."dues" to "service_role";
grant INSERT on public."meeting_types" to "anon";
grant SELECT on public."meeting_types" to "anon";
grant UPDATE on public."meeting_types" to "anon";
grant DELETE on public."meeting_types" to "anon";
grant TRUNCATE on public."meeting_types" to "anon";
grant REFERENCES on public."meeting_types" to "anon";
grant TRIGGER on public."meeting_types" to "anon";
grant INSERT on public."meeting_types" to "authenticated";
grant SELECT on public."meeting_types" to "authenticated";
grant UPDATE on public."meeting_types" to "authenticated";
grant DELETE on public."meeting_types" to "authenticated";
grant TRUNCATE on public."meeting_types" to "authenticated";
grant REFERENCES on public."meeting_types" to "authenticated";
grant TRIGGER on public."meeting_types" to "authenticated";
grant INSERT on public."meeting_types" to "service_role";
grant SELECT on public."meeting_types" to "service_role";
grant UPDATE on public."meeting_types" to "service_role";
grant DELETE on public."meeting_types" to "service_role";
grant TRUNCATE on public."meeting_types" to "service_role";
grant REFERENCES on public."meeting_types" to "service_role";
grant TRIGGER on public."meeting_types" to "service_role";
grant INSERT on public."bookings" to "anon";
grant SELECT on public."bookings" to "anon";
grant UPDATE on public."bookings" to "anon";
grant DELETE on public."bookings" to "anon";
grant TRUNCATE on public."bookings" to "anon";
grant REFERENCES on public."bookings" to "anon";
grant TRIGGER on public."bookings" to "anon";
grant INSERT on public."bookings" to "authenticated";
grant SELECT on public."bookings" to "authenticated";
grant UPDATE on public."bookings" to "authenticated";
grant DELETE on public."bookings" to "authenticated";
grant TRUNCATE on public."bookings" to "authenticated";
grant REFERENCES on public."bookings" to "authenticated";
grant TRIGGER on public."bookings" to "authenticated";
grant INSERT on public."bookings" to "service_role";
grant SELECT on public."bookings" to "service_role";
grant UPDATE on public."bookings" to "service_role";
grant DELETE on public."bookings" to "service_role";
grant TRUNCATE on public."bookings" to "service_role";
grant REFERENCES on public."bookings" to "service_role";
grant TRIGGER on public."bookings" to "service_role";
grant INSERT on public."shopping_lists" to "anon";
grant SELECT on public."shopping_lists" to "anon";
grant UPDATE on public."shopping_lists" to "anon";
grant DELETE on public."shopping_lists" to "anon";
grant TRUNCATE on public."shopping_lists" to "anon";
grant REFERENCES on public."shopping_lists" to "anon";
grant TRIGGER on public."shopping_lists" to "anon";
grant INSERT on public."shopping_lists" to "authenticated";
grant SELECT on public."shopping_lists" to "authenticated";
grant UPDATE on public."shopping_lists" to "authenticated";
grant DELETE on public."shopping_lists" to "authenticated";
grant TRUNCATE on public."shopping_lists" to "authenticated";
grant REFERENCES on public."shopping_lists" to "authenticated";
grant TRIGGER on public."shopping_lists" to "authenticated";
grant INSERT on public."shopping_lists" to "service_role";
grant SELECT on public."shopping_lists" to "service_role";
grant UPDATE on public."shopping_lists" to "service_role";
grant DELETE on public."shopping_lists" to "service_role";
grant TRUNCATE on public."shopping_lists" to "service_role";
grant REFERENCES on public."shopping_lists" to "service_role";
grant TRIGGER on public."shopping_lists" to "service_role";
grant INSERT on public."crm_companies" to "anon";
grant SELECT on public."crm_companies" to "anon";
grant UPDATE on public."crm_companies" to "anon";
grant DELETE on public."crm_companies" to "anon";
grant TRUNCATE on public."crm_companies" to "anon";
grant REFERENCES on public."crm_companies" to "anon";
grant TRIGGER on public."crm_companies" to "anon";
grant INSERT on public."crm_companies" to "authenticated";
grant SELECT on public."crm_companies" to "authenticated";
grant UPDATE on public."crm_companies" to "authenticated";
grant DELETE on public."crm_companies" to "authenticated";
grant TRUNCATE on public."crm_companies" to "authenticated";
grant REFERENCES on public."crm_companies" to "authenticated";
grant TRIGGER on public."crm_companies" to "authenticated";
grant INSERT on public."crm_companies" to "service_role";
grant SELECT on public."crm_companies" to "service_role";
grant UPDATE on public."crm_companies" to "service_role";
grant DELETE on public."crm_companies" to "service_role";
grant TRUNCATE on public."crm_companies" to "service_role";
grant REFERENCES on public."crm_companies" to "service_role";
grant TRIGGER on public."crm_companies" to "service_role";
grant INSERT on public."workspace_members" to "anon";
grant SELECT on public."workspace_members" to "anon";
grant UPDATE on public."workspace_members" to "anon";
grant DELETE on public."workspace_members" to "anon";
grant TRUNCATE on public."workspace_members" to "anon";
grant REFERENCES on public."workspace_members" to "anon";
grant TRIGGER on public."workspace_members" to "anon";
grant INSERT on public."workspace_members" to "authenticated";
grant SELECT on public."workspace_members" to "authenticated";
grant UPDATE on public."workspace_members" to "authenticated";
grant DELETE on public."workspace_members" to "authenticated";
grant TRUNCATE on public."workspace_members" to "authenticated";
grant REFERENCES on public."workspace_members" to "authenticated";
grant TRIGGER on public."workspace_members" to "authenticated";
grant INSERT on public."workspace_members" to "service_role";
grant SELECT on public."workspace_members" to "service_role";
grant UPDATE on public."workspace_members" to "service_role";
grant DELETE on public."workspace_members" to "service_role";
grant TRUNCATE on public."workspace_members" to "service_role";
grant REFERENCES on public."workspace_members" to "service_role";
grant TRIGGER on public."workspace_members" to "service_role";
grant INSERT on public."crm_contacts" to "anon";
grant SELECT on public."crm_contacts" to "anon";
grant UPDATE on public."crm_contacts" to "anon";
grant DELETE on public."crm_contacts" to "anon";
grant TRUNCATE on public."crm_contacts" to "anon";
grant REFERENCES on public."crm_contacts" to "anon";
grant TRIGGER on public."crm_contacts" to "anon";
grant INSERT on public."crm_contacts" to "authenticated";
grant SELECT on public."crm_contacts" to "authenticated";
grant UPDATE on public."crm_contacts" to "authenticated";
grant DELETE on public."crm_contacts" to "authenticated";
grant TRUNCATE on public."crm_contacts" to "authenticated";
grant REFERENCES on public."crm_contacts" to "authenticated";
grant TRIGGER on public."crm_contacts" to "authenticated";
grant INSERT on public."crm_contacts" to "service_role";
grant SELECT on public."crm_contacts" to "service_role";
grant UPDATE on public."crm_contacts" to "service_role";
grant DELETE on public."crm_contacts" to "service_role";
grant TRUNCATE on public."crm_contacts" to "service_role";
grant REFERENCES on public."crm_contacts" to "service_role";
grant TRIGGER on public."crm_contacts" to "service_role";
grant INSERT on public."shopping_items" to "anon";
grant SELECT on public."shopping_items" to "anon";
grant UPDATE on public."shopping_items" to "anon";
grant DELETE on public."shopping_items" to "anon";
grant TRUNCATE on public."shopping_items" to "anon";
grant REFERENCES on public."shopping_items" to "anon";
grant TRIGGER on public."shopping_items" to "anon";
grant INSERT on public."shopping_items" to "authenticated";
grant SELECT on public."shopping_items" to "authenticated";
grant UPDATE on public."shopping_items" to "authenticated";
grant DELETE on public."shopping_items" to "authenticated";
grant TRUNCATE on public."shopping_items" to "authenticated";
grant REFERENCES on public."shopping_items" to "authenticated";
grant TRIGGER on public."shopping_items" to "authenticated";
grant INSERT on public."shopping_items" to "service_role";
grant SELECT on public."shopping_items" to "service_role";
grant UPDATE on public."shopping_items" to "service_role";
grant DELETE on public."shopping_items" to "service_role";
grant TRUNCATE on public."shopping_items" to "service_role";
grant REFERENCES on public."shopping_items" to "service_role";
grant TRIGGER on public."shopping_items" to "service_role";
grant INSERT on public."crm_email_ingestions" to "anon";
grant SELECT on public."crm_email_ingestions" to "anon";
grant UPDATE on public."crm_email_ingestions" to "anon";
grant DELETE on public."crm_email_ingestions" to "anon";
grant TRUNCATE on public."crm_email_ingestions" to "anon";
grant REFERENCES on public."crm_email_ingestions" to "anon";
grant TRIGGER on public."crm_email_ingestions" to "anon";
grant INSERT on public."crm_email_ingestions" to "authenticated";
grant SELECT on public."crm_email_ingestions" to "authenticated";
grant UPDATE on public."crm_email_ingestions" to "authenticated";
grant DELETE on public."crm_email_ingestions" to "authenticated";
grant TRUNCATE on public."crm_email_ingestions" to "authenticated";
grant REFERENCES on public."crm_email_ingestions" to "authenticated";
grant TRIGGER on public."crm_email_ingestions" to "authenticated";
grant INSERT on public."crm_email_ingestions" to "service_role";
grant SELECT on public."crm_email_ingestions" to "service_role";
grant UPDATE on public."crm_email_ingestions" to "service_role";
grant DELETE on public."crm_email_ingestions" to "service_role";
grant TRUNCATE on public."crm_email_ingestions" to "service_role";
grant REFERENCES on public."crm_email_ingestions" to "service_role";
grant TRIGGER on public."crm_email_ingestions" to "service_role";
grant INSERT on public."crm_interactions" to "anon";
grant SELECT on public."crm_interactions" to "anon";
grant UPDATE on public."crm_interactions" to "anon";
grant DELETE on public."crm_interactions" to "anon";
grant TRUNCATE on public."crm_interactions" to "anon";
grant REFERENCES on public."crm_interactions" to "anon";
grant TRIGGER on public."crm_interactions" to "anon";
grant INSERT on public."crm_interactions" to "authenticated";
grant SELECT on public."crm_interactions" to "authenticated";
grant UPDATE on public."crm_interactions" to "authenticated";
grant DELETE on public."crm_interactions" to "authenticated";
grant TRUNCATE on public."crm_interactions" to "authenticated";
grant REFERENCES on public."crm_interactions" to "authenticated";
grant TRIGGER on public."crm_interactions" to "authenticated";
grant INSERT on public."crm_interactions" to "service_role";
grant SELECT on public."crm_interactions" to "service_role";
grant UPDATE on public."crm_interactions" to "service_role";
grant DELETE on public."crm_interactions" to "service_role";
grant TRUNCATE on public."crm_interactions" to "service_role";
grant REFERENCES on public."crm_interactions" to "service_role";
grant TRIGGER on public."crm_interactions" to "service_role";
grant INSERT on public."tasks" to "anon";
grant SELECT on public."tasks" to "anon";
grant UPDATE on public."tasks" to "anon";
grant DELETE on public."tasks" to "anon";
grant TRUNCATE on public."tasks" to "anon";
grant REFERENCES on public."tasks" to "anon";
grant TRIGGER on public."tasks" to "anon";
grant INSERT on public."tasks" to "authenticated";
grant SELECT on public."tasks" to "authenticated";
grant UPDATE on public."tasks" to "authenticated";
grant DELETE on public."tasks" to "authenticated";
grant TRUNCATE on public."tasks" to "authenticated";
grant REFERENCES on public."tasks" to "authenticated";
grant TRIGGER on public."tasks" to "authenticated";
grant INSERT on public."tasks" to "service_role";
grant SELECT on public."tasks" to "service_role";
grant UPDATE on public."tasks" to "service_role";
grant DELETE on public."tasks" to "service_role";
grant TRUNCATE on public."tasks" to "service_role";
grant REFERENCES on public."tasks" to "service_role";
grant TRIGGER on public."tasks" to "service_role";
grant INSERT on public."crm_tags" to "anon";
grant SELECT on public."crm_tags" to "anon";
grant UPDATE on public."crm_tags" to "anon";
grant DELETE on public."crm_tags" to "anon";
grant TRUNCATE on public."crm_tags" to "anon";
grant REFERENCES on public."crm_tags" to "anon";
grant TRIGGER on public."crm_tags" to "anon";
grant INSERT on public."crm_tags" to "authenticated";
grant SELECT on public."crm_tags" to "authenticated";
grant UPDATE on public."crm_tags" to "authenticated";
grant DELETE on public."crm_tags" to "authenticated";
grant TRUNCATE on public."crm_tags" to "authenticated";
grant REFERENCES on public."crm_tags" to "authenticated";
grant TRIGGER on public."crm_tags" to "authenticated";
grant INSERT on public."crm_tags" to "service_role";
grant SELECT on public."crm_tags" to "service_role";
grant UPDATE on public."crm_tags" to "service_role";
grant DELETE on public."crm_tags" to "service_role";
grant TRUNCATE on public."crm_tags" to "service_role";
grant REFERENCES on public."crm_tags" to "service_role";
grant TRIGGER on public."crm_tags" to "service_role";
grant INSERT on public."crm_contact_tags" to "anon";
grant SELECT on public."crm_contact_tags" to "anon";
grant UPDATE on public."crm_contact_tags" to "anon";
grant DELETE on public."crm_contact_tags" to "anon";
grant TRUNCATE on public."crm_contact_tags" to "anon";
grant REFERENCES on public."crm_contact_tags" to "anon";
grant TRIGGER on public."crm_contact_tags" to "anon";
grant INSERT on public."crm_contact_tags" to "authenticated";
grant SELECT on public."crm_contact_tags" to "authenticated";
grant UPDATE on public."crm_contact_tags" to "authenticated";
grant DELETE on public."crm_contact_tags" to "authenticated";
grant TRUNCATE on public."crm_contact_tags" to "authenticated";
grant REFERENCES on public."crm_contact_tags" to "authenticated";
grant TRIGGER on public."crm_contact_tags" to "authenticated";
grant INSERT on public."crm_contact_tags" to "service_role";
grant SELECT on public."crm_contact_tags" to "service_role";
grant UPDATE on public."crm_contact_tags" to "service_role";
grant DELETE on public."crm_contact_tags" to "service_role";
grant TRUNCATE on public."crm_contact_tags" to "service_role";
grant REFERENCES on public."crm_contact_tags" to "service_role";
grant TRIGGER on public."crm_contact_tags" to "service_role";
grant INSERT on public."crm_deals" to "anon";
grant SELECT on public."crm_deals" to "anon";
grant UPDATE on public."crm_deals" to "anon";
grant DELETE on public."crm_deals" to "anon";
grant TRUNCATE on public."crm_deals" to "anon";
grant REFERENCES on public."crm_deals" to "anon";
grant TRIGGER on public."crm_deals" to "anon";
grant INSERT on public."crm_deals" to "authenticated";
grant SELECT on public."crm_deals" to "authenticated";
grant UPDATE on public."crm_deals" to "authenticated";
grant DELETE on public."crm_deals" to "authenticated";
grant TRUNCATE on public."crm_deals" to "authenticated";
grant REFERENCES on public."crm_deals" to "authenticated";
grant TRIGGER on public."crm_deals" to "authenticated";
grant INSERT on public."crm_deals" to "service_role";
grant SELECT on public."crm_deals" to "service_role";
grant UPDATE on public."crm_deals" to "service_role";
grant DELETE on public."crm_deals" to "service_role";
grant TRUNCATE on public."crm_deals" to "service_role";
grant REFERENCES on public."crm_deals" to "service_role";
grant TRIGGER on public."crm_deals" to "service_role";
grant INSERT on public."offline_lost_and_found" to "anon";
grant SELECT on public."offline_lost_and_found" to "anon";
grant UPDATE on public."offline_lost_and_found" to "anon";
grant DELETE on public."offline_lost_and_found" to "anon";
grant TRUNCATE on public."offline_lost_and_found" to "anon";
grant REFERENCES on public."offline_lost_and_found" to "anon";
grant TRIGGER on public."offline_lost_and_found" to "anon";
grant INSERT on public."offline_lost_and_found" to "authenticated";
grant SELECT on public."offline_lost_and_found" to "authenticated";
grant UPDATE on public."offline_lost_and_found" to "authenticated";
grant DELETE on public."offline_lost_and_found" to "authenticated";
grant TRUNCATE on public."offline_lost_and_found" to "authenticated";
grant REFERENCES on public."offline_lost_and_found" to "authenticated";
grant TRIGGER on public."offline_lost_and_found" to "authenticated";
grant INSERT on public."offline_lost_and_found" to "service_role";
grant SELECT on public."offline_lost_and_found" to "service_role";
grant UPDATE on public."offline_lost_and_found" to "service_role";
grant DELETE on public."offline_lost_and_found" to "service_role";
grant TRUNCATE on public."offline_lost_and_found" to "service_role";
grant REFERENCES on public."offline_lost_and_found" to "service_role";
grant TRIGGER on public."offline_lost_and_found" to "service_role";
grant INSERT on public."crm_lead_statuses" to "service_role";
grant SELECT on public."crm_lead_statuses" to "service_role";
grant UPDATE on public."crm_lead_statuses" to "service_role";
grant DELETE on public."crm_lead_statuses" to "service_role";
grant TRUNCATE on public."crm_lead_statuses" to "service_role";
grant REFERENCES on public."crm_lead_statuses" to "service_role";
grant TRIGGER on public."crm_lead_statuses" to "service_role";
grant INSERT on public."crm_lead_statuses" to "authenticated";
grant SELECT on public."crm_lead_statuses" to "authenticated";
grant UPDATE on public."crm_lead_statuses" to "authenticated";
grant INSERT on public."qr_codes" to "service_role";
grant SELECT on public."qr_codes" to "service_role";
grant UPDATE on public."qr_codes" to "service_role";
grant DELETE on public."qr_codes" to "service_role";
grant TRUNCATE on public."qr_codes" to "service_role";
grant REFERENCES on public."qr_codes" to "service_role";
grant TRIGGER on public."qr_codes" to "service_role";
grant INSERT on public."qr_codes" to "authenticated";
grant SELECT on public."qr_codes" to "authenticated";
grant DELETE on public."qr_codes" to "authenticated";
CREATE TRIGGER trg_enforce_only_shopping BEFORE INSERT OR UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION enforce_only_shopping();
CREATE TRIGGER trg_sync_only_shopping_flags BEFORE INSERT OR UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION sync_only_shopping_flags();
CREATE TRIGGER trg_workspace_members_updated_at BEFORE UPDATE ON workspace_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enforce_shopping_item_update_rules BEFORE UPDATE ON shopping_items FOR EACH ROW EXECUTE FUNCTION enforce_shopping_item_update_rules();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER protect_crm_lead_status BEFORE DELETE OR UPDATE ON crm_lead_statuses FOR EACH ROW EXECUTE FUNCTION protect_crm_lead_status();
CREATE TRIGGER trg_dues_updated_at BEFORE UPDATE ON dues FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_priority_guard BEFORE INSERT OR UPDATE OF priority ON tasks FOR EACH ROW EXECUTE FUNCTION enforce_task_priority_rules();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER qr_codes_before_update BEFORE UPDATE ON qr_codes FOR EACH ROW EXECUTE FUNCTION qr_codes_before_update();
CREATE TRIGGER trg_crm_interactions_delete_tasks AFTER DELETE ON crm_interactions FOR EACH ROW EXECUTE FUNCTION crm_delete_tasks_for_interaction();
CREATE TRIGGER trg_crm_interactions_sync_task AFTER INSERT OR UPDATE OF next_action, reconnect_in_days, occurred_at, title, note, link, contact_id, company_id ON crm_interactions FOR EACH ROW EXECUTE FUNCTION crm_sync_task_from_interaction();
CREATE TRIGGER trg_crm_deals_set_updated_at BEFORE UPDATE ON crm_deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER seed_default_crm_lead_statuses AFTER INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION seed_default_crm_lead_statuses();
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();
