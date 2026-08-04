import { ArrowLeft, ExternalLink, Save, Trash2 } from 'lucide-react';
import type { ContactRow, TagRow } from './types';
import { contactTitle } from './utils';

type Props = {
  contact: ContactRow | null;
  tags: TagRow[];
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  linkedinUrl: string;
};

export default function ContactHeader({
  contact,
  tags,
  loading,
  saving,
  deleting,
  onBack,
  onSave,
  onDelete,
  linkedinUrl,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100" title="Back">
          <ArrowLeft size={18} className="text-gray-700" />
        </button>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900">{contactTitle(contact)}</h1>

            {linkedinUrl.trim() ? (
              <a
                href={linkedinUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                title="Open LinkedIn"
              >
                Open <ExternalLink size={14} />
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {tags.length > 0 ? (
              tags.map((t) => (
                <span key={t.id} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {t.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-500">No tags</span>
            )}
          </div>

          {contact ? (
            <p className="text-xs text-gray-500 mt-2">
              Updated {new Date(contact.updated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          disabled={loading || deleting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Trash2 size={18} />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>

        <button
          onClick={onSave}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}