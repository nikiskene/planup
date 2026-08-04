// src/pages/crm/contacts/useCrmContacts.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

type CompanyRow = { id: string; name: string };
type DealRow = { id: string; name: string | null };

export type LeadStatus = 'connected' | 'bad_timing' | 'in_progress';

export type ContactRow = {
  id: string;
  workspace_id: string;

  company_id: string | null;
  associated_deal_id: string | null;

  lead_status: LeadStatus | null;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;

  // NEW
  is_active: boolean;

  created_at: string;
  updated_at: string;

  company?: CompanyRow | null;
  deal?: DealRow | null;
};

type ReturnShape = {
  contacts: ContactRow[];
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Contacts list hook (workspace-isolated).
 * Exports BOTH a named and a default export to prevent import mismatches.
 */
export function useCrmContacts(
  activeWorkspaceId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
): ReturnShape {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select(
          `
          id,
          workspace_id,
          company_id,
          associated_deal_id,
          lead_status,
          first_name,
          last_name,
          email,
          linkedin_url,
          phone,
          is_active,
          created_at,
          updated_at,
          company:crm_companies ( id, name ),
          deal:crm_deals!crm_contacts_associated_deal_id_fkey ( id, name )
        `
        )
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setContacts((data || []) as ContactRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load contacts', 'error');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { contacts, loading, reload };
}

// default export (so `import useCrmContacts from ...` works)
export default useCrmContacts;