import { describe, it, expect, vi } from 'vitest';
import { createBilling, validatePrice, verifySignature, type Config } from './billing';
const config: Config = { supabaseUrl: 'https://db.example', anonKey: 'anon', serviceKey: 'server-only', stripeKey: 'sk_live_example', webhookSecret: 'whsec_example', appUrl: 'https://wrxs.cc', enabled: true, live: true };
const workspace = '11111111-1111-4111-8111-111111111111';
const user = '22222222-2222-4222-8222-222222222222';
const catalog = { billing_interval: 'month', amount_cents: 400, currency: 'usd', stripe_price_id: 'price_month', stripe_product_id: 'prod_month', checkout_enabled: true };
const price = { id: 'price_month', active: true, livemode: true, currency: 'usd', unit_amount: 400, type: 'recurring', product: { id: 'prod_month', active: true }, recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } };
const account = { workspace_id: workspace, billing_user_id: user, stripe_customer_id: 'cus_owner', operation_token: 'lease', checkout_key: 'attempt', checkout_expires_at: new Date(Date.now() + 3600000).toISOString(), checkout_session_id: null, checkout_interval: 'month' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const post = (action: string, extra = {}) => new Request('https://db.example/functions/v1/wrxs-billing', { method: 'POST', headers: { Authorization: 'Bearer user-token', Origin: 'https://wrxs.cc' }, body: JSON.stringify({ action, workspace_id: workspace, ...extra }) });
async function signature(raw: string, time = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${time}.${raw}`));
  return `t=${time},v1=${Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, '0')).join('')}`;
}
describe('Stripe boundaries', () => {
  it('accepts exact live recurring pricing and rejects wrong amount, product, interval, or mode', () => {
    expect(() => validatePrice(price, catalog, true)).not.toThrow();
    for (const patch of [{ unit_amount: 40 }, { product: 'prod_other' }, { livemode: false }, { recurring: { ...price.recurring, interval: 'year' } }, { active: false }]) expect(() => validatePrice({ ...price, ...patch }, catalog, true)).toThrow();
  });
  it('verifies raw signatures and rejects stale, changed and malformed requests', async () => {
    const raw = '{"id":"evt_a"}';
    const header = await signature(raw);
    expect(await verifySignature(raw, header, config.webhookSecret)).toBe(true);
    expect(await verifySignature(raw + ' ', header, config.webhookSecret)).toBe(false);
    expect(await verifySignature(raw, await signature(raw, Math.floor(Date.now() / 1000) - 301), config.webhookSecret)).toBe(false);
    expect(await verifySignature(raw, 't=no,v1=00', config.webhookSecret)).toBe(false);
  });
  it('rejects a disallowed origin before authentication or provider calls', async () => {
    const fetcher = vi.fn();
    const request = new Request(post('checkout'), { headers: { Origin: 'https://attacker.example' } });
    expect((await createBilling(config, fetcher).billing(request)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects a viewer before invoking any billing lock or Stripe call', async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (String(url).endsWith('/auth/v1/user')) return json({ id: user, email_confirmed_at: '2026-01-01' });
      return json([{ role: 'viewer', only_shopping: false, shopping_only: false }]);
    });
    expect((await createBilling(config, fetcher).billing(post('checkout', { billing_interval: 'month' }))).status).toBe(403);
    expect(calls.some(url => url.includes('stripe.com') || url.includes('/rpc/'))).toBe(false);
  });
  it('creates checkout with only server-side catalog, workspace customer, fixed redirects and reusable key', async () => {
    let checkoutBody: URLSearchParams | undefined;
    let idempotency = '';
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/auth/v1/user')) return json({ id: user, email_confirmed_at: '2026-01-01' });
      if (path.includes('/workspace_members?')) return json([{ role: 'admin', only_shopping: false, shopping_only: false }]);
      if (path.endsWith('/rpc/wrxs_billing_lock')) return json({ ...account });
      if (path.includes('/subscriptions?')) return json({ data: [], has_more: false });
      if (path.includes('/wrxs_price_catalog?')) return json([catalog]);
      if (path.includes('/prices/price_month')) return json(price);
      if (path.endsWith('/checkout/sessions')) {
        checkoutBody = new URLSearchParams(String(init?.body));
        idempotency = new Headers(init?.headers).get('Idempotency-Key') || '';
        return json({ id: 'cs_test', url: 'https://checkout.stripe.com/c/pay/session', customer: 'cus_owner' });
      }
      if (path.includes('/rpc/wrxs_billing_')) return json(null);
      throw new Error('Unexpected request ' + path);
    });
    const response = await createBilling(config, fetcher).billing(post('checkout', { billing_interval: 'month', price_id: 'price_attacker', customer: 'cus_attacker', success_url: 'https://attacker.example' }));
    expect(response.status).toBe(200);
    expect(checkoutBody?.get('line_items[0][price]')).toBe('price_month');
    expect(checkoutBody?.get('customer')).toBe('cus_owner');
    expect(checkoutBody?.get('success_url')).toBe('https://wrxs.cc/settings?billing=success');
    expect(idempotency).toBe(`wrxs-checkout:${workspace}:attempt`);
  });
  it('does not trust unsigned webhook events or perform writes', async () => {
    const fetcher = vi.fn();
    const response = await createBilling(config, fetcher).webhook(new Request('https://example.com', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { status: 'canceled', paid: true, access: null },
    { status: 'active', paid: false, access: null },
    { status: 'active', paid: true, access: new Date(2000000000 * 1000).toISOString() },
  ])('reconciles current status $status with paid=$paid rather than old event data', async ({ status, paid, access }) => {
    const raw = JSON.stringify({ id: 'evt_old', type: 'customer.subscription.updated', created: 1, livemode: true, data: { object: { customer: 'cus_owner', status: 'active' } } });
    const saves: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/wrxs_billing_accounts?')) return json([account]);
      if (path.includes('/wrxs_billing_events?')) return json([]);
      if (path.endsWith('/wrxs_billing_lock')) return json(account);
      if (path.includes('/subscriptions?')) return json({ has_more: false, data: [{ id: 'sub_owner', customer: 'cus_owner', metadata: { wrxs_workspace_id: workspace }, status, latest_invoice: { status: paid ? 'paid' : 'open', paid }, current_period_end: 2000000000, items: { data: [{ price, quantity: 1 }] }, cancel_at_period_end: false }] });
      if (path.includes('/wrxs_price_catalog?')) return json([catalog]);
      if (path.endsWith('/wrxs_billing_save')) { saves.push(JSON.parse(String(init?.body))); return json(null); }
      if (path.endsWith('/wrxs_billing_unlock')) return json(null);
      throw new Error('Unexpected request ' + path);
    });
    const response = await createBilling(config, fetcher).webhook(new Request('https://example.com', { method: 'POST', headers: { 'Stripe-Signature': await signature(raw) }, body: raw }));
    expect(response.status).toBe(200);
    expect(saves[0].p_subscription).toMatchObject({ status, access_until: access });
    expect(saves[1].p_event).toMatchObject({ id: 'evt_old' });
  });
});
