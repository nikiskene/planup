import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CompanyOption, ContactOption } from './types';

export function useCrmInteractionOptions(
  activeWorkspaceId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeWorkspaceId) {
        setLoadingOptions(false);
        return;
      }

      setLoadingOptions(true);
      try {
        const [cRes, coRes] = await Promise.all([
          supabase
            .from('crm_contacts')
            .select('id,first_name,last_name,email')
            .eq('workspace_id', activeWorkspaceId)
            .order('updated_at', { ascending: false })
            .limit(500),
          supabase
            .from('crm_companies')
            .select('id,name')
            .eq('workspace_id', activeWorkspaceId)
            .order('name', { ascending: true })
            .limit(500),
        ]);

        if (cRes.error) throw cRes.error;
        if (coRes.error) throw coRes.error;

        if (!cancelled) {
          setContacts((cRes.data || []) as ContactOption[]);
          setCompanies((coRes.data || []) as CompanyOption[]);
        }
      } catch (err: any) {
        console.error(err);
        showToast(err?.message || 'Failed to load CRM options', 'error');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, showToast]);

  return { contacts, companies, loadingOptions };
}