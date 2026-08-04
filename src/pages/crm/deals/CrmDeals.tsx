// src/pages/crm/deals/CrmDeals.tsx
import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useToast } from '../../../contexts/ToastContext';
import useCrmDeals, { DealRow } from './useCrmDeals';

type DealState = 'planned' | 'executed' | 'cancelled';
type DealsTab = 'active' | 'passive';

type DealContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  lead_status: string | null;
  is_active: boolean;
  updated_at: string;
};

function formatMoney(n: number | null) {
  if (n === null || n === undefined) return '';
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v);
}

function formatDate(d: string | null) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString();
}

function fullName(c: { first_name: string | null; last_name: string | null }) {
  const fn = (c.first_name || '').trim();
  const ln = (c.last_name || '').trim();
  const n = `${fn} ${ln}`.trim();
  return n || 'Unnamed contact';
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

type FormState = {
  name: string;
  start_date: string;
  end_date: string;
  value: string;
  capacity: string;
  details: string;
  is_active: boolean;
  state: DealState;
};

const emptyForm: FormState = {
  name: '',
  start_date: '',
  end_date: '',
  value: '',
  capacity: '',
  details: '',
  is_active: true,
  state: 'planned',
};

function toForm(d: DealRow): FormState {
  return {
    name: d.name ?? '',
    start_date: d.start_date ?? '',
    end_date: d.end_date ?? '',
    value: d.value === null || d.value === undefined ? '' : String(d.value),
    capacity: d.capacity === null || d.capacity === undefined ? '' : String(d.capacity),
    details: d.details ?? '',
    is_active: Boolean(d.is_active),
    state: (d.state as DealState) || 'planned',
  };
}

export default function CrmDeals() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { deals, loadingDeals, reload } = useCrmDeals(activeWorkspaceId, showToast);

  const [tab, setTab] = useState<DealsTab>('active');
  const [q, setQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null);

  // Deal → Contacts modal state
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsDeal, setContactsDeal] = useState<DealRow | null>(null);
  const [contacts, setContacts] = useState<DealContactRow[]>([]);

  const tabbed = useMemo(() => {
    const isActive = tab === 'active';
    return deals.filter((d) => Boolean(d.is_active) === isActive);
  }, [deals, tab]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tabbed;

    return tabbed.filter((d) => {
      const name = (d.name || '').toLowerCase();
      const details = (d.details || '').toLowerCase();
      const state = (d.state || '').toLowerCase();
      return name.includes(term) || details.includes(term) || state.includes(term);
    });
  }, [tabbed, q]);

  const openCreate = () => {
    setEditingDeal(null);
    setForm({ ...emptyForm, is_active: tab === 'active' });
    setModalOpen(true);
  };

  const openEdit = (d: DealRow) => {
    setEditingDeal(d);
    setForm(toForm(d));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingDeal(null);
    setForm(emptyForm);
  };

  const parseNumberOrNull = (raw: string, label: string) => {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error(`${label} must be a number.`);
    return n;
  };

  const upsertDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    const name = form.name.trim();
    if (!name) {
      showToast('Name is required.', 'error');
      return;
    }

    let valueNum: number | null = null;
    let capNum: number | null = null;

    try {
      valueNum = parseNumberOrNull(form.value, 'Value');
      capNum = parseNumberOrNull(form.capacity, 'Capacity');
    } catch (err: any) {
      showToast(err?.message || 'Invalid number.', 'error');
      return;
    }

    const payload = {
      name,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      value: valueNum,
      capacity: capNum === null ? null : Math.trunc(capNum),
      details: form.details.trim() || null,
      is_active: Boolean(form.is_active),
      state: form.state as DealState,
    };

    setSaving(true);
    try {
      if (editingDeal) {
        const { error } = await supabase
          .from('crm_deals')
          .update(payload)
          .eq('workspace_id', activeWorkspaceId)
          .eq('id', editingDeal.id);

        if (error) throw error;
        showToast('Deal updated', 'success');
      } else {
        const { error } = await supabase
          .from('crm_deals')
          .insert({ workspace_id: activeWorkspaceId, ...payload });

        if (error) throw error;
        showToast('Deal created', 'success');
      }

      closeModal();
      await reload();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save deal', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteDeal = async (d: DealRow) => {
    if (!activeWorkspaceId) return;
    const ok = confirm(`Delete deal "${d.name}"?`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', d.id);

      if (error) throw error;
      showToast('Deal deleted', 'success');
      await reload();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete deal', 'error');
    }
  };

  const toggleActive = async (d: DealRow) => {
    if (!activeWorkspaceId) return;

    const next = !Boolean(d.is_active);

    try {
      const { error } = await supabase
        .from('crm_deals')
        .update({ is_active: next })
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', d.id);

      if (error) throw error;

      showToast(next ? 'Moved to Active' : 'Moved to Passive', 'success');
      await reload();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to update status', 'error');
    }
  };

  const openDealContacts = async (d: DealRow) => {
    if (!activeWorkspaceId) return;

    setContactsDeal(d);
    setContacts([]);
    setContactsOpen(true);
    setContactsLoading(true);

    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id,first_name,last_name,email,phone,linkedin_url,lead_status,is_active,updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('associated_deal_id', d.id)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setContacts((data || []) as DealContactRow[]);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load associated contacts', 'error');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const closeDealContacts = () => {
    if (contactsLoading) return;
    setContactsOpen(false);
    setContactsDeal(null);
    setContacts([]);
  };

  // Close contacts modal on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDealContacts();
    };
    if (contactsOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsOpen, contactsLoading]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CRM · Deals</h1>
          <p className="text-sm text-gray-600 mt-1">Active vs Passive with a simple execution state.</p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          New deal
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
              placeholder="Search deals…"
              className="w-full px-2 py-2 text-sm focus:outline-none"
            />
            {q.trim() ? (
              <button
                type="button"
                onClick={() => setQ('')}
                className="p-2 rounded-lg hover:bg-gray-100"
                title="Clear"
              >
                <X size={16} className="text-gray-500" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {loadingDeals ? (
        <div className="text-gray-600">Loading deals…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-700">No deals.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">State</div>
            <div className="col-span-2">Start</div>
            <div className="col-span-2 text-right">Value</div>
            <div className="col-span-1 text-center">A/P</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {filtered.map((d) => (
            <div key={d.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <div className="col-span-4">
                <button
                  type="button"
                  onClick={() => openDealContacts(d)}
                  className="text-left w-full"
                  title="Show associated contacts"
                >
                  <div className="text-sm font-medium text-gray-900 hover:underline">{d.name}</div>
                  {d.details ? <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{d.details}</div> : null}
                </button>
              </div>

              <div className="col-span-2">
                <span className="text-sm text-gray-800 capitalize">{d.state}</span>
              </div>

              <div className="col-span-2 text-sm text-gray-700">{formatDate(d.start_date)}</div>

              <div className="col-span-2 text-sm text-gray-700 text-right">{formatMoney(d.value)}</div>

              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => toggleActive(d)}
                  className={classNames(
                    'w-10 h-6 rounded-full p-0.5 transition-colors',
                    d.is_active ? 'bg-gray-900' : 'bg-gray-300'
                  )}
                  title={d.is_active ? 'Active (click to set Passive)' : 'Passive (click to set Active)'}
                >
                  <span
                    className={classNames(
                      'block w-5 h-5 rounded-full bg-white transition-transform',
                      d.is_active ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              <div className="col-span-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(d)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Edit"
                >
                  <Pencil size={16} className="text-gray-700" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteDeal(d)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Delete"
                >
                  <Trash2 size={16} className="text-gray-700" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal Create/Edit Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">{editingDeal ? 'Edit deal' : 'New deal'}</div>
                <div className="text-sm text-gray-600 mt-1">Active/Passive and state are first-class fields.</div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
                disabled={saving}
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <form onSubmit={upsertDeal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  placeholder="e.g. Compass Brazil 2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((s) => ({ ...s, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                  <input
                    value={form.value}
                    onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="numeric"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    value={form.capacity}
                    onChange={(e) => setForm((s) => ({ ...s, capacity: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder="integer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Active</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, is_active: !s.is_active }))}
                    className={classNames(
                      'w-12 h-7 rounded-full p-0.5 transition-colors',
                      form.is_active ? 'bg-gray-900' : 'bg-gray-300'
                    )}
                    title={form.is_active ? 'Active' : 'Passive'}
                  >
                    <span
                      className={classNames(
                        'block w-6 h-6 rounded-full bg-white transition-transform',
                        form.is_active ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                  <span className="text-sm text-gray-800">{form.is_active ? 'Active' : 'Passive'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">State</label>
                <div className="flex flex-wrap gap-3">
                  {(['planned', 'executed', 'cancelled'] as DealState[]).map((s) => (
                    <label key={s} className="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="deal_state"
                        value={s}
                        checked={form.state === s}
                        onChange={() => setForm((x) => ({ ...x, state: s }))}
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm((s) => ({ ...s, details: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  placeholder="Optional notes…"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingDeal ? 'Save changes' : 'Create deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Deal → Contacts Modal */}
      {contactsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">Associated contacts</div>
                <div className="text-sm text-gray-600 mt-1">{contactsDeal?.name || 'Deal'}</div>
              </div>
              <button
                type="button"
                onClick={closeDealContacts}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close"
                disabled={contactsLoading}
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-5">
              {contactsLoading ? (
                <div className="text-gray-600">Loading contacts…</div>
              ) : contacts.length === 0 ? (
                <div className="text-gray-700">No contacts are associated with this deal.</div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-200 bg-gray-50">
                    <div className="col-span-6">Contact</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2 text-right">A/P</div>
                  </div>

                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/crm/contacts/${c.id}`)}
                      className="w-full text-left grid grid-cols-12 gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50"
                      title="Open contact"
                    >
                      <div className="col-span-6">
                        <div className="text-sm font-medium text-gray-900">{fullName(c)}</div>
                        {c.lead_status ? (
                          <div className="text-xs text-gray-500 mt-0.5 capitalize">{c.lead_status}</div>
                        ) : null}
                      </div>

                      <div className="col-span-4 text-sm text-gray-700 truncate">{c.email || ''}</div>

                      <div className="col-span-2 text-sm text-gray-700 text-right">
                        {c.is_active ? 'Active' : 'Passive'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={closeDealContacts}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                  disabled={contactsLoading}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}