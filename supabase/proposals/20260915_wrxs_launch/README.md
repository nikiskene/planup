# WRXS web launch — Supabase first

Confirmed name/domain: **wrxs / wrxs.cc**.
Confirmed subscription prices: **USD 4 per month / USD 40 per year**.
Billing model assumption: one subscription per workspace, as recommended in the discussion. Member limits, tax-inclusive/exclusive presentation, trial terms and the treatment of the existing workspaces remain decisions for the billing rollout.

The landing page will use neutral branding, a full explanation of the existing tools, and the neutral background image the user will supply as a Supabase URL. No iOS work is included.

## Status and execution boundary

These scripts are prepared for **the user to run manually** in the existing Supabase project, `zvdraynveyfktpfmoetv` (PlanUp). The assistant has executed read-only live schema checks, but has **not applied these changes**. This describes the original preparation boundary; see the applied status and web release notes at the end of this document.

The package is a database foundation, not a claim that billing, new email addresses, invitations or account deletion are already functional. Their trusted backend handlers, web screens and external provider setup follow this stage.

## How to run

Open the project's SQL Editor. Run the entire contents of each numbered file, separately, in order. Never run the files in `validation/` against Supabase; those use synthetic users and a disposable local database.

1. **00_preflight.sql** — read only. Save the single JSON result. Required columns and supported_postgres must be true; all 12 orphan counts must be zero. Stage 3 should not already be installed. Stop and share the result if a condition differs. The live read-only check on 2026-09-15 passed, with two workspaces and no inconsistent shopping flags.
2. **01_account_security.sql** — tighten account and workspace access. Transactional and rerunnable.
3. **02_workspace_links.sql** — enforce same-workspace references and repair legacy views. Transactional and rerunnable. Stops if it finds existing links it cannot safely preserve.
4. **03_subscription_email_foundation.sql** — create new protected tables and the public USD price records. Run once. If it reports an existing table, stop rather than replacing the table. It creates no subscriptions, access grants, addresses or invitations and activates no charging.
5. **04_verify.sql** — read-only postflight. Expected boundary policy count: 15. Expected new workspace-link constraint count: 12. New private tables must have RLS=true, browser_can_insert=false and anonymous_can_read=false. Prices must be USD 400 cents/month and 4000 cents/year with checkout_enabled=false. Routes, subscriptions and invitations should initially be zero. Both repaired views must plan successfully.

Each change file wraps all work in a transaction. If any statement fails, do not proceed to the next file. If the SQL Editor keeps a failed transaction open, run `ROLLBACK;` before retrying. Do not remove failing constraints or permission checks to force a success.

Keep a current database backup before applying. These scripts do not delete or move business data. After a successful commit, any rollback should be reviewed against the new state; automatically restoring the old broad profile policy would reopen the privacy issue.

## What changes

### 01 — account security

- Profiles become readable only by their owner and full members of a shared workspace. Normal users can update their own full name; they cannot edit profile email/identity directly. Signup's existing server-side profile trigger continues to operate.
- Full workspace members can see collaborators. Shopping-only members see their own membership/profile.
- New **restrictive** policies are AND-combined with existing policies, so an old permissive rule cannot bypass the added workspace or role gate. Both legacy shopping flags are checked.
- Task author/editor permissions and category/dues/booking management permissions are enforced. General viewers cannot write.
- Normal updates cannot rewrite record identity or move a record into another workspace. Null creator fields in older CRM forms are filled from the signed-in identity; explicitly forged creators are rejected.
- Existing privileged membership and CRM RPCs receive equivalent guards. An obsolete `open` task enum in crm_log_interaction is corrected to the existing `next` enum.
- Existing shopping-specific policies and the current service-role email ingestion remain in place. Nothing is added to the signup or payment flow yet.

Behavioral change to expect: users who were previously able to edit another person's tasks through a broad policy now need their existing edit-others permission. Categories, dues and bookings now respect their existing management flags. These changes should be checked with real collaborator accounts after application.

### 02 — workspace links and legacy view repair

- Twelve optional record references must target records in the same workspace, including CRM relationships, note/task links and shopping lists. Existing data is validated before constraints are added.
- Two existing composite foreign keys are repaired so deleting a category/company clears only the optional link, never the owning workspace ID.
- Live inspection confirmed `shopping_item_suggestions` refers to itself and fails with infinite recursion. `crm_contacts_with_tags` also has a self-referencing definition. Both are rebuilt from underlying workspace-owned tables with caller permissions enforced.
- Shopping suggestions retain the existing RPC signature and require the caller's shopping-read permission.

### 03 — inactive service foundations

- `wrxs_price_catalog`: public prices, one plan, two intervals. Real Stripe price IDs are initially empty and checkout is disabled.
- `wrxs_billing_accounts`, `wrxs_subscriptions`, `wrxs_billing_events`: workspace/customer mapping, subscription state, deduplicated event tracking. Only trusted backend code can write them. One nonterminal subscription per workspace prevents overlapping subscriptions.
- `wrxs_access_grants`: optional, expiring trial/founder/support access. No grants are inserted. There is no hardcoded Niki bypass.
- `wrxs_has_active_access`: checks membership plus a current subscription/grant. **It is not attached to existing feature policies yet.** Payment enforcement must ship with working Checkout, verified webhooks, cancellation/recovery, an offline-access policy and an explicit decision for existing workspaces.
- `wrxs_email_routes`, `wrxs_email_senders`, `wrxs_email_deliveries`: workspace addresses under `in.wrxs.cc`, verified senders and retry/deduplication state. No mailbox credentials or email bodies are stored in these new tables. The current crm@iacy.com processor is not modified.
- `wrxs_workspace_invitations`: hashed expiring invitation tokens. Only the backend may create or accept invitations. The application must verify the confirmed recipient email and inviter's current authority, and accept each invite atomically.
- `wrxs_account_requests`: export/deletion requests. No automatic deletion occurs; billing, workspace ownership, shared records and retention must be handled by the later workflow.

## Supabase settings that are NOT SQL

Do not treat the SQL package as a replacement for these dashboard/infrastructure changes:

- Connect `wrxs.cc` to Netlify and publish the new landing page first. The current live Supabase site URL and allowed redirects still use the old Bolt hostname. Update them to the actual deployed wrxs origin and implemented auth callback/reset paths during the web release, retaining the existing working origin during transition.
- Configure a production transactional email sender, authenticated sending domain, confirmation/reset templates and appropriate abuse protection. Current live configuration has no custom SMTP and an email rate limit of 2/hour. Signups require confirmation, but the web confirmation/resend/reset flow still needs work.
- Create the real Stripe product and USD monthly/annual prices in the chosen account. Deploy Checkout, customer portal and a signature-verified webhook handler. The handler must authorize workspace billing, reconcile current Stripe state, process events idempotently and handle out-of-order/retried delivery before enabling checkout.
- Configure inbound mail routing for `in.wrxs.cc` with the selected receiving provider. Deploy a receiver that verifies the provider request and actual sender authentication; a From header alone is insufficient. Resolve the destination server-side and verify the sender's current workspace membership. Then provision and enable routes. Merely inserting a row does not create a receiving email address.
- Keep service keys and provider secrets in backend secret storage. Never place them in web environment variables or SQL copied into the browser client.

## Validation completed locally

A disposable PGlite PostgreSQL environment reconstructs the inspected public schema, functions, grants, constraints and triggers. The two broken legacy views use typed empty shells during reconstruction and are replaced by stage 2; this limitation is explicit in the test setup. No live customer rows are copied into tests.

Local checks cover script execution, stage 1/2 reruns, owner/collaborator/viewer/shopping-only behavior, profile and task/view isolation, creator protection, task permissions, cross-workspace references, paid-access denial/expiry, public prices, subscription uniqueness, default-disabled email routes, legacy service-role email follow-up creation, and category/company deletion without losing workspace ownership.

This does not replace live postflight, authenticated browser testing, provider delivery tests, load testing or a backup restore test. The web app's existing offline account separation, signup recovery, branding and deployment still need the next implementation stage.

Reproduce locally from `validation/`: `npm install`, then `npm test`. This test dependency is isolated from the application package.

## Applied and verified — 2026-09-15

The user executed stages 00–04 successfully. A subsequent independent, read-only run of `04_verify.sql` confirmed profile privacy, 15 workspace boundaries, 12 relationship constraints, all nine private tables protected, and USD 4/month and USD 40/year catalog entries. Checkout remains disabled; subscriptions, invitations and active wrxs email routes remain zero.

The accompanying web release adds the neutral wrxs public page, email-confirmation/resend and password-reset screens, read-only service settings, and account-separated local workspace/offline storage. Existing legacy unowned cache entries are retained but not displayed; old pending mutations remain recoverable by their recorded author. Each account needs one online workspace refresh after this upgrade. No iOS work or live email-handler changes are included.

### Setup still required before opening paid public access

1. Attach `wrxs.cc` to the existing Netlify site and configure its domain/DNS certificate. The existing `iacy.netlify.app` release remains the verified deployment target until this is done.
2. In Supabase Authentication URL Configuration, replace the old Bolt Site URL with the intended active site. Allow the deployed `/auth/callback` and `/auth/reset-password` URLs explicitly. While using Netlify, those are `https://iacy.netlify.app/auth/callback` and `https://iacy.netlify.app/auth/reset-password`; add the corresponding `https://wrxs.cc/...` URLs when the domain serves this app. Configure production SMTP and test confirmation, resend and recovery delivery. The new web flow uses Supabase's standard ConfirmationURL email links and implicit callback handling.
3. Create Stripe recurring USD prices ($4 monthly, $40 yearly), then implement/deploy authenticated checkout, billing portal and signature-verified webhook reconciliation. Set price IDs and enable checkout only after those flows pass. Current database foundations and website prices do not charge users or enforce subscription access. Existing workspace access is preserved.
4. Choose and configure an inbound mail provider for `in.wrxs.cc`; implement signed webhook routing, verified senders, deduplication and per-workspace delivery handling. Keep the existing `crm-inbound-email` integration operational until its replacement is tested. A domain purchase alone does not create private mailbox hosting.
5. Finish invitation acceptance and account export/deletion handlers. Confirm the legal operator, privacy/terms, support contact, billing scope, tax handling and existing-workspace access treatment before public paid launch. Do not advertise these unfinished flows as available.
6. The supplied public Supabase female/male backgrounds alternate every 12 seconds on the public and sign-in screens. Reduced-motion preferences disable the rotation. The supplied negative logo appears on dark backgrounds.
7. Run authenticated multi-account checks for fresh signup, workspace creation, viewer/contributor/shopping-only roles, QR save/reopen, notes/tasks, account switching and offline recovery. Automated browser review was unavailable in this environment; unit/build/database checks do not replace that walkthrough.

Reference for email confirmation and recovery: https://supabase.com/docs/guides/auth/passwords
