// src/pages/crm/companies/CompaniesPage.tsx
import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import { useCompanies } from './hooks/useCompanies';
import { useCompanyEditor } from './hooks/useCompanyEditor';
import CompanyRowItem from './components/CompanyRowItem';
import CompanyModal from './components/CompanyModal';

export default function CompaniesPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { companies, loading, fetchCompanies } = useCompanies(activeWorkspaceId, showToast);
  const editor = useCompanyEditor(activeWorkspaceId, showToast, fetchCompanies);
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((company) => [company.name, company.website_url, company.linkedin_url]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [companies, query]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 className="text-2xl font-semibold text-gray-900">Companies</h2>
          <p className="mt-1 text-sm text-gray-600">Edit company details and see everyone associated with each company.</p></div>
        <button onClick={editor.openNew} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800"><Plus size={18} /> New company</button>
      </div>
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4"><div className="flex items-center gap-2">
        <Search size={18} className="text-gray-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, website, LinkedIn…" className="w-full px-2 py-2 text-sm focus:outline-none" />
        {query.trim() ? <button type="button" onClick={() => setQuery('')} className="rounded-lg p-2 hover:bg-gray-100" title="Clear"><X size={16} className="text-gray-500" /></button> : null}
      </div></div>
      {loading ? <div className="text-gray-600">Loading companies…</div> : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">No companies yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="divide-y divide-gray-200">
          {filtered.map((company) => <CompanyRowItem key={company.id} company={company} onOpen={() => navigate(`/crm/companies/${company.id}`)} openMenu={openMenuId === company.id}
            onToggleMenu={() => setOpenMenuId((value) => value === company.id ? null : company.id)} onCloseMenu={() => setOpenMenuId(null)}
            onEdit={() => { setOpenMenuId(null); editor.openEdit(company); }} onDelete={() => { setOpenMenuId(null); editor.remove(company); }} />)}
        </div></div>
      )}
      <CompanyModal title="New company" open={editor.showNew} busy={editor.busy} onClose={editor.close} onSubmit={editor.create} {...editor.formProps} submitLabel="Create company" />
      <CompanyModal title="Edit company" open={Boolean(editor.editing)} busy={editor.busy} onClose={editor.close} onSubmit={editor.save} {...editor.formProps} submitLabel="Save changes" />
    </div>
  );
}
