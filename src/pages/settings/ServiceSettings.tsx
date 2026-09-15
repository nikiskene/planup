import { useEffect, useState, type FormEvent } from 'react';
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
async function emailRequest(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('wrxs-email-capture', { body });
  if (error) {
    let message = 'Unable to save this wrxs ID. Please try again.';
    if ('context' in error && error.context instanceof Response) {
      try { const result = await error.context.json(); if (typeof result.error === 'string') message = result.error; } catch { /* Use the safe fallback. */ }
    }
    throw new Error(message);
  }
  return data as { address: string; enabled: boolean; setup_required: boolean };
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
  const [emailAlias, setEmailAlias] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
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
  async function claimEmailId(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId || emailBusy) return;
    setEmailBusy(true); setEmailError(''); setEmailNotice('');
    try {
      const result = await emailRequest({ workspace_id: activeWorkspaceId, alias: emailAlias });
      setEmailAlias(result.address.replace('@wrxs.cc', ''));
      setEmailNotice(`${result.address} is reserved for this workspace. Receiving will switch on after wrxs completes the Postmark connection.`);
      setAttempt(value => value + 1);
    } catch (cause) { setEmailError(cause instanceof Error ? cause.message : 'Unable to save this wrxs ID.'); }
    finally { setEmailBusy(false); }
  }
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
        {!canManage ? <p className="mt-1 text-gray-500">Ask a workspace manager about your email connection.</p> : <>
          {routes.length > 0 && <p className="mt-1 text-gray-700"><span className="break-all font-medium">{routes[0].local_part}@{routes[0].domain}</span>{routes[0].enabled ? ' is ready for BCC capture.' : ' is reserved and awaiting the receiving connection.'}</p>}
          <p className="mt-2 text-gray-500">Choose a short, permanent wrxs ID. This is a capture-only address: BCC it from your confirmed wrxs account email to add recipients and the email history to this workspace’s CRM. It cannot send or receive ordinary correspondence.</p>
          <form onSubmit={claimEmailId} className="mt-3 flex max-w-lg flex-wrap gap-2">
            <label className="sr-only" htmlFor="wrxs-email-id">wrxs email ID</label>
            <div className="flex min-w-0 flex-1 rounded-xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-slate-900"><input id="wrxs-email-id" value={emailAlias} onChange={event => setEmailAlias(event.target.value.toLowerCase())} placeholder="your-name" maxLength={30} pattern="[a-z0-9][a-z0-9.-]{0,28}[a-z0-9]" required className="min-w-0 flex-1 rounded-l-xl px-3 py-2 outline-none" /><span className="rounded-r-xl bg-gray-50 px-3 py-2 text-gray-500">@wrxs.cc</span></div>
            <button disabled={emailBusy} className="rounded-xl border border-slate-950 px-4 py-2 font-medium disabled:opacity-50">{emailBusy ? 'Saving…' : routes.length ? 'Change ID' : 'Reserve ID'}</button>
          </form>
          <p className="mt-2 text-xs text-gray-500">Use lowercase letters, numbers, dots and hyphens. IDs such as support and billing are reserved.</p>
          {emailNotice && <p role="status" className="mt-2 text-blue-700">{emailNotice}</p>}
          {emailError && <p role="alert" className="mt-2 text-red-700">{emailError}</p>}
        </>}
      </div>
    </div>}
  </section>;
}
