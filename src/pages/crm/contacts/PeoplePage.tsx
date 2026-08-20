// src/pages/crm/contacts/PeoplePage.tsx
import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import useCrmContacts from './useCrmContacts';
import ContactsList from './ContactsList';
import ContactModal from './ContactModal';
import type { ContactRow } from './types';
import { fullName, sanitizeUrl } from './utils';
import { useLeadStatuses } from '../useLeadStatuses';

type StatusTab = string;
type ActivityTab = 'active' | 'passive';
type Form = { firstName: string; lastName: string; email: string; linkedinUrl: string; phone: string; isActive: boolean };
const emptyForm: Form = { firstName: '', lastName: '', email: '', linkedinUrl: '', phone: '', isActive: true };
export default function PeoplePage() {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const { contacts, loading, reload } = useCrmContacts(activeWorkspaceId, showToast);
  const { statuses } = useLeadStatuses(activeWorkspaceId, showToast);
  const [statusTab, setStatusTab] = useState<StatusTab>('in_progress');
  const [activityTab, setActivityTab] = useState<ActivityTab>('active');
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const statusTabs = useMemo(() => [...statuses.map((status) => ({ value: status.key, label: status.name })),
    { value: 'unassigned', label: 'Unassigned' }, { value: 'all', label: 'All' }], [statuses]);
  const rows = contacts as unknown as ContactRow[];
  const activityRows = useMemo(() => rows.filter((row) => row.is_active === (activityTab === 'active')), [rows, activityTab]);
  const counts = useMemo(() => Object.fromEntries(statusTabs.map((tab) => [tab.value, activityRows.filter((row) => tab.value === 'all' || (tab.value === 'unassigned' ? !row.lead_status : row.lead_status === tab.value)).length])), [activityRows, statusTabs]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return activityRows.filter((row) => {
      const inStatus = statusTab === 'all' || (statusTab === 'unassigned' ? !row.lead_status : row.lead_status === statusTab);
      const searchable = [fullName(row), row.email, row.phone, row.linkedin_url].filter(Boolean).join(' ').toLowerCase();
      return inStatus && (!term || searchable.includes(term));
    });
  }, [activityRows, query, statusTab]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeWorkspaceId) return;
    const hasIdentifier = [form.firstName, form.lastName, form.email, form.linkedinUrl, form.phone].some((value) => value.trim());
    if (!hasIdentifier) { showToast('Add at least a name, email, LinkedIn, or phone.', 'error'); return; }
    setCreating(true);
    const payload = { workspace_id: activeWorkspaceId, first_name: form.firstName.trim() || null, last_name: form.lastName.trim() || null,
      email: form.email.trim().toLowerCase() || null, linkedin_url: sanitizeUrl(form.linkedinUrl), phone: form.phone.trim() || null, is_active: form.isActive };
    // @ts-expect-error crm tables are not present in the generated database types yet.
    const { data, error } = await supabase.from('crm_contacts').insert(payload).select('id').single();
    setCreating(false);
    if (error) { showToast(error.message || 'Failed to create person', 'error'); return; }
    setShowNew(false); setForm(emptyForm); await reload(); showToast('Person created', 'success');
    const created = data as unknown as { id: string };
    navigate(`/crm/contacts/${created.id}`);
  };

  const remove = async (row: ContactRow) => {
    setOpenMenuId(null);
    if (!activeWorkspaceId || !confirm(`Delete “${fullName(row)}”?`)) return;
    const { error } = await supabase.from('crm_contacts').delete().eq('workspace_id', activeWorkspaceId).eq('id', row.id);
    if (error) showToast(error.message || 'Failed to delete person', 'error');
    else { showToast('Person deleted', 'success'); await reload(); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-gray-900">People</h2><p className="mt-1 text-sm text-gray-600">Work through leads by relationship status.</p></div>
        <button onClick={() => { setForm({ ...emptyForm, isActive: activityTab === 'active' }); setShowNew(true); }} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white"><Plus size={18} /> New person</button></div>
      <div className="mb-4 overflow-x-auto"><div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
        {statusTabs.map((tab) => <button key={tab.value} type="button" onClick={() => setStatusTab(tab.value)} className={`whitespace-nowrap border-r border-gray-200 px-4 py-2 text-sm font-medium last:border-r-0 ${statusTab === tab.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>{tab.label} <span className="ml-1 opacity-70">{counts[tab.value]}</span></button>)}
      </div></div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="inline-flex self-start overflow-hidden rounded-lg border border-gray-200 bg-white">
        {(['active', 'passive'] as ActivityTab[]).map((tab) => <button key={tab} onClick={() => setActivityTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize ${activityTab === tab ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>{tab}</button>)}
      </div><div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2"><Search size={18} className="text-gray-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people…" className="w-full px-2 py-2 text-sm focus:outline-none" />{query ? <button onClick={() => setQuery('')}><X size={16} /></button> : null}</div></div>
      {loading ? <div className="text-gray-600">Loading people…</div> : visible.length ? <ContactsList rows={visible} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} onOpen={(id) => navigate(`/crm/contacts/${id}`)} onEdit={(row) => navigate(`/crm/contacts/${row.id}`)} onDelete={remove} /> : <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">No people in this view.</div>}
      <ContactModal open={showNew} title="New person" saving={creating} firstName={form.firstName} setFirstName={(value) => setForm((state) => ({ ...state, firstName: value }))} lastName={form.lastName} setLastName={(value) => setForm((state) => ({ ...state, lastName: value }))}
        email={form.email} setEmail={(value) => setForm((state) => ({ ...state, email: value }))} linkedinUrl={form.linkedinUrl} setLinkedinUrl={(value) => setForm((state) => ({ ...state, linkedinUrl: value }))} phone={form.phone} setPhone={(value) => setForm((state) => ({ ...state, phone: value }))}
        isActive={form.isActive} setIsActive={(value) => setForm((state) => ({ ...state, isActive: value }))} onClose={() => { if (!creating) setShowNew(false); }} onSubmit={create} footerHint="You can assign a status, company, and tags after creating the person." />
    </div>
  );
}
