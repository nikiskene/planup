// src/pages/crm/contactDetail/useCrmContact.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type CompanyRow = { id: string; name: string };
export type DealRow = { id: string; name: string | null };

export type LeadStatus = 'connected' | 'bad_timing' | 'in_progress';

export type ContactRow = {
  id: string;
  workspace_id: string;

  company_id: string | null;
  associated_deal_id: string | null;

  lead_status: LeadStatus | null;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;

  created_at: string;
  updated_at: string;

  company?: CompanyRow | null;
  deal?: DealRow | null;
};

type Params = {
  activeWorkspaceId: string | null | undefined;
  id: string | undefined;
  showToast: (msg: string, type?: any) => void;
  onNotFound?: () => void;
};

export function useCrmContact({ activeWorkspaceId, id, showToast, onNotFound }: Params) {
  const canLoad = useMemo(() => Boolean(activeWorkspaceId && id), [activeWorkspaceId, id]);

  const showToastRef = useRef(showToast);
  const onNotFoundRef = useRef(onNotFound);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    onNotFoundRef.current = onNotFound;
  }, [onNotFound]);

  const [loadingContact, setLoadingContact] = useState(true);
  const [contact, setContact] = useState<ContactRow | null>(null);

  // form fields
  const [companyId, setCompanyId] = useState('');
  const [associatedDealId, setAssociatedDealId] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus | ''>('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [phone, setPhone] = useState('');

  const hydrateForm = useCallback((c: ContactRow) => {
    setCompanyId(c.company_id || '');
    setAssociatedDealId(c.associated_deal_id || '');
    setLeadStatus((c.lead_status as LeadStatus) || '');

    setFirstName(c.first_name || '');
    setLastName(c.last_name || '');
    setEmail(c.email || '');
    setLinkedinUrl(c.linkedin_url || '');
    setPhone(c.phone || '');
  }, []);

  const load = useCallback(async () => {
    if (!activeWorkspaceId || !id) {
      setContact(null);
      setLoadingContact(false);
      return;
    }

    setLoadingContact(true);
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select(
          `
          id,
          workspace_id,
          company_id,
          associated_deal_id,
          lead_status,
          first_name,
          last_name,
          email,
          linkedin_url,
          phone,
          created_at,
          updated_at,
          company:crm_companies (
            id,
            name
          ),
          deal:crm_deals!crm_contacts_associated_deal_id_fkey (
            id,
            name
          )
        `
        )
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setContact(null);
        showToastRef.current?.('Contact not found', 'error');
        onNotFoundRef.current?.();
        return;
      }

      const c = data as ContactRow;
      setContact(c);
      hydrateForm(c);
    } catch (err: any) {
      console.error(err);
      setContact(null);
      showToastRef.current?.(err?.message || 'Failed to load contact', 'error');
    } finally {
      setLoadingContact(false);
    }
  }, [activeWorkspaceId, id, hydrateForm]);

  useEffect(() => {
    if (!canLoad) {
      setLoadingContact(false);
      setContact(null);
      return;
    }
    load();
  }, [canLoad, load]);

  return {
    loadingContact,
    contact,
    reloadContact: load,

    companyId,
    setCompanyId,

    associatedDealId,
    setAssociatedDealId,

    leadStatus,
    setLeadStatus,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    linkedinUrl,
    setLinkedinUrl,
    phone,
    setPhone,
  };
}