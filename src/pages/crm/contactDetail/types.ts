// src/pages/crm/contactDetail/types.ts
export type CompanyRow = {
  id: string;
  name: string;
};

export type ContactRow = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
  associated_deal_id?: string | null;
  lead_status?: LeadStatus | null;
  created_at: string;
  updated_at: string;
  company?: CompanyRow | null; // joined
  deal?: DealRow | null;
};

export type TagRow = { id: string; name: string };
export type DealRow = { id: string; name: string | null };
export type LeadStatus = 'connected' | 'bad_timing' | 'in_progress';
