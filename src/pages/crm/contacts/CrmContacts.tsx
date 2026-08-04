// src/pages/crm/contacts/CrmContacts.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';

import useCrmContacts from './useCrmContacts';

import type { ContactRow } from './types';
import { fullName, sanitizeUrl } from './utils';
import ContactsList from './ContactsList';
import ContactModal from './ContactModal';

type ContactStatusRow = {
  contact_id: string;
  last_next_action: string | null;
  open_task_count: number;
  ui_status: string;
};

type TabKey = 'active' | 'passive';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string;
  phone: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  linkedinUrl: '',
  phone: '',
  isActive: true,
};

function hasAnyIdentifier(v: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  phone?: string | null;
}) {
  const fn = (v.firstName || '').trim();
  const ln = (v.lastName || '').trim();
  const em = (v.email || '').trim();
  const li = (v.linkedinUrl || '').trim();
  const ph = (v.phone || '').trim();
  return Boolean(fn || ln || em || li || ph);
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function CrmContacts() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { contacts, loading, reload } = useCrmContacts(activeWorkspaceId, showToast);

  const [tab, setTab] = useState<TabKey>('active');
  const [q, setQ] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [statusById, setStatusById] = useState<Record<string, ContactStatusRow>>({});

  const loadStatuses = useCallback(async () => {
    if (!activeWorkspaceId) {
      setStatusById({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('v_crm_contacts_status')
        .select('contact_id,last_next_action,open_task_count,ui_status')
        .eq('workspace_id', activeWorkspaceId);

      if (error) throw error;

      const map: Record<string, ContactStatusRow> = {};
      (data || []).forEach((r: any) => {
        map[r.contact_id] = r as ContactStatusRow;
      });
      setStatusById(map);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load contact status', 'error');
      setStatusById({});
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setOpenMenuId(null);
  }, [activeWorkspaceId]);

  const rows = useMemo(() => {
    return (contacts || []).map((c: any) => {
      const st = statusById[c.id];
      return {
        ...c,
        last_next_action: st?.last_next_action ?? null,
        open_task_count: st?.open_task_count ?? 0,
        ui_status: st?.ui_status ?? 'no_task',
      };
    });
  }, [contacts, statusById]);

  const tabbed = useMemo(() => {
    const wantActive = tab === 'active';
    return rows.filter((c: any) => Boolean(c.is_active) === wantActive);
  }, [rows, tab]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tabbed;

    return tabbed.filter((c: any) => {
      const name = fullName(c as ContactRow).toLowerCase();
      const e = (c.email || '').toLowerCase();
      const p = (c.phone || '').toLowerCase();
      const l = (c.linkedin_url || '').toLowerCase();
      return name.includes(term) || e.includes(term) || p.includes(term) || l.includes(term);
    });
  }, [tabbed, q]);

  const resetForm = () => setForm({ ...emptyForm, isActive: tab === 'active' });

  const loadFormFromContact = (c: any) =>
    setForm({
      firstName: c.first_name || '',
      lastName: c.last_name || '',
      email: c.email || '',
      linkedinUrl: c.linkedin_url || '',
      phone: c.phone || '',
      isActive: Boolean(c.is_active),
    });

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    if (!hasAnyIdentifier(form)) {
      showToast('Add at least a name, email, LinkedIn, or phone.', 'error');
      return;
    }

    const payload = {
      workspace_id: activeWorkspaceId,
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      linkedin_url: sanitizeUrl(form.linkedinUrl),
      phone: form.phone.trim() || null,
      is_active: Boolean(form.isActive),
    };

    setCreating(true);
    try {
      const { error } = await supabase.from('crm_contacts').insert(payload);
      if (error) throw error;

      showToast('Contact created', 'success');
      setShowNew(false);
      resetForm();

      await reload();
      await loadStatuses();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to create contact', 'error');
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !editing) return;

    if (!hasAnyIdentifier(form)) {
      showToast('Add at least a name, email, LinkedIn, or phone.', 'error');
      return;
    }

    const payload = {
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      linkedin_url: sanitizeUrl(form.linkedinUrl),
      phone: form.phone.trim() || null,
      is_active: Boolean(form.isActive),
    };

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('crm_contacts')
        .update(payload)
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', editing.id);

      if (error) throw error;

      showToast('Contact updated', 'success');
      setEditing(null);
      resetForm();

      await reload();
      await loadStatuses();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to update contact', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteContact = async (c: ContactRow) => {
    setOpenMenuId(null);
    if (!activeWorkspaceId) return;

    const ok = confirm(
      `Delete "${fullName(c)}"?\n\nThis may fail if related records exist and you did not configure cascade deletes.`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', c.id);

      if (error) throw error;

      showToast('Contact deleted', 'success');
      await reload();
      await loadStatuses();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete contact', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CRM · Contacts</h1>
          <p className="text-sm text-gray-600 mt-1">Active/Passive helps you stay focused without deleting leads.</p>
        </div>

        <button
          onClick={() => {
            setOpenMenuId(null);
            resetForm();
            setShowNew(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          New contact
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={classNames(
              'px-4 py-2 text-sm font-medium',
              tab === 'active' ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'
            )}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab('passive')}
            className={classNames(
              'px-4 py-2 text-sm font-medium border-l border-gray-200',
              tab === 'passive' ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'
            )}
          >
            Passive
          </button>
        </div>

        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2 max-w-md">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone, LinkedIn…"
              className="w-full px-2 py-2 text-sm focus:outline-none"
            />
            {q.trim() ? (
              <button type="button" onClick={() => setQ('')} className="p-2 rounded-lg hover:bg-gray-100" title="Clear">
                <X size={16} className="text-gray-500" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading contacts…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-700">No contacts.</div>
      ) : (
        <ContactsList
          rows={filtered as any}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onOpen={(id) => navigate(`/crm/contacts/${id}`)}
          onEdit={(c: any) => {
            setOpenMenuId(null);
            setEditing(c as ContactRow);
            loadFormFromContact(c);
          }}
          onDelete={(c: any) => deleteContact(c as ContactRow)}
        />
      )}

      <ContactModal
        open={showNew}
        title="New contact"
        saving={creating}
        firstName={form.firstName}
        setFirstName={(v) => setForm((s) => ({ ...s, firstName: v }))}
        lastName={form.lastName}
        setLastName={(v) => setForm((s) => ({ ...s, lastName: v }))}
        email={form.email}
        setEmail={(v) => setForm((s) => ({ ...s, email: v }))}
        linkedinUrl={form.linkedinUrl}
        setLinkedinUrl={(v) => setForm((s) => ({ ...s, linkedinUrl: v }))}
        phone={form.phone}
        setPhone={(v) => setForm((s) => ({ ...s, phone: v }))}
        isActive={form.isActive}
        setIsActive={(v) => setForm((s) => ({ ...s, isActive: v }))}
        onClose={() => {
          if (creating) return;
          resetForm();
          setShowNew(false);
        }}
        onSubmit={createContact}
        footerHint="Minimal rule: provide at least one identifier (name, email, LinkedIn, or phone)."
      />

      <ContactModal
        open={!!editing}
        title="Edit contact"
        saving={savingEdit}
        firstName={form.firstName}
        setFirstName={(v) => setForm((s) => ({ ...s, firstName: v }))}
        lastName={form.lastName}
        setLastName={(v) => setForm((s) => ({ ...s, lastName: v }))}
        email={form.email}
        setEmail={(v) => setForm((s) => ({ ...s, email: v }))}
        linkedinUrl={form.linkedinUrl}
        setLinkedinUrl={(v) => setForm((s) => ({ ...s, linkedinUrl: v }))}
        phone={form.phone}
        setPhone={(v) => setForm((s) => ({ ...s, phone: v }))}
        isActive={form.isActive}
        setIsActive={(v) => setForm((s) => ({ ...s, isActive: v }))}
        onClose={() => {
          if (savingEdit) return;
          setEditing(null);
          resetForm();
          setOpenMenuId(null);
        }}
        onSubmit={saveEdit}
        footerHint="Minimal rule: provide at least one identifier (name, email, LinkedIn, or phone)."
      />
    </div>
  );
}

export default CrmContacts;