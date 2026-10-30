# WRXS email capture

The public capture address is read from `wrxs_email_routes`; it is not a login
address or an ordinary mailbox. Postmark delivers to `wrxs-email-capture` using
the existing inbound token. The handler checks the enabled route and verified,
non-revoked sender before importing anything.

`wrxs_capture_email` performs each delivery in one database transaction. Contact,
interaction, trigger-created follow-up and delivery-ledger changes succeed or
roll back together. Provider retries cannot leave a poisoned claim or duplicate
history. Original Message-ID interaction keys remain compatible with historical
imports. New contacts default to Connected unless a subject rule applies.

Senders default to `capture_source = 'postmark'`. The optional `microsoft_sent`
setting recovers To/Cc/Bcc recipients from the verified sender's Sent Items using
the existing server-only Microsoft Graph credentials. It retains the migrated
sender's automatic follow-up-task behavior. There are no hardcoded mailbox,
workspace or user IDs in the capture implementation. Unavailable Sent Items
return a retryable failure, not silently incomplete history.

## Production state — 2026-10-30

- `niki@wrxs.cc` is enabled for the existing Niki workspace; verified sender is
  `ns@iacy.com`. Before this change, its ledger contained 15 processed deliveries.
- Migration `20261030190000` was applied and recorded in migration history.
- The replacement handler is deployed. Account enrichment remains on the existing
  Postmark mode until the mail-provider cutover can be verified.
- The old receiver is still active pending Postmark sign-in. Do not describe the
  retirement as complete or remove it before the replacement delivery is checked.
- Historical contacts, interactions, ingestion ledgers and tasks are retained.

## Remaining cutover

1. Sign into Postmark and inspect the WRXS inbound server/domain and existing
   legacy webhook. Never expose webhook tokens in screenshots, logs or commits.
2. Verify the WRXS inbound destination and webhook target. Switch this workspace's
   verified sender to `microsoft_sent` to preserve its old full-BCC/follow-up behavior.
3. Have the user send a test from their verified address, BCCing the WRXS address,
   with known To/Cc and another BCC recipient. Verify delivery, contacts, history,
   subject rules and follow-ups in the app; replay must not add duplicates.
4. Remove the legacy mailbox forwarding/provider webhook and delete the retired
   `crm-inbound-email` function. Do not delete the mailbox or historical data.
   Keep Microsoft Graph credentials because sender enrichment still uses them.
5. Verify a subsequent WRXS delivery and update this status.

The downloaded legacy source is backed up outside the repository at
`/Users/iacy/.codex/backups/wrxs-email-20261030/legacy-index.ts` for rollback.

## Validation

- `npm run build`: passed; regenerated stale checked-in assets to remove the old capture-address prompt.
- `npm test`: 66 tests passed, including envelope routing and Sent Items recovery.
- `deno check --unstable supabase/functions/wrxs-email-capture/index.ts`: passed
  with the installed older Deno runtime.
- `supabase/tests/email_capture.sql`, wrapped in BEGIN/ROLLBACK against production:
  verified unauthorized-sender rejection, complete rollback on failure, retry,
  Connected defaults, automatic follow-up, provider and original-message dedupe,
  and service-only RPC permissions. No test records persist.
- Frontend typecheck still reports existing errors in untouched frontend files;
  this change does not alter frontend source or claim those errors are fixed.
- End-to-end mail delivery and legacy retirement remain pending provider access.
