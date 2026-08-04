import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { InteractionRow } from './types';

export function useCrmInteractions(
  activeWorkspaceId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [interactions, setInteractions] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) {
      setInteractions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_interactions')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('occurred_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setInteractions((data || []) as InteractionRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load interactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { interactions, loading, reload };
}