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
  created_at: string;
  updated_at: string;
  company?: CompanyRow | null; // joined
};

export type TagRow = { id: string; name: string };