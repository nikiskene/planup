// src/pages/crm/contactDetail/CompanyField.tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import type { CompanyRow } from './types';

type Props = {
  companies: CompanyRow[];
  value: string;
  onChange: (value: string) => void;
};

export default function CompanyField({ companies: initial, value, onChange }: Props) {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const [companies, setCompanies] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setCompanies(initial), [initial]);

  const createCompany = async () => {
    const trimmed = name.trim();
    if (!activeWorkspaceId || !trimmed) return;
    setSaving(true);
    try {
      // @ts-expect-error crm tables are not present in the generated database types yet.
      const { data, error } = await supabase.from('crm_companies').insert({ workspace_id: activeWorkspaceId, name: trimmed })
        .select('id,name')
        .single();
      if (error) throw error;
      const created = data as unknown as CompanyRow;
      setCompanies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setName('');
      setCreating(false);
      showToast('Company created and assigned', 'success');
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : 'Failed to create company', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-gray-700">Company</label>
        <button type="button" onClick={() => setCreating((open) => !open)} className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
          <Plus size={14} /> Create company
        </button>
      </div>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">None</option>
        {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
      {creating ? (
        <div className="mt-2 flex gap-2">
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Company name" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="button" disabled={saving || !name.trim()} onClick={createCompany} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      ) : null}
    </div>
  );
}
