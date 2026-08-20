// src/pages/crm/useLeadStatuses.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export type LeadStatusOption = { id: string; key: string; name: string; is_system: boolean; sort_order: number };

export function useLeadStatuses(workspaceId: string | null | undefined, showToast: (message: string, type?: 'success' | 'error' | 'info') => void) {
  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const reloadStatuses = useCallback(async () => {
    if (!workspaceId) { setStatuses([]); setLoadingStatuses(false); return; }
    setLoadingStatuses(true);
    const { data, error } = await supabase.from('crm_lead_statuses').select('id,key,name,is_system,sort_order')
      .eq('workspace_id', workspaceId).order('sort_order').order('name');
    if (error) { setStatuses([]); showToast(error.message || 'Failed to load relationship statuses', 'error'); }
    else setStatuses((data || []) as unknown as LeadStatusOption[]);
    setLoadingStatuses(false);
  }, [workspaceId, showToast]);
  useEffect(() => { reloadStatuses(); }, [reloadStatuses]);
  return { statuses, loadingStatuses, reloadStatuses };
}
