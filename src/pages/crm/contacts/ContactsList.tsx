import { MoreVertical, Pencil, Trash2, User } from 'lucide-react';
import type { ContactRow } from './types';
import { fullName, nameColorClass } from './utils';

type Props = {
  rows: ContactRow[];
  openMenuId: string | null;
  setOpenMenuId: (v: string | null) => void;

  onOpen: (id: string) => void;
  onEdit: (row: ContactRow) => void;
  onDelete: (row: ContactRow) => void;
};

export default function ContactsList({
  rows,
  openMenuId,
  setOpenMenuId,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-200">
        {rows.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onOpen(c.id);
            }}
            className="p-4 flex items-start justify-between gap-4 hover:bg-gray-50 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-500" />
                <div className={`font-medium truncate ${nameColorClass(c.ui_status)}`}>
                  {fullName(c)}
                </div>
              </div>

              <div className="mt-1 text-sm text-gray-600 space-y-1">
                {c.email ? <div className="truncate">{c.email}</div> : null}
                {c.phone ? <div className="truncate">{c.phone}</div> : null}
                {c.linkedin_url ? (
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-blue-600 hover:underline inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.linkedin_url}
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 whitespace-nowrap">
                Updated {new Date(c.updated_at).toLocaleDateString()}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-gray-100"
                  title="Actions"
                  onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                >
                  <MoreVertical size={18} className="text-gray-600" />
                </button>

                {openMenuId === c.id ? (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
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
          </div>
        ))}
      </div>
    </div>
  );
}