# wrxs billing services

The frontend deploys through GitHub → Netlify. These two payment handlers deploy separately to the existing Supabase project. The legacy `crm-inbound-email` function is not modified.

## Manual setup order

1. Run `../proposals/20260915_wrxs_launch/07_billing_runtime.sql` in Supabase SQL Editor after stages 05/06. It adds service-only per-workspace billing locks and guarded persistence; it does not enable payments or change application access.
2. Deploy only `wrxs-billing` and `wrxs-stripe-webhook`. The browser handler verifies the bearer token against Supabase Auth, then checks admin/owner membership and the designated billing owner. The webhook verifies Stripe's raw-body signature with a five-minute tolerance. Gateway JWT verification is deliberately off because authentication is performed in each handler.
3. In Supabase Edge Functions → Secrets, set `STRIPE_SECRET_KEY` from the intended Stripe account's live secret key. Never put it in a `VITE_` variable, source control, a browser, or SQL. Built-in `SUPABASE_*` credentials are provided by Supabase.
4. In the same Stripe account, create a webhook destination:
   `https://zvdraynveyfktpfmoetv.supabase.co/functions/v1/wrxs-stripe-webhook`
   Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`.
   Store the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` in Supabase Secrets.
5. Activate/configure Stripe's customer portal for invoices, payment-method updates and cancellation. Do not permit switching to unrelated products/prices. This release offers monthly/yearly selection at initial checkout; an open checkout must expire before choosing the other period. Configure cancellation at period end if that is the intended commercial policy.
6. `WRXS_APP_URL` defaults to `https://wrxs.cc`. Leave `WRXS_BILLING_ENABLED` unset or `false` during setup. It must be `true` AND the relevant catalog `checkout_enabled` row must be true to open checkout. These are intentionally separate gates. Do not change either gate just because the SQL succeeded.
7. Verify with a dedicated Stripe test environment, then verify the supplied production prices against Stripe, confirm billing scope/taxes/cancellation terms and the treatment of existing workspaces. Run an authorized checkout/webhook/portal walkthrough before public paid launch. Do not make a real charge as an automated test without explicit authorization.

## Behavior and boundaries

- One subscription covers one workspace; the first administrator to begin checkout becomes its billing owner. Only that billing owner, while still an administrator, can open payment/portal sessions. Other administrators can read status. Billing-owner transfer is not included in this release.
- Prices, customer identity, quantity, redirects and metadata come from server configuration and database records. Client-supplied prices, customers and success URLs are ignored.
- Live price/product, active state, currency, exact amount and recurring period are checked before checkout. Requests use Stripe API version `2024-06-20` and card payments.
- A per-workspace database lease serializes checkout and webhook reconciliation. Persisted attempt IDs reuse Stripe idempotency keys. Existing pending sessions are returned rather than creating a second checkout; existing nonterminal subscriptions block another purchase.
- Webhooks fetch current subscriptions from Stripe under the lease. Out-of-order events never overwrite state with their old payloads. Duplicates are acknowledged; transient failures return a retryable failure. Unsupported events and customers outside this app are ignored. Subscription records are only granted a paid-through timestamp when active with a paid latest invoice.
- Full Stripe event bodies, cards and payment details are not stored. API responses and secrets are not logged or returned to clients.
- Stripe status writes do not yet enforce a paid-access wall on application data. Existing users remain able to use their workspaces. A reviewed grandfathering/access policy and corresponding database permissions remain necessary before a paid-only public launch.
- The existing personal email importer is still tied to Niki's workspace/profile and mailbox. Personal business data is workspace-scoped; the email importer has not yet been generalized into per-account provider configuration. Credentials must remain server secrets, never profile fields.

## Verification

`npm test` includes shared billing-handler tests. The isolated database validation under `supabase/proposals/20260915_wrxs_launch/validation` checks the SQL, reruns, role restrictions, leases and customer immutability. `npx deno check` validates deployed entrypoints. These checks do not claim a live charge, confirmed delivery, or authenticated browser walkthrough.
