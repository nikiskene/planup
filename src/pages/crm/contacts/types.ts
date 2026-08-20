// src/pages/crm/contacts/types.ts
export type UiStatus = 'disconnect' | 'open_task' | 'no_task';
export type LeadStatus = string;

export type ContactRow = {
  id: string;
  workspace_id: string;

  company_id: string | null;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;

  is_active: boolean;

  lead_status: LeadStatus | null;
  associated_deal_id: string | null;

  created_at: string;
  updated_at: string;

  ui_status?: UiStatus;
};
