import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CompanyRow } from './types';

export function useCrmCompanies(activeWorkspaceId: string | null | undefined, showToast: (m: string, t?: any) => void) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const loadCompanies = useCallback(async () => {
    if (!activeWorkspaceId) return;

    setLoadingCompanies(true);
    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .select('id,name')
        .eq('workspace_id', activeWorkspaceId)
        .order('name', { ascending: true })
        .limit(500);

      if (error) throw error;
      setCompanies((data || []) as CompanyRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load companies', 'error');
    } finally {
      setLoadingCompanies(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  return { companies, loadingCompanies, reloadCompanies: loadCompanies };
}