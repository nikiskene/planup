import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ContactInteractionRow } from './useCrmContactInteractions';

type Props = {
  loading: boolean;
  interactions: ContactInteractionRow[];
  onNew: () => void;
  onEdit: (row: ContactInteractionRow) => void;
  onDelete: (row: ContactInteractionRow) => void;
};

function fmtDate(v: string | null) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}

export default function ContactInteractions({
  loading,
  interactions,
  onNew,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">Interactions</div>
          <div className="text-sm text-gray-600">Calls, emails, meetings, follow-ups.</div>
        </div>

        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          New interaction
        </button>
      </div>

      {loading ? (
        <div className="p-4 text-gray-600">Loading interactions…</div>
      ) : interactions.length === 0 ? (
        <div className="p-6 text-gray-700">No interactions yet.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {interactions.map((it) => (
            <div key={it.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 truncate">
                    {it.title?.trim() || it.note?.trim() || 'Interaction'}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(it.occurred_at || it.created_at)}
                  </div>
                </div>

                <div className="mt-1 text-sm text-gray-600 space-y-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {it.channel ? <span>Channel: {String(it.channel)}</span> : null}
                    {it.type ? <span>Type: {it.type}</span> : null}
                    {it.company?.name ? <span>Company: {it.company.name}</span> : null}
                    {it.next_action ? <span>Next: {String(it.next_action)}</span> : null}
                    {it.reconnect_in_days != null ? (
                      <span>Reconnect: {it.reconnect_in_days}d</span>
                    ) : null}
                  </div>

                  {it.note ? (
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{it.note}</div>
                  ) : null}

                  {it.link ? (
                    <a
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline inline-block"
                    >
                      {it.link}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(it)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(it)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}