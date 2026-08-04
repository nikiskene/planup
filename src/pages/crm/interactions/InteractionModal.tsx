import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { CompanyOption, ContactOption, InteractionRow } from './types';
import { contactLabel } from './types';

type Props = {
  open: boolean;
  title: string;
  saving?: boolean;
  contacts: ContactOption[];
  companies: CompanyOption[];
  initial?: Partial<InteractionRow>;
  onClose: () => void;
  onSave: (payload: {
    contact_id: string | null;
    company_id: string | null;
    occurred_at: string | null;
    channel: string | null;
    type: string | null;
    title: string | null;
    note: string | null;
    next_action: string | null;
    reconnect_in_days: number | null;
    link: string | null;
  }) => Promise<void> | void;
};

function toDateInput(v: string | null | undefined) {
  if (!v) return '';
  return v.split('T')[0] || '';
}

/**
 * IMPORTANT:
 * These option values MUST match the Postgres enum values exactly.
 * Current enum crm_channel values in your DB:
 * - phone
 * - text
 * - social
 * - email
 * - website
 */
const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone / Call' },
  { value: 'text', label: 'SMS / WhatsApp' },
  { value: 'social', label: 'LinkedIn / Social' },
  { value: 'website', label: 'Website / Form' },
] as const;

type ChannelValue = (typeof CHANNEL_OPTIONS)[number]['value'];

function coerceChannel(v: any): ChannelValue {
  if (v === 'email' || v === 'phone' || v === 'text' || v === 'social' || v === 'website') {
    return v;
  }
  return 'email';
}

const NEXT_ACTION_OPTIONS = [
  { value: 'reconnect', label: 'Reconnect' },
  { value: 'none', label: 'None' },
  { value: 'disconnect', label: 'Disconnect' },
] as const;

type NextActionValue = (typeof NEXT_ACTION_OPTIONS)[number]['value'];

function coerceNextAction(v: any): NextActionValue {
  if (v === 'reconnect' || v === 'none' || v === 'disconnect') return v;
  return 'none';
}

export default function InteractionModal({
  open,
  title,
  saving,
  contacts,
  companies,
  initial,
  onClose,
  onSave,
}: Props) {
  const [contactId, setContactId] = useState(initial?.contact_id || '');
  const [companyId, setCompanyId] = useState(initial?.company_id || '');
  const [occurredAt, setOccurredAt] = useState(toDateInput(initial?.occurred_at || null));
  const [channel, setChannel] = useState<ChannelValue>(coerceChannel(initial?.channel));
  const [type, setType] = useState(initial?.type || '');
  const [itTitle, setItTitle] = useState(initial?.title || '');
  const [note, setNote] = useState(initial?.note || '');
  const [nextAction, setNextAction] = useState<NextActionValue>(coerceNextAction(initial?.next_action));
  const [reconnectInDays, setReconnectInDays] = useState(initial?.reconnect_in_days?.toString?.() || '');
  const [link, setLink] = useState(initial?.link || '');

  useEffect(() => {
    if (!open) return;

    setContactId(initial?.contact_id || '');
    setCompanyId(initial?.company_id || '');
    setOccurredAt(toDateInput(initial?.occurred_at || null));
    setChannel(coerceChannel(initial?.channel));
    setType(initial?.type || '');
    setItTitle(initial?.title || '');
    setNote(initial?.note || '');
    setNextAction(coerceNextAction(initial?.next_action));
    setReconnectInDays(initial?.reconnect_in_days?.toString?.() || '');
    setLink(initial?.link || '');
  }, [open, initial]);

  const canSubmit = useMemo(() => {
    const hasSomething =
      (itTitle || '').trim() ||
      (note || '').trim() ||
      (link || '').trim() ||
      (contactId || '').trim() ||
      (companyId || '').trim() ||
      (type || '').trim() ||
      (occurredAt || '').trim();

    return Boolean(hasSomething);
  }, [itTitle, note, link, contactId, companyId, type, occurredAt]);

  // Prevent background scroll while open (mobile especially)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={() => !saving && onClose()} />

      {/* Scroll container */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold text-gray-900">{title}</div>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={() => !saving && onClose()}
                title="Close"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            {/* Body (scrolls) */}
            <form
              className="p-4 space-y-4 overflow-y-auto"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!canSubmit || saving) return;

                await onSave({
                  contact_id: contactId.trim() ? contactId : null,
                  company_id: companyId.trim() ? companyId : null,
                  occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
                  channel: channel || 'email',
                  type: type.trim() || null,
                  title: itTitle.trim() || null,
                  note: note.trim() || null,
                  next_action: nextAction || 'none',
                  reconnect_in_days: reconnectInDays.trim() ? Number(reconnectInDays.trim()) : null,
                  link: link.trim() || null,
                });
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                  <select
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {contactLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">None</option>
                    {companies.map((co) => (
                      <option key={co.id} value={co.id}>
                        {co.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(coerceChannel(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <input
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="Intro, follow-up…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  value={itTitle}
                  onChange={(e) => setItTitle(e.target.value)}
                  placeholder="Short summary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next action</label>
                  <select
                    value={nextAction}
                    onChange={(e) => setNextAction(coerceNextAction(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {NEXT_ACTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reconnect (days)</label>
                  <input
                    inputMode="numeric"
                    value={reconnectInDays}
                    onChange={(e) => setReconnectInDays(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link</label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Optional URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !saving && onClose()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !canSubmit}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {!canSubmit ? (
                <p className="text-xs text-gray-500">
                  Add at least a title, note, link, contact, company, type, or date.
                </p>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}