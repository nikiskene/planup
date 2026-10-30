import { sentEmail } from '../_shared/sent-email.ts';
import { captureMessage, cleanEmail } from '../_shared/email-capture.ts';
type Json = Record<string, unknown>;
type Route = { id: string; workspace_id: string; created_by: string; local_part: string; domain: string; enabled: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALIAS = /^[a-z0-9][a-z0-9.-]{0,28}[a-z0-9]$/;
const RESERVED = new Set(['admin', 'api', 'billing', 'contact', 'hello', 'legal', 'mail', 'noreply', 'privacy', 'support', 'team', 'wrxs']);
const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const inboundToken = Deno.env.get('WRXS_POSTMARK_INBOUND_TOKEN') || '';
const captureEnabled = Deno.env.get('WRXS_EMAIL_CAPTURE_ENABLED') === 'true';

function response(body: Json, status = 200, origin?: string | null) {
  const allowed = new Set(['https://wrxs.cc', 'https://iacy.netlify.app']);
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(origin && allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {}) } });
}
async function rest<T>(path: string, init: RequestInit = {}, service = true): Promise<T> {
  const key = service ? serviceKey : anonKey;
  const r = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`database_${r.status}`);
  const text = await r.text(); return (text ? JSON.parse(text) : null) as T;
}
async function authenticated(req: Request, workspace: string) {
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('unauthorized');
  const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('unauthorized');
  const user = await r.json() as { id?: string; email?: string; email_confirmed_at?: string };
  if (!user.id || !user.email_confirmed_at || !cleanEmail(user.email)) throw new Error('confirm_email');
  const members = await rest<{ role: string; only_shopping: boolean; shopping_only: boolean }[]>(`workspace_members?workspace_id=eq.${workspace}&user_id=eq.${user.id}&select=role,only_shopping,shopping_only`);
  if (!members[0] || !['owner', 'admin'].includes(members[0].role) || members[0].only_shopping || members[0].shopping_only) throw new Error('forbidden');
  return { id: user.id, email: cleanEmail(user.email) };
}
async function configure(req: Request, body: Json, origin: string | null) {
  const workspace = typeof body.workspace_id === 'string' ? body.workspace_id : '';
  const alias = typeof body.alias === 'string' ? body.alias.trim().toLowerCase() : '';
  if (!UUID.test(workspace) || !ALIAS.test(alias) || RESERVED.has(alias)) return response({ error: 'Choose a unique ID using 2–30 lowercase letters, numbers, dots or hyphens.' }, 400, origin);
  try {
    const user = await authenticated(req, workspace);
    const existing = await rest<Route[]>(`wrxs_email_routes?workspace_id=eq.${workspace}&select=id,workspace_id,created_by,local_part,domain,enabled`);
    const collision = await rest<Route[]>(`wrxs_email_routes?local_part=eq.${encodeURIComponent(alias)}&select=id,workspace_id,created_by,local_part,domain,enabled`);
    if (collision[0] && collision[0].workspace_id !== workspace) return response({ error: 'That wrxs ID is unavailable. Choose another one.' }, 409, origin);
    let route = existing[0];
    if (route) {
      await rest(`wrxs_email_routes?id=eq.${route.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ local_part: alias, domain: 'wrxs.cc', enabled: captureEnabled }) });
    } else {
      const rows = await rest<Route[]>('wrxs_email_routes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id: workspace, created_by: user.id, local_part: alias, domain: 'wrxs.cc', enabled: captureEnabled }) }); route = rows[0];
    }
    const previousSender = await rest<{ capture_source: string }[]>(`wrxs_email_senders?workspace_id=eq.${workspace}&email=eq.${encodeURIComponent(user.email)}&select=capture_source`);
    await rest('wrxs_email_senders?on_conflict=workspace_id,email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ workspace_id: workspace, user_id: user.id, email: user.email, verified_at: new Date().toISOString(), verification_method: 'confirmed_account', revoked_at: null, capture_source: previousSender[0]?.capture_source || 'postmark' }) });
    return response({ address: `${alias}@wrxs.cc`, enabled: captureEnabled, setup_required: !captureEnabled }, 200, origin);
  } catch (e) { const code = e instanceof Error ? e.message : ''; return response({ error: code === 'confirm_email' ? 'Confirm your wrxs account email first.' : code === 'forbidden' ? 'Workspace administrator required.' : 'Unable to save this wrxs ID.' }, code === 'unauthorized' ? 401 : code === 'forbidden' ? 403 : 503, origin); }
}
async function inbound(req: Request) {
  const supplied = req.headers.get('Authorization') === `Bearer ${inboundToken}` || new URL(req.url).searchParams.get('token') === inboundToken;
  if (!inboundToken || !supplied) return response({ error: 'Unauthorized.' }, 401);
  let payload: Json; try { payload = await req.json(); } catch { return response({ error: 'Invalid provider payload.' }, 400); }
  if (!captureEnabled) return response({ error: 'Capture temporarily unavailable.' }, 503);
  try {
    let message = await captureMessage(payload);
    if (!message) return response({ received: true, ignored: true });
    const [local] = message.recipient.split('@');
    const routes = await rest<Route[]>(`wrxs_email_routes?local_part=eq.${encodeURIComponent(local)}&domain=eq.wrxs.cc&enabled=eq.true&select=id,workspace_id,created_by,local_part,domain,enabled`);
    const route = routes[0];
    if (!route) return response({ received: true, ignored: true });
    const senders = await rest<{ capture_source: string }[]>(`wrxs_email_senders?workspace_id=eq.${route.workspace_id}&email=eq.${encodeURIComponent(message.sender)}&verified_at=not.is.null&revoked_at=is.null&select=capture_source`);
    if (!senders[0]) return response({ received: true, ignored: true });
    if (senders[0].capture_source === 'microsoft_sent') {
      const enriched = await sentEmail(payload, message.sender, {
        tenant: Deno.env.get('MS_GRAPH_TENANT_ID') || '', client: Deno.env.get('MS_GRAPH_CLIENT_ID') || '',
        secret: Deno.env.get('MS_GRAPH_CLIENT_SECRET') || '',
      });
      // Preserve the already-resolved SMTP destination when enriching headers.
      message = await captureMessage({ ...enriched, OriginalRecipient: message.recipient });
      if (!message) return response({ error: 'Invalid sent email.' }, 503);
    }
    // One database transaction covers delivery, contacts and interactions. A
    // failed write rolls back the claim, so provider retries can safely recover.
    const result = await rest<Json>('rpc/wrxs_capture_email', {
      method: 'POST', body: JSON.stringify({ p_message: message }),
    });
    return response(result);
  } catch { return response({ error: 'Temporary ingestion failure.' }, 503); }
}
Deno.serve(async req => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return response({}, 200, origin);
  if (req.method !== 'POST') return response({ error: 'POST required.' }, 405, origin);
  const auth = req.headers.get('Authorization') || '';
  if (inboundToken && (auth === `Bearer ${inboundToken}` || new URL(req.url).searchParams.get('token') === inboundToken)) return inbound(req);
  let body: Json; try { body = await req.json(); } catch { return response({ error: 'Invalid request.' }, 400, origin); }
  return configure(req, body, origin);
});
