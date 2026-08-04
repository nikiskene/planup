import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type DealContactRow = {
  id: string;
  workspace_id: string;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;

  lead_status: string | null;
  is_active: boolean;

  associated_deal_id: string | null;

  created_at: string;
  updated_at: string;
};

type ReturnShape = {
  contacts: DealContactRow[];
  loading: boolean;
  reload: () => Promise<void>;
};

export function useDealContacts(
  activeWorkspaceId: string | null | undefined,
  dealId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
): ReturnShape {
  const [contacts, setContacts] = useState<DealContactRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId || !dealId) {
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
          first_name,
          last_name,
          email,
          phone,
          linkedin_url,
          lead_status,
          is_active,
          associated_deal_id,
          created_at,
          updated_at
        `
        )
        .eq('workspace_id', activeWorkspaceId)
        .eq('associated_deal_id', dealId)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setContacts((data || []) as DealContactRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load deal contacts', 'error');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, dealId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { contacts, loading, reload };
}

export default useDealContacts;