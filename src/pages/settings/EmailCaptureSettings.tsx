import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';

type EmailRoute = { local_part: string; domain: string; enabled: boolean; workspace_id: string };
type ReadTable<T extends Record<string, unknown>> = { Row: T; Insert: never; Update: never; Relationships: [] };
type ServiceDatabase = { public: { Tables: { wrxs_email_routes: ReadTable<EmailRoute> }; Views: Record<string, never>; Functions: Record<string, never> } };
const client = supabase as unknown as SupabaseClient<ServiceDatabase>;

async function emailRequest(body: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('wrxs-email-capture', { body });
  if (error) {
    let message = 'Unable to save this wrxs ID. Please try again.';
    if ('context' in error && error.context instanceof Response) {
      try { const result = await error.context.json(); if (typeof result.error === 'string') message = result.error; } catch { /* Use the safe fallback. */ }
    }
    throw new Error(message);
  }
  return data as { address: string; enabled: boolean };
}

export default function EmailCaptureSettings() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const canManage = membership?.role === 'admin' || membership?.role === 'owner' || Boolean(membership?.can_manage_members);
  const [routes, setRoutes] = useState<EmailRoute[]>([]);
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      if (!activeWorkspaceId || !canManage) { if (!cancelled) { setRoutes([]); setLoading(false); } return; }
      const { data, error: failure } = await client.from('wrxs_email_routes').select('local_part,domain,enabled,workspace_id').eq('workspace_id', activeWorkspaceId);
      if (cancelled) return;
      if (failure) setError('Unable to load email capture settings. Try again.'); else setRoutes(data);
      setLoading(false);
    }
    void load(); return () => { cancelled = true; };
  }, [activeWorkspaceId, canManage, refresh]);
  async function claim(event: FormEvent) {
    event.preventDefault();
    if (!activeWorkspaceId || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await emailRequest({ workspace_id: activeWorkspaceId, alias });
      setAlias(result.address.replace('@wrxs.cc', ''));
      setNotice(result.enabled ? `${result.address} is ready for BCC capture.` : `${result.address} is reserved for this workspace.`);
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this wrxs ID.'); }
    finally { setBusy(false); }
  }
  const route = routes[0];
  return <section className="rounded-lg border border-gray-200 bg-white p-6">
    <h2 className="text-lg font-semibold text-gray-900">Email capture</h2>
    {!canManage ? <p className="mt-2 text-sm text-gray-500">Ask a workspace manager about this workspace’s capture address.</p> : loading ? <p className="mt-2 text-sm text-gray-500">Loading email capture settings…</p> : <>
      {route && <p className="mt-2 text-sm text-gray-700"><span className="break-all font-medium">{route.local_part}@{route.domain}</span>{route.enabled ? ' is ready for BCC capture.' : ' is reserved and awaiting activation.'}</p>}
      <p className="mt-2 text-sm leading-6 text-gray-500">Choose a short, permanent wrxs ID. BCC it from your confirmed wrxs account email to add recipients and email history to this workspace’s CRM. It cannot send or receive ordinary correspondence.</p>
      <form onSubmit={claim} className="mt-3 flex max-w-lg flex-wrap gap-2">
        <label className="sr-only" htmlFor="wrxs-email-id">wrxs email ID</label>
        <div className="flex min-w-0 flex-1 rounded-xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-slate-900"><input id="wrxs-email-id" value={alias} onChange={event => setAlias(event.target.value.toLowerCase())} placeholder="your-name" maxLength={30} pattern="[a-z0-9][a-z0-9.-]{0,28}[a-z0-9]" required className="min-w-0 flex-1 rounded-l-xl px-3 py-2 outline-none" /><span className="rounded-r-xl bg-gray-50 px-3 py-2 text-gray-500">@wrxs.cc</span></div>
        <button disabled={busy} className="rounded-xl border border-slate-950 px-4 py-2 font-medium disabled:opacity-50">{busy ? 'Saving…' : route ? 'Change ID' : 'Reserve ID'}</button>
      </form>
      <p className="mt-2 text-xs text-gray-500">Use lowercase letters, numbers, dots and hyphens. IDs such as support and billing are reserved.</p>
      {notice && <p role="status" className="mt-2 text-sm text-blue-700">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </>}
  </section>;
}
