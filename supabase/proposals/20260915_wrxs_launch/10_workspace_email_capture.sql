-- WRXS / wrxs.cc — Stage 10. Run manually after 09_enable_checkout.sql.
-- Adds a capture-only alias system. It does not change the legacy crm@iacy.com path.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- No routes were enabled when this foundation was installed. Stop rather than
-- silently changing a live receiving address if that assumption is no longer true.
do $$ begin
  if exists (select 1 from public.wrxs_email_routes where enabled) then
    raise exception 'An enabled email route already exists. Stop and migrate it explicitly.';
  end if;
end $$;

alter table public.wrxs_email_routes
  drop constraint if exists wrxs_email_routes_domain_check,
  drop constraint if exists wrxs_email_routes_local_part_check;
alter table public.wrxs_email_routes
  alter column local_part drop default,
  alter column domain set default 'wrxs.cc';
update public.wrxs_email_routes set domain = 'wrxs.cc' where domain = 'in.wrxs.cc';
-- Stage 03 generated opaque 34-character placeholders. Preserve any inactive
-- placeholders while converting them to the new valid alias format.
update public.wrxs_email_routes
  set local_part = 'legacy-' || substring(local_part from 3 for 20)
  where local_part ~ '^w-[a-f0-9]{32}$';
alter table public.wrxs_email_routes
  add constraint wrxs_email_routes_domain_check check (domain = 'wrxs.cc'),
  add constraint wrxs_email_routes_local_part_check check (local_part ~ '^[a-z0-9][a-z0-9.-]{0,28}[a-z0-9]$');

-- A manager claims an alias through the authenticated Edge Function. Its
-- confirmed wrxs account address is the first permitted BCC sender.
create index if not exists wrxs_email_senders_verified
  on public.wrxs_email_senders(workspace_id, email)
  where verified_at is not null and revoked_at is null;
create index if not exists wrxs_email_routes_enabled
  on public.wrxs_email_routes(local_part)
  where enabled;

comment on table public.wrxs_email_routes is
  'Capture-only wrxs.cc aliases. A row does not create a mailbox, outbound email, or DNS record. The wrxs-email-capture function enables routes only after the inbound provider is configured.';
comment on table public.wrxs_email_senders is
  'Addresses allowed to BCC a workspace capture alias. Initial setup verifies the confirmed wrxs account email; other senders require a future email challenge.';
comment on table public.wrxs_email_deliveries is
  'Provider delivery ledger for workspace capture aliases. It stores delivery status and identifiers, never raw email bodies.';
commit;

select '10 complete: capture-only wrxs.cc route foundation installed; inbound receiving remains off until the provider webhook secret and MX records are configured' as result;
