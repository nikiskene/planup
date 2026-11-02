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

## Production state — 2026-11-02

- `niki@wrxs.cc` is the enabled capture route for the existing Niki workspace;
  verified sender is `ns@iacy.com`, with `microsoft_sent` enrichment enabled.
- Migration `20261030190000` is applied and recorded. The replacement handler
  is deployed as version 9.
- The legacy `crm-inbound-email` function was deleted on November 2. Its endpoint
  now returns 404 and it is absent from the deployed-function list.
- Postmark's former server 20168451 (named `inactive Server`) has an empty inbound
  webhook and empty inbound domain. WRXS uses server 20951605 instead.
- The October 31 `WRXS cutover test` successfully traversed Postmark, Microsoft
  Sent Items enrichment, and the new database transaction. It was addressed only
  to `niki@wrxs.cc`, with empty Cc/Bcc lists. Zero contacts/interactions was the
  correct result: capture addresses are excluded. This was not a capture failure.
- A final test with a real non-capture recipient was requested to verify live
  interaction and follow-up creation. Awaiting that email at the time of this update.
- Historical contacts, interactions, ingestion ledgers and tasks are retained.
  No mailbox or historical Postmark server was deleted. Microsoft Graph credentials
  remain necessary for Sent Items enrichment. External mailbox forwarding settings
  have not been inspected or changed; the old Postmark server cannot call WRXS.

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
- Public DNS verified: `wrxs.cc` MX points to `inbound.postmarkapp.com`.
- Live hosting verified: `/assets/index-BBUjth93.js` is published and contains no
  `crm@iacy.com` prompt.
- Live mail transport and legacy backend retirement are verified. The final
  non-capture-recipient test remains pending; do not claim that test passed yet.
