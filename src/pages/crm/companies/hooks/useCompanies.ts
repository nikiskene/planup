import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { CompanyRow } from '../types';

export function useCompanies(activeWorkspaceId: string | null | undefined, showToast: (m: string, t?: any) => void) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    if (!activeWorkspaceId) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_companies')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setCompanies((data || []) as CompanyRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load companies', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return { companies, loading, fetchCompanies };
}