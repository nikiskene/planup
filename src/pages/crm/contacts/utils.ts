import type { ContactRow, UiStatus } from './types';

export function fullName(c: ContactRow) {
  const first = (c.first_name || '').trim();
  const last = (c.last_name || '').trim();
  const name = `${first} ${last}`.trim();
  return name || c.email || 'Unnamed contact';
}

export function sanitizeUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
}

export function nameColorClass(uiStatus?: UiStatus) {
  // RED = disconnect, GREEN = open task, BLUE = no task
  if (uiStatus === 'disconnect') return 'text-red-700';
  if (uiStatus === 'open_task') return 'text-green-700';
  return 'text-blue-700';
}