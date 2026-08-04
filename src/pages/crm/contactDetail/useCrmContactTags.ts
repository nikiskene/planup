import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type ContactTag = { id: string; name: string };

export function useCrmContactTags(
  activeWorkspaceId: string | null | undefined,
  contactId: string | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const reloadTags = useCallback(async () => {
    if (!activeWorkspaceId || !contactId) {
      setTags([]);
      setLoadingTags(false);
      return;
    }

    setLoadingTags(true);
    try {
      const { data, error } = await supabase
        .from('crm_contact_tags')
        .select(
          `
          tag:crm_tags (
            id,
            name
          )
        `
        )
        .eq('workspace_id', activeWorkspaceId)
        .eq('contact_id', contactId);

      if (error) throw error;

      const list =
        (data || [])
          .map((r: any) => r?.tag)
          .filter(Boolean)
          .map((t: any) => ({ id: t.id as string, name: t.name as string })) || [];

      list.sort((a, b) => a.name.localeCompare(b.name));
      setTags(list);
    } catch (err: any) {
      console.error(err);
      setTags([]);
      showToast(err?.message || 'Failed to load contact tags', 'error');
    } finally {
      setLoadingTags(false);
    }
  }, [activeWorkspaceId, contactId, showToast]);

  useEffect(() => {
    reloadTags();
  }, [reloadTags]);

  return { tags, loadingTags, reloadTags };
}