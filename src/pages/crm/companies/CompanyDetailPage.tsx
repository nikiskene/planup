// src/pages/crm/companies/CompanyDetailPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Pencil, UserPlus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import type { CompanyRow } from './types';
import { useCompanyEditor } from './hooks/useCompanyEditor';
import CompanyModal from './components/CompanyModal';

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeWorkspaceId || !id) return;
    setLoading(true);
    const [companyResult, peopleResult] = await Promise.all([
      supabase.from('crm_companies').select('*').eq('workspace_id', activeWorkspaceId).eq('id', id).maybeSingle(),
      supabase.from('crm_contacts').select('id,first_name,last_name,email').eq('workspace_id', activeWorkspaceId).eq('company_id', id).order('last_name'),
    ]);
    if (companyResult.error || peopleResult.error) showToast(companyResult.error?.message || peopleResult.error?.message || 'Failed to load company', 'error');
    setCompany((companyResult.data as CompanyRow | null) || null);
    setPeople((peopleResult.data as Person[]) || []);
    setLoading(false);
  }, [activeWorkspaceId, id, showToast]);

  useEffect(() => { load(); }, [load]);
  const editor = useCompanyEditor(activeWorkspaceId, showToast, load);
  const personName = (person: Person) => [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || 'Unnamed person';

  if (loading) return <div className="mx-auto max-w-4xl text-gray-600">Loading company…</div>;
  if (!company) return <div className="mx-auto max-w-4xl"><button onClick={() => navigate('/crm/companies')} className="text-blue-700 hover:underline">Back to companies</button><p className="mt-4 text-gray-700">Company not found.</p></div>;

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => navigate('/crm/companies')} className="mb-5 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft size={16} /> Back to Leads</button>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1><p className="mt-1 text-sm text-gray-600">Company details and associated people</p></div>
          <button onClick={() => editor.openEdit(company)} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"><Pencil size={16} /> Edit company</button>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          {company.website_url ? <a href={company.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline">Website <ExternalLink size={14} /></a> : null}
          {company.linkedin_url ? <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline">LinkedIn <ExternalLink size={14} /></a> : null}
          {company.notes ? <p className="whitespace-pre-wrap text-gray-700">{company.notes}</p> : <p className="text-gray-500">No company notes yet.</p>}
        </div>
      </div>
      <section className="mt-5 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">People at {company.name}</h2><p className="text-sm text-gray-600">{people.length} associated {people.length === 1 ? 'person' : 'people'}</p></div>
          <Link to="/crm/contacts" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"><UserPlus size={16} /> Add or assign person</Link></div>
        <div className="mt-4 divide-y divide-gray-200">
          {people.length ? people.map((person) => <Link key={person.id} to={`/crm/contacts/${person.id}`} className="block py-3 hover:bg-gray-50"><div className="font-medium text-gray-900">{personName(person)}</div>{person.email ? <div className="text-sm text-gray-600">{person.email}</div> : null}</Link>) : <p className="py-4 text-sm text-gray-500">No people are assigned to this company yet.</p>}
        </div>
      </section>
      <CompanyModal title="Edit company" open={Boolean(editor.editing)} busy={editor.busy} onClose={editor.close} onSubmit={editor.save} {...editor.formProps} submitLabel="Save changes" />
    </div>
  );
}
