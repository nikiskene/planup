import { X, ExternalLink } from 'lucide-react';

type DealContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  lead_status: string | null;
  is_active?: boolean | null;
};

function fullName(c: DealContactRow) {
  const fn = (c.first_name || '').trim();
  const ln = (c.last_name || '').trim();
  const name = `${fn} ${ln}`.trim();
  return name || c.email || c.phone || 'Unnamed contact';
}

function pill(label: string, tone: 'dark' | 'light' = 'light') {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  if (tone === 'dark') return `${base} bg-gray-900 text-white`;
  return `${base} bg-gray-100 text-gray-700`;
}

export default function DealContactsModal(props: {
  open: boolean;
  title: string; // e.g. Deal name
  loading: boolean;
  contacts: DealContactRow[];
  onClose: () => void;
  onOpenContact: (id: string) => void; // navigate to /crm/contacts/:id
}) {
  const { open, title, loading, contacts, onClose, onOpenContact } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-500">Deal</div>
                <div className="font-semibold text-gray-900 truncate">{title}</div>
              </div>

              <button
                type="button"
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={onClose}
                title="Close"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              {loading ? (
                <div className="text-gray-600">Loading contacts…</div>
              ) : contacts.length === 0 ? (
                <div className="text-gray-700">No contacts linked to this deal.</div>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onOpenContact(c.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{fullName(c)}</div>
                        <div className="mt-0.5 text-xs text-gray-600 truncate">
                          {c.email || c.phone || c.linkedin_url || ''}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {typeof c.is_active === 'boolean'
                            ? c.is_active
                              ? <span className={pill('Active', 'dark')}>Active</span>
                              : <span className={pill('Passive')}>Passive</span>
                            : null}

                          {c.lead_status ? <span className={pill(String(c.lead_status))}>{String(c.lead_status)}</span> : null}

                          {c.linkedin_url ? <span className={pill('LinkedIn')}>LinkedIn</span> : null}
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        <ExternalLink size={16} className="text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}