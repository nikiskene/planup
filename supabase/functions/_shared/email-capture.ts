type Address = { Email?: string; Name?: string };
type Payload = Record<string, unknown>;
export function cleanEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
function addresses(value: unknown): Address[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Address[] : [];
}
export async function captureMessage(payload: Payload) {
  const sender = cleanEmail((payload.FromFull as Address | undefined)?.Email || payload.From);
  const recipient = [payload.OriginalRecipient, ...addresses(payload.BccFull).map(a => a.Email),
    ...addresses(payload.ToFull).map(a => a.Email), ...addresses(payload.CcFull).map(a => a.Email), payload.To]
    .map(cleanEmail).find(email => email.endsWith('@wrxs.cc')) || '';
  if (!sender || !recipient) return null;
  const people = [...addresses(payload.ToFull), ...addresses(payload.CcFull), ...addresses(payload.BccFull)]
    .map(person => ({ email: cleanEmail(person.Email), name: typeof person.Name === 'string' ? person.Name.slice(0, 300) : '' }))
    .filter(person => person.email && person.email !== sender && !person.email.endsWith('@wrxs.cc'));
  const headers = Array.isArray(payload.Headers) ? payload.Headers as { Name?: string; Value?: string }[] : [];
  const originalId = headers.find(h => h.Name?.toLowerCase() === 'message-id')?.Value?.trim();
  const providerId = typeof payload.MessageID === 'string' ? payload.MessageID.trim() : '';
  const subject = typeof payload.Subject === 'string' ? payload.Subject.trim().slice(0, 500) || '(No subject)' : '(No subject)';
  const text = typeof payload.TextBody === 'string' ? payload.TextBody.trim().slice(0, 12000) : '';
  const unique = [...new Map(people.map(person => [person.email, person])).values()];
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ recipient, sender, subject, date: payload.Date, text, people: unique })));
  const fallback = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  return { recipient, sender, event_id: (providerId || originalId || fallback).slice(0, 500),
    message_id: (originalId || providerId || fallback).slice(0, 500), subject, text, people: unique,
    occurred_at: typeof payload.Date === 'string' && Number.isFinite(Date.parse(payload.Date)) ? new Date(payload.Date).toISOString() : new Date().toISOString() };
}
