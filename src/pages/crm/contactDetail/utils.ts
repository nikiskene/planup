import type { ContactRow } from './types';

export function contactTitle(c: ContactRow | null) {
  if (!c) return 'Contact';
  const first = (c.first_name || '').trim();
  const last = (c.last_name || '').trim();
  const name = `${first} ${last}`.trim();
  return name || c.email || 'Unnamed contact';
}