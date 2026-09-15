export type Config = { supabaseUrl: string; anonKey: string; serviceKey: string; stripeKey: string; webhookSecret: string; appUrl: string; enabled: boolean; live: boolean };
type Json = Record<string, unknown>;
type Account = { workspace_id: string; billing_user_id: string; stripe_customer_id: string | null; operation_token: string; checkout_key: string | null; checkout_session_id: string | null; checkout_expires_at: string | null; checkout_interval: string | null };
type Catalog = { billing_interval: string; amount_cents: number; currency: string; stripe_price_id: string; stripe_product_id: string; checkout_enabled: boolean };
type Price = { id: string; active: boolean; livemode: boolean; currency: string; unit_amount: number; type: string; product: string | { id: string; active: boolean }; recurring: { interval: string; interval_count: number; usage_type: string } | null };
type Subscription = { id: string; customer: string; status: string; metadata: Record<string, string>; current_period_end: number; latest_invoice?: string | { status: string; paid: boolean } | null; cancel_at_period_end: boolean; items: { data: { price: Price; quantity: number }[] } };
type Checkout = { id: string; subscription?: string | null; url: string | null; status: string; customer: string; expires_at: number };
export class BillingError extends Error { constructor(public status: number, message: string) { super(message); } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const terminal = (status: string) => ['canceled', 'incomplete_expired'].includes(status);

export function validatePrice(price: Price, catalog: Catalog, live: boolean, requireActive = true) {
  const productId = typeof price.product === 'string' ? price.product : price.product.id;
  if (price.id !== catalog.stripe_price_id || productId !== catalog.stripe_product_id || price.livemode !== live ||
    price.currency !== 'usd' || price.currency !== catalog.currency || price.unit_amount !== catalog.amount_cents ||
    price.type !== 'recurring' || price.recurring?.interval !== catalog.billing_interval || price.recurring.interval_count !== 1 || price.recurring.usage_type !== 'licensed' ||
    (requireActive && (!price.active || (typeof price.product !== 'string' && !price.product.active)))) {
    throw new BillingError(409, 'Stripe price does not match the configured plan.');
  }
}

export async function verifySignature(raw: string, header: string, secret: string, now = Date.now()) {
  const parts = header.split(',').map(part => part.trim().split('='));
  const times = parts.filter(([key]) => key === 't');
  const timestamp = times.length === 1 ? Number(times[0][1]) : NaN;
  if (!secret || !Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false;
  const signatures = parts.filter(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value || '')).map(([, value]) => value);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const signature of signatures) {
    const bytes = Uint8Array.from(signature.match(/../g)!.map(byte => parseInt(byte, 16)));
    if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${timestamp}.${raw}`))) return true;
  }
  return false;
}

export function createBilling(config: Config, request = fetch) {
  const base = config.supabaseUrl.replace(/\/$/, '');
  const app = new URL(config.appUrl);
  if (app.protocol !== 'https:' || app.pathname !== '/' || app.search || app.hash || app.username || app.password) throw new Error('Invalid application origin');
  const origins = new Set([app.origin, 'https://iacy.netlify.app', 'https://wrxs.cc']);
  const ready = () => config.enabled && Boolean(config.stripeKey && config.webhookSecret);
  async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
    const response = await request(url, { ...init, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      // Do not return provider bodies, tokens, or customer information to the browser/logs.
      throw new BillingError(response.status === 401 || response.status === 403 ? 403 : 503, 'Billing could not complete this request. Please try again or contact support.');
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  function db<T>(path: string, method = 'GET', body?: unknown) {
    return jsonRequest<T>(`${base}/rest/v1/${path}`, { method, headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  function rpc<T>(name: string, body: Json) { return db<T>(`rpc/${name}`, 'POST', body); }
  async function stripe<T>(path: string, params?: Record<string, string>, idempotency?: string) {
    if (!config.stripeKey || (config.live && !/^(sk|rk)_live_/.test(config.stripeKey))) throw new BillingError(503, 'Production billing is not configured.');
    return jsonRequest<T>(`https://api.stripe.com/v1/${path}`, { method: params ? 'POST' : 'GET', headers: {
      Authorization: `Bearer ${config.stripeKey}`, 'Stripe-Version': '2024-06-20',
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotency ? { 'Idempotency-Key': idempotency } : {}),
    }, ...(params ? { body: new URLSearchParams(params).toString() } : {}) });
  }
  async function save(account: Account, patch: Json = {}, subscription: Json | null = null, event: Json | null = null) {
    await rpc('wrxs_billing_save', { p_workspace: account.workspace_id, p_token: account.operation_token, p_account: patch, p_subscription: subscription, p_event: event });
    Object.assign(account, patch);
  }
  async function unlock(account: Account) {
    try { await rpc('wrxs_billing_unlock', { p_workspace: account.workspace_id, p_token: account.operation_token }); } catch { /* Lease expires automatically; no credentials are logged. */ }
  }
  async function catalog() { return db<Catalog[]>('wrxs_price_catalog?plan_key=eq.standard&select=*'); }
  async function reconcile(account: Account, event: Json | null = null) {
    if (!account.stripe_customer_id) return [];
    const result = await stripe<{ data: Subscription[]; has_more: boolean }>(`subscriptions?customer=${encodeURIComponent(account.stripe_customer_id)}&status=all&limit=100&expand[]=data.latest_invoice`);
    if (result.has_more) throw new BillingError(409, 'Subscription history needs review.');
    const prices = await catalog();
    const subscriptions = result.data;
    for (const subscription of subscriptions) {
      if (subscription.customer !== account.stripe_customer_id || subscription.metadata.wrxs_workspace_id !== account.workspace_id || subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1) throw new BillingError(409, 'Subscription identity needs review.');
      const price = subscription.items.data[0].price;
      const plan = prices.find(row => row.stripe_price_id === price.id);
      if (!plan) throw new BillingError(409, 'Subscription plan needs review.');
      validatePrice(price, plan, config.live, false);
    }
    if (subscriptions.filter(row => !terminal(row.status)).length > 1) throw new BillingError(409, 'Multiple subscriptions need review.');
    // Process terminal records first so a later replacement can satisfy the unique active constraint.
    subscriptions.sort((a, b) => Number(terminal(b.status)) - Number(terminal(a.status)));
    for (const subscription of subscriptions) {
      const price = subscription.items.data[0].price;
      const invoice = subscription.latest_invoice;
      const paid = typeof invoice === 'object' && invoice !== null && invoice.status === 'paid' && invoice.paid;
      const accessUntil = subscription.status === 'active' && paid && Number.isFinite(subscription.current_period_end) ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      await save(account, {}, { id: subscription.id, stripe_price_id: price.id, status: subscription.status, billing_interval: price.recurring!.interval, access_until: accessUntil, cancel_at_period_end: subscription.cancel_at_period_end });
    }
    if (event) await save(account, {}, null, event);
    return subscriptions.filter(row => !terminal(row.status));
  }
  async function authenticate(req: Request, workspace: string) {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw new BillingError(401, 'Please log in again.');
    const user = await jsonRequest<{ id: string; email_confirmed_at?: string }>(`${base}/auth/v1/user`, { headers: { apikey: config.anonKey, Authorization: authorization } });
    if (!user.id || !user.email_confirmed_at) throw new BillingError(403, 'Confirm your email before managing billing.');
    const members = await db<{ role: string; only_shopping: boolean; shopping_only: boolean }[]>(`workspace_members?workspace_id=eq.${workspace}&user_id=eq.${encodeURIComponent(user.id)}&select=role,only_shopping,shopping_only`);
    const member = members[0];
    if (!member || !['owner', 'admin'].includes(member.role) || member.only_shopping || member.shopping_only) throw new BillingError(403, 'Workspace administrator required.');
    return user;
  }
  async function checkout(account: Account, interval: string) {
    const active = await reconcile(account);
    if (active.length) throw new BillingError(409, 'This workspace already has a subscription. Use Manage subscription.');
    const plan = (await catalog()).find(row => row.billing_interval === interval);
    if (!plan?.checkout_enabled || !plan.stripe_price_id) throw new BillingError(409, 'This plan is not open for checkout yet.');
    const price = await stripe<Price>(`prices/${encodeURIComponent(plan.stripe_price_id)}?expand[]=product`);
    validatePrice(price, plan, config.live);
    if (!account.stripe_customer_id) {
      const customer = await stripe<{ id: string }>('customers', { 'metadata[wrxs_workspace_id]': account.workspace_id, 'metadata[wrxs_billing_user_id]': account.billing_user_id }, `wrxs-customer:${account.workspace_id}`);
      await save(account, { stripe_customer_id: customer.id });
    }
    if (account.checkout_session_id) {
      const session = await stripe<Checkout>(`checkout/sessions/${encodeURIComponent(account.checkout_session_id)}`);
      if (session.customer !== account.stripe_customer_id) throw new BillingError(409, 'Checkout identity needs review.');
      if (session.status === 'complete') {
        const subscription = session.subscription ? await stripe<Subscription>(`subscriptions/${encodeURIComponent(session.subscription)}`) : null;
        if (!subscription || subscription.customer !== account.stripe_customer_id || !terminal(subscription.status)) throw new BillingError(409, 'Payment confirmation is processing. Refresh subscription status shortly.');
      }
      if (session.status === 'open') {
        if (interval !== account.checkout_interval) throw new BillingError(409, 'Another billing period has an open checkout. Complete it or wait for it to expire before switching.');
        if (!session.url?.startsWith('https://checkout.stripe.com/')) throw new BillingError(503, 'Checkout URL unavailable.');
        return session.url;
      }
      await save(account, { checkout_key: null, checkout_session_id: null, checkout_expires_at: null, checkout_interval: null });
    }
    // Persist an attempt before calling Stripe. Retries reuse identical parameters and key.
    if (!account.checkout_key || !account.checkout_expires_at || Date.parse(account.checkout_expires_at) <= Date.now()) {
      await save(account, { checkout_key: crypto.randomUUID(), checkout_session_id: null, checkout_interval: interval, checkout_expires_at: new Date(Math.floor(Date.now() / 1000) * 1000 + 3600000).toISOString() });
    }
    if (interval !== account.checkout_interval) throw new BillingError(409, 'A checkout attempt for another billing period is still pending.');
    const session = await stripe<Checkout>('checkout/sessions', {
      mode: 'subscription', 'payment_method_types[0]': 'card', customer: account.stripe_customer_id!, client_reference_id: account.workspace_id,
      'line_items[0][price]': plan.stripe_price_id, 'line_items[0][quantity]': '1',
      'metadata[wrxs_workspace_id]': account.workspace_id, 'subscription_data[metadata][wrxs_workspace_id]': account.workspace_id,
      success_url: `${app.origin}/settings?billing=success`, cancel_url: `${app.origin}/settings?billing=cancelled`,
      expires_at: String(Math.floor(Date.parse(account.checkout_expires_at!) / 1000)),
    }, `wrxs-checkout:${account.workspace_id}:${account.checkout_key}`);
    await save(account, { checkout_session_id: session.id });
    if (!session.url?.startsWith('https://checkout.stripe.com/')) throw new BillingError(503, 'Checkout URL unavailable.');
    return session.url;
  }
  function response(body: unknown, status = 200, origin?: string | null) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(origin && origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {}) } });
  }
  async function billing(req: Request) {
    const origin = req.headers.get('Origin');
    if (origin && !origins.has(origin)) return response({ error: 'Origin not allowed.' }, 403);
    if (req.method === 'OPTIONS') return response({}, 200, origin);
    if (req.method !== 'POST') return response({ error: 'POST required.' }, 405, origin);
    let account: Account | undefined;
    try {
      const raw = await req.text();
      if (raw.length > 4096) throw new BillingError(413, 'Request too large.');
      let body: Json; try { body = JSON.parse(raw); } catch { throw new BillingError(400, 'Invalid request.'); }
      const workspace = typeof body?.workspace_id === 'string' ? body.workspace_id : '';
      if (!UUID.test(workspace) || !['status', 'checkout', 'portal', 'refresh'].includes(String(body.action))) throw new BillingError(400, 'Invalid billing request.');
      const user = await authenticate(req, workspace);
      if (body.action === 'status') {
        const accounts = await db<Account[]>(`wrxs_billing_accounts?workspace_id=eq.${workspace}&select=*`);
        return response({ ready: ready(), can_manage: !accounts[0] || accounts[0].billing_user_id === user.id, has_customer: Boolean(accounts[0]?.stripe_customer_id) }, 200, origin);
      }
      if (!ready()) throw new BillingError(503, 'Billing is not enabled yet.');
      if (body.action === 'checkout' && !['month', 'year'].includes(String(body.billing_interval))) throw new BillingError(400, 'Select a monthly or annual plan.');
      account = await rpc<Account>('wrxs_billing_lock', { p_workspace: workspace, p_user: user.id });
      if (body.action === 'checkout') return response({ url: await checkout(account, String(body.billing_interval)) }, 200, origin);
      if (!account.stripe_customer_id) throw new BillingError(409, 'This workspace has no billing account at Stripe yet.');
      if (body.action === 'refresh') { await reconcile(account); return response({ refreshed: true }, 200, origin); }
      const portal = await stripe<{ url: string }>('billing_portal/sessions', { customer: account.stripe_customer_id, return_url: `${app.origin}/settings` });
      if (!portal.url.startsWith('https://billing.stripe.com/')) throw new BillingError(503, 'Billing portal unavailable.');
      return response({ url: portal.url }, 200, origin);
    } catch (error) {
      return response({ error: error instanceof BillingError ? error.message : 'Billing is temporarily unavailable.' }, error instanceof BillingError ? error.status : 503, origin);
    } finally { if (account) await unlock(account); }
  }
  async function webhook(req: Request) {
    if (req.method !== 'POST') return response({ error: 'POST required.' }, 405);
    let account: Account | undefined;
    try {
      const raw = await req.text();
      if (raw.length > 1048576) return response({ error: 'Request too large.' }, 413);
      if (!config.webhookSecret) return response({ error: 'Webhook not configured.' }, 503);
      if (!await verifySignature(raw, req.headers.get('Stripe-Signature') || '', config.webhookSecret)) return response({ error: 'Invalid signature.' }, 400);
      const event = JSON.parse(raw) as { id: string; type: string; created: number; livemode: boolean; data: { object: { customer?: string } } };
      if (event.livemode !== config.live || !/^evt_[a-zA-Z0-9]+$/.test(event.id) || !Number.isFinite(event.created)) return response({ error: 'Invalid event.' }, 400);
      const supported = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'];
      if (!supported.includes(event.type)) return response({ received: true, ignored: true });
      const customer = event.data.object.customer;
      if (typeof customer !== 'string' || !/^cus_[a-zA-Z0-9]+$/.test(customer)) return response({ error: 'Missing customer.' }, 400);
      const accounts = await db<Account[]>(`wrxs_billing_accounts?stripe_customer_id=eq.${encodeURIComponent(customer)}&select=*`);
      if (!accounts.length) return response({ received: true, ignored: true }); // Another product in the same Stripe account.
      const prior = await db<{ state: string }[]>(`wrxs_billing_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=state`);
      if (prior[0]?.state === 'processed') return response({ received: true });
      account = await rpc<Account>('wrxs_billing_lock', { p_workspace: accounts[0].workspace_id, p_user: null });
      // Read Stripe's current state under a per-workspace lease, never trust arrival order or redirect parameters.
      await reconcile(account, { id: event.id, type: event.type, created: event.created });
      return response({ received: true });
    } catch { return response({ error: 'Reconciliation failed; retry this event.' }, 503); }
    finally { if (account) await unlock(account); }
  }
  return { billing, webhook };
}
