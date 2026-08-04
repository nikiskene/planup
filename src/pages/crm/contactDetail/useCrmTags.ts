import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type CrmTagRow = { id: string; name: string };

export function useCrmTags(
  activeWorkspaceId: string | null | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [allTags, setAllTags] = useState<CrmTagRow[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const reloadAllTags = useCallback(async () => {
    if (!activeWorkspaceId) {
      setAllTags([]);
      setLoadingTags(false);
      return;
    }

    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('crm_tags')
        .select('id,name')
        .eq('workspace_id', activeWorkspaceId)
        .order('name', { ascending: true })
        .limit(500);

      if (error) throw error;
      setAllTags((data || []) as CrmTagRow[]);
    } catch (err: any) {
      console.error(err);
      setAllTags([]);
      showToast(err?.message || 'Failed to load tags', 'error');
    } finally {
      setLoadingTags(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    reloadAllTags();
  }, [reloadAllTags]);

  return { allTags, loadingTags, reloadAllTags };
}