// src/pages/crm/companies/hooks/useCompanyEditor.ts
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { CompanyRow } from '../types';
import { sanitizeUrl } from '../utils';

export function useCompanyEditor(workspaceId: string | null | undefined, showToast: (message: string, type?: 'error' | 'success' | 'info') => void, reload: () => Promise<void>) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [notes, setNotes] = useState('');
  const reset = () => { setName(''); setWebsiteUrl(''); setLinkedinUrl(''); setNotes(''); };
  const close = () => { setShowNew(false); setEditing(null); reset(); };
  const openNew = () => { reset(); setShowNew(true); };
  const openEdit = (company: CompanyRow) => {
    setEditing(company); setName(company.name || ''); setWebsiteUrl(company.website_url || '');
    setLinkedinUrl(company.linkedin_url || ''); setNotes(company.notes || '');
  };
  const values = () => ({ name: name.trim(), website_url: sanitizeUrl(websiteUrl), linkedin_url: sanitizeUrl(linkedinUrl), notes: notes.trim() || null });
  const valid = () => name.trim() ? true : (showToast('Name is required', 'error'), false);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); if (!workspaceId || !valid()) return; setBusy(true);
    try {
      // @ts-expect-error crm tables are not present in the generated database types yet.
      const { error } = await supabase.from('crm_companies').insert({ workspace_id: workspaceId, ...values() });
      if (error) throw error; showToast('Company created', 'success'); close(); await reload();
    } catch (error: unknown) { showToast(error instanceof Error ? error.message : 'Failed to create company', 'error'); } finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!workspaceId || !editing || !valid()) return; setBusy(true);
    try {
      // @ts-expect-error crm tables are not present in the generated database types yet.
      const { error } = await supabase.from('crm_companies').update(values()).eq('workspace_id', workspaceId).eq('id', editing.id);
      if (error) throw error; showToast('Company updated', 'success'); close(); await reload();
    } catch (error: unknown) { showToast(error instanceof Error ? error.message : 'Failed to update company', 'error'); } finally { setBusy(false); }
  };
  const remove = async (company: CompanyRow) => {
    if (!confirm(`Delete "${company.name}"?\n\nThis may fail while people still reference this company.`)) return;
    const { error } = await supabase.from('crm_companies').delete().eq('workspace_id', company.workspace_id).eq('id', company.id);
    if (error) showToast(error.message || 'Failed to delete company', 'error');
    else { showToast('Company deleted', 'success'); await reload(); }
  };
  return { showNew, editing, busy, openNew, openEdit, close, create, save, remove,
    formProps: { name, setName, websiteUrl, setWebsiteUrl, linkedinUrl, setLinkedinUrl, notes, setNotes } };
}
