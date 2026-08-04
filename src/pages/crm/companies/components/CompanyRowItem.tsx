import { Building2, ExternalLink, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { CompanyRow } from '../types';

type Props = {
  company: CompanyRow;
  onOpen: () => void;
  openMenu: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CompanyRowItem({
  company,
  onOpen,
  openMenu,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      className="p-4 flex items-start justify-between gap-4 hover:bg-gray-50 cursor-pointer"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-gray-500" />
          <div className="font-medium text-gray-900 truncate">{company.name || 'Unnamed company'}</div>
        </div>

        <div className="mt-1 text-sm text-gray-600 space-y-1">
          {company.website_url ? (
            <a
              href={company.website_url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-blue-600 hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {company.website_url} <ExternalLink size={14} />
            </a>
          ) : null}
          {company.linkedin_url ? (
            <a
              href={company.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-blue-600 hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              LinkedIn <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-500 whitespace-nowrap">
          Updated {new Date(company.updated_at).toLocaleDateString()}
        </div>

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Actions"
            onClick={onToggleMenu}
          >
            <MoreVertical size={18} className="text-gray-600" />
          </button>

          {openMenu ? (
            <>
              <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  type="button"
                  onClick={onEdit}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDelete}
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
  );
}