// Optional per-sender enrichment: SMTP copies do not necessarily expose other
// BCC recipients. Never call this before checking the workspace's sender list.
export async function sentEmail(payload: Record<string, unknown>, sender: string, config: {
  tenant: string; client: string; secret: string;
}, request: typeof fetch = fetch): Promise<Record<string, unknown>> {
  const headers = Array.isArray(payload.Headers) ? payload.Headers as { Name?: string; Value?: string }[] : [];
  const messageId = headers.find(h => h.Name?.toLowerCase() === 'message-id')?.Value?.trim();
  if (!messageId || !config.tenant || !config.client || !config.secret) throw new Error('Sent-mail configuration unavailable');
  const tokenResponse = await request(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.client, client_secret: config.secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error('Sent-mail authentication unavailable');
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error('Sent-mail authentication unavailable');
  const query = new URLSearchParams({ '$top': '100', '$orderby': 'sentDateTime desc',
    '$select': 'subject,toRecipients,ccRecipients,bccRecipients,sentDateTime,bodyPreview,internetMessageId' });
  const originalResponse = await request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/mailFolders/sentitems/messages?${query}`, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
  });
  if (!originalResponse.ok) throw new Error('Sent-mail lookup unavailable');
  type Recipient = { emailAddress?: { name?: string; address?: string } };
  type Original = { internetMessageId?: string; subject?: string; sentDateTime?: string; bodyPreview?: string;
    toRecipients?: Recipient[]; ccRecipients?: Recipient[]; bccRecipients?: Recipient[] };
  const data = await originalResponse.json() as { value?: Original[] };
  const original = data.value?.find(message => message.internetMessageId === messageId);
  // Let Postmark retry if the sent item is not visible yet; do not silently drop BCCs.
  if (!original) throw new Error('Sent email not available yet');
  const addresses = (list?: Recipient[]) => (list || []).map(r => ({ Email: r.emailAddress?.address, Name: r.emailAddress?.name }));
  return { ...payload, ToFull: addresses(original.toRecipients), CcFull: addresses(original.ccRecipients),
    BccFull: addresses(original.bccRecipients), Subject: original.subject || payload.Subject,
    Date: original.sentDateTime || payload.Date, TextBody: payload.TextBody || original.bodyPreview || '' };
}
