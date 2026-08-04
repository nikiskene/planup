export function sanitizeUrl(v: string) {
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
}

export function companyTitle(c: { name?: string | null; website_url?: string | null } | null) {
  if (!c) return 'Company';
  return (c.name || '').trim() || c.website_url || 'Unnamed company';
}