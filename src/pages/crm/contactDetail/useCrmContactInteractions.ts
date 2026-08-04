import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type ContactInteractionRow = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  occurred_at: string | null;

  channel: any | null; // enum in DB; treat as string-ish in UI
  type: string | null;

  title: string | null;
  note: string | null;

  next_action: any | null; // enum
  reconnect_in_days: number | null;

  link: string | null;

  created_at: string;
  updated_at: string;

  company?: { id: string; name: string } | null; // joined
};

export function useCrmContactInteractions(
  activeWorkspaceId: string | null | undefined,
  contactId: string | undefined,
  showToast: (msg: string, type?: any) => void
) {
  const [interactions, setInteractions] = useState<ContactInteractionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeWorkspaceId || !contactId) {
      setInteractions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_interactions')
        .select(
          `
          *,
          company:crm_companies (
            id,
            name
          )
        `
        )
        .eq('workspace_id', activeWorkspaceId)
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setInteractions((data || []) as ContactInteractionRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load interactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, contactId, showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { interactions, loading, reload };
}