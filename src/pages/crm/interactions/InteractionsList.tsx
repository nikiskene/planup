import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CompanyOption, ContactOption, InteractionRow } from './types';
import { contactLabel } from './types';

type Props = {
  interactions: InteractionRow[];
  contacts: ContactOption[];
  companies: CompanyOption[];
  onEdit: (row: InteractionRow) => void;
  onDelete: (row: InteractionRow) => void;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return '';
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function InteractionsList({
  interactions,
  contacts,
  companies,
  onEdit,
  onDelete,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-200">
        {interactions.map((it) => {
          const c = it.contact_id ? contactMap.get(it.contact_id) : null;
          const co = it.company_id ? companyMap.get(it.company_id) : null;

          return (
            <div key={it.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 truncate">
                    {it.title?.trim() || it.type?.trim() || 'Interaction'}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(it.occurred_at || it.created_at)}
                  </div>
                </div>

                <div className="mt-1 text-sm text-gray-600 space-y-1">
                  {c ? <div className="truncate">Contact: {contactLabel(c)}</div> : null}
                  {co ? <div className="truncate">Company: {co.name}</div> : null}
                  {it.channel ? <div className="truncate">Channel: {it.channel}</div> : null}
                  {it.note ? (
                    <div className="text-gray-700 line-clamp-2 whitespace-pre-wrap">
                      {it.note}
                    </div>
                  ) : null}
                  {it.next_action ? (
                    <div className="truncate text-gray-700">
                      Next: {it.next_action}
                      {typeof it.reconnect_in_days === 'number' ? ` (in ${it.reconnect_in_days}d)` : ''}
                    </div>
                  ) : null}
                  {it.link ? (
                    <a
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline inline-block truncate"
                    >
                      {it.link}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Actions"
                  onClick={() => setOpenMenuId((v) => (v === it.id ? null : it.id))}
                >
                  <MoreVertical size={18} className="text-gray-600" />
                </button>

                {openMenuId === it.id ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onEdit(it);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          onDelete(it);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}