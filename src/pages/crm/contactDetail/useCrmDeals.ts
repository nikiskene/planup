import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type DealRow = {
  id: string;
  workspace_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
  capacity: number | null;
  details: string | null;
};

export function useCrmDeals(
  activeWorkspaceId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) {
      setDeals([]);
      setLoadingDeals(false);
      return;
    }

    setLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, workspace_id, name, start_date, end_date, value, capacity, details')
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setDeals((data || []) as DealRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load deals', 'error');
    } finally {
      setLoadingDeals(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { deals, loadingDeals, reload };
}