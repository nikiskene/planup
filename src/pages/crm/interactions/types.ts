export type InteractionRow = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;

  occurred_at: string | null; // timestamptz
  channel: string | null;

  title: string | null;
  type: string | null;

  note: string | null;
  next_action: string | null;
  reconnect_in_days: number | null;

  link: string | null;

  created_by: string | null;
  created_at: string;
};

export type ContactOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type CompanyOption = {
  id: string;
  name: string;
};

export function contactLabel(c: ContactOption) {
  const n = `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim();
  return n || c.email || 'Unnamed contact';
}