import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import type { CompanyRow } from './types';
import { sanitizeUrl } from './utils';
import { useCompanies } from './hooks/useCompanies';
import CompanyRowItem from './components/CompanyRowItem';
import CompanyModal from './components/CompanyModal';

export default function CompaniesPage() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { companies, loading, fetchCompanies } = useCompanies(activeWorkspaceId, showToast);

  const [q, setQ] = useState('');

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // New modal
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((c) => {
      const n = (c.name || '').toLowerCase();
      const w = (c.website_url || '').toLowerCase();
      const l = (c.linkedin_url || '').toLowerCase();
      return n.includes(term) || w.includes(term) || l.includes(term);
    });
  }, [companies, q]);

  const resetForm = () => {
    setName('');
    setWebsiteUrl('');
    setLinkedinUrl('');
    setNotes('');
  };

  const loadFormFromCompany = (c: CompanyRow) => {
    setName(c.name || '');
    setWebsiteUrl(c.website_url || '');
    setLinkedinUrl(c.linkedin_url || '');
    setNotes(c.notes || '');
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    const n = name.trim();
    if (!n) {
      showToast('Name is required', 'error');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('crm_companies').insert({
        workspace_id: activeWorkspaceId,
        name: n,
        website_url: sanitizeUrl(websiteUrl),
        linkedin_url: sanitizeUrl(linkedinUrl),
        notes: notes.trim() ? notes.trim() : null,
      });

      if (error) throw error;

      showToast('Company created', 'success');
      setShowNew(false);
      resetForm();
      await fetchCompanies();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to create company', 'error');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (c: CompanyRow) => {
    setOpenMenuId(null);
    setEditing(c);
    loadFormFromCompany(c);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !editing) return;

    const n = name.trim();
    if (!n) {
      showToast('Name is required', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('crm_companies')
        .update({
          name: n,
          website_url: sanitizeUrl(websiteUrl),
          linkedin_url: sanitizeUrl(linkedinUrl),
          notes: notes.trim() ? notes.trim() : null,
        })
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', editing.id);

      if (error) throw error;

      showToast('Company updated', 'success');
      setEditing(null);
      resetForm();
      await fetchCompanies();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to update company', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteCompany = async (c: CompanyRow) => {
    setOpenMenuId(null);

    const ok = confirm(
      `Delete "${c.name}"?\n\nThis may fail if contacts still reference this company.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('crm_companies')
        .delete()
        .eq('workspace_id', c.workspace_id)
        .eq('id', c.id);

      if (error) throw error;

      showToast('Company deleted', 'success');
      await fetchCompanies();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete company', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CRM · Companies</h1>
          <p className="text-sm text-gray-600 mt-1">Companies inside this workspace.</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowNew(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          New company
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, website, LinkedIn…"
            className="w-full px-2 py-2 text-sm focus:outline-none"
          />
          {q.trim() ? (
            <button type="button" onClick={() => setQ('')} className="p-2 rounded-lg hover:bg-gray-100" title="Clear">
              <X size={16} className="text-gray-500" />
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading companies…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-700">No companies yet.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((c) => (
              <CompanyRowItem
                key={c.id}
                company={c}
                onOpen={() => navigate(`/crm/companies`)} // no detail page yet
                openMenu={openMenuId === c.id}
                onToggleMenu={() => setOpenMenuId((v) => (v === c.id ? null : c.id))}
                onCloseMenu={() => setOpenMenuId(null)}
                onEdit={() => startEdit(c)}
                onDelete={() => deleteCompany(c)}
              />
            ))}
          </div>
        </div>
      )}

      <CompanyModal
        title="New company"
        open={showNew}
        busy={creating}
        onClose={() => setShowNew(false)}
        onSubmit={createCompany}
        name={name}
        setName={setName}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        linkedinUrl={linkedinUrl}
        setLinkedinUrl={setLinkedinUrl}
        notes={notes}
        setNotes={setNotes}
        submitLabel="Create company"
      />

      <CompanyModal
        title="Edit company"
        open={Boolean(editing)}
        busy={savingEdit}
        onClose={() => setEditing(null)}
        onSubmit={saveEdit}
        name={name}
        setName={setName}
        websiteUrl={websiteUrl}
        setWebsiteUrl={setWebsiteUrl}
        linkedinUrl={linkedinUrl}
        setLinkedinUrl={setLinkedinUrl}
        notes={notes}
        setNotes={setNotes}
        submitLabel="Save changes"
      />
    </div>
  );
}