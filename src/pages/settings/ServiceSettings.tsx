import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';

type Price = { plan_key: string; billing_interval: string; currency: string; amount_cents: number; checkout_enabled: boolean };
type EmailRoute = { local_part: string; domain: string; enabled: boolean; workspace_id: string };
type Subscription = { status: string; billing_interval: string; access_until: string | null; workspace_id: string };
type ReadTable<T extends Record<string, unknown>> = { Row: T; Insert: never; Update: never; Relationships: [] };
type ServiceDatabase = { public: { Tables: {
  wrxs_price_catalog: ReadTable<Price>;
  wrxs_email_routes: ReadTable<EmailRoute>;
  wrxs_subscriptions: ReadTable<Subscription>;
}; Views: Record<string, never>; Functions: Record<string, never> } };
type Runtime = { ready: boolean; can_manage: boolean; has_customer: boolean };
async function billingRequest(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('wrxs-billing', { body });
  if (error) {
    let message = 'Billing is temporarily unavailable. Please try again.';
    if ('context' in error && error.context instanceof Response) {
      try { const result = await error.context.json(); if (typeof result.error === 'string') message = result.error; } catch { /* Use the safe fallback. */ }
    }
    throw new Error(message);
  }
  return data;
}
const client = supabase as unknown as SupabaseClient<ServiceDatabase>;

export default function ServiceSettings() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const [prices, setPrices] = useState<Price[]>([]);
  const [routes, setRoutes] = useState<EmailRoute[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [busy, setBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';
  async function manage(action: 'checkout' | 'portal' | 'refresh', interval?: string) {
    if (!activeWorkspaceId || busy) return;
    setBusy(true); setBillingError('');
    try {
      const result = await billingRequest({ action, workspace_id: activeWorkspaceId, ...(interval ? { billing_interval: interval } : {}) });
      if (action === 'refresh') { setAttempt(value => value + 1); }
      else {
        const url = new URL(result.url);
        if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('Invalid billing destination.');
        window.location.assign(url.href);
      }
    } catch (cause) { setBillingError(cause instanceof Error ? cause.message : 'Unable to open billing.'); }
    finally { setBusy(false); }
  }
  const canManage = membership?.role === 'admin' || membership?.role === 'owner' || Boolean(membership?.can_manage_members);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(''); setRoutes([]); setSubscriptions([]); setRuntime(null);
    async function load() {
      if (!activeWorkspaceId) return;
      try {
        const priceResult = await client.from('wrxs_price_catalog').select('plan_key,billing_interval,currency,amount_cents,checkout_enabled').eq('plan_key', 'standard').order('amount_cents');
        if (priceResult.error) throw priceResult.error;
        if (!cancelled) setPrices(priceResult.data);
        if (isAdmin) {
          try {
            const status = await billingRequest({ action: 'status', workspace_id: activeWorkspaceId });
            if (!cancelled) setRuntime(status as Runtime);
          } catch { if (!cancelled) setBillingError('Unable to check billing availability. Try refreshing these settings.'); }
        }
        if (canManage) {
          const [emailResult, subscriptionResult] = await Promise.all([
            client.from('wrxs_email_routes').select('local_part,domain,enabled,workspace_id').eq('workspace_id', activeWorkspaceId),
            client.from('wrxs_subscriptions').select('status,billing_interval,access_until,workspace_id').eq('workspace_id', activeWorkspaceId),
          ]);
          if (emailResult.error) throw emailResult.error;
          if (subscriptionResult.error) throw subscriptionResult.error;
          if (!cancelled) { setRoutes(emailResult.data); setSubscriptions(subscriptionResult.data); }
        }
      } catch { if (!cancelled) setError('Unable to load service settings. Check your connection and try again.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, canManage, isAdmin, attempt]);
  return <section className="rounded-2xl border border-gray-200 bg-white p-6">
    <h2 className="text-lg font-semibold text-gray-950">Your wrxs services</h2>
    {loading ? <p role="status" className="mt-4 text-sm text-gray-500">Loading service settings…</p> : error ? <div className="mt-4"><p role="alert" className="text-sm text-red-700">{error}</p><button onClick={() => setAttempt(value => value + 1)} className="mt-3 text-sm text-blue-700">Try again</button></div> : <div className="mt-5 space-y-6 text-sm leading-6">
      <div><h3 className="font-medium">Subscription</h3>
        <p className="mt-1 text-gray-600">{prices.map(price => `${new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency.toUpperCase(), maximumFractionDigits: 0 }).format(price.amount_cents / 100)} USD / ${price.billing_interval}`).join(' · ') || 'Pricing is not available yet.'}</p>
        {subscriptions.length > 0 && <ul className="mt-2">{subscriptions.map((subscription, index) => <li key={index}>{subscription.billing_interval === 'year' ? 'Annual' : 'Monthly'} subscription: {subscription.status}{subscription.access_until ? ` · Access until ${new Date(subscription.access_until).toLocaleDateString()}` : ''}</li>)}</ul>}
        {new URLSearchParams(window.location.search).get('billing') === 'success' && <p role="status" className="mt-3 text-blue-700">You returned from Stripe. Your subscription is confirmed only after Stripe’s payment status has been checked. Use Refresh subscription status if the update has not arrived yet.</p>}
        {new URLSearchParams(window.location.search).get('billing') === 'cancelled' && <p className="mt-3 text-gray-500">Checkout was closed. You can try again when ready.</p>}
        {!isAdmin ? <p className="mt-2 text-gray-500">Ask your workspace administrator to manage billing.</p> : !runtime?.ready ? <p className="mt-2 text-gray-500">Subscription checkout is being prepared. Payments are not active here yet.</p> : !runtime.can_manage ? <p className="mt-2 text-gray-500">The billing owner manages this workspace’s subscription.</p> : <div className="mt-4 flex flex-wrap gap-3">
          {!subscriptions.some(subscription => !['canceled', 'incomplete_expired'].includes(subscription.status)) && prices.filter(price => price.checkout_enabled).map(price => <button key={price.billing_interval} disabled={busy} onClick={() => manage('checkout', price.billing_interval)} className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Please wait…' : price.billing_interval === 'month' ? 'Subscribe · $4/month' : 'Subscribe · $40/year'}</button>)}
          {runtime.has_customer && <><button disabled={busy} onClick={() => manage('portal')} className="rounded-xl border px-4 py-2 disabled:opacity-50">Manage subscription</button><button disabled={busy} onClick={() => manage('refresh')} className="rounded-xl border px-4 py-2 disabled:opacity-50">Refresh subscription status</button></>}
          <p className="w-full text-xs text-gray-500">One subscription covers this workspace. Payment and subscription management open securely at Stripe.</p>
        </div>}
        {billingError && <div className="mt-3"><p role="alert" className="text-red-700">{billingError}</p><button onClick={() => { setBillingError(''); setAttempt(value => value + 1); }} className="text-blue-700">Refresh settings</button></div>}
      </div>
      <div><h3 className="font-medium">Email capture</h3>
        {!canManage ? <p className="mt-1 text-gray-500">Ask a workspace manager about your email connection.</p> : routes.some(route => route.enabled) ? <ul className="mt-2">{routes.filter(route => route.enabled).map(route => <li key={`${route.local_part}@${route.domain}`}><span className="break-all font-medium">{route.local_part}@{route.domain}</span></li>)}</ul> : <p className="mt-1 text-gray-500">No new wrxs email address is enabled for this workspace. Existing email connections continue through their current setup. Personal Gmail connection is not available yet.</p>}
      </div>
    </div>}
  </section>;
}
