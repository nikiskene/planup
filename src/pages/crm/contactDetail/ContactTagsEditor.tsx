import { useMemo, useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { TagRow } from './types';

type Props = {
  tags: TagRow[];          // assigned tags
  allTags: TagRow[];       // workspace catalog
  disabled?: boolean;
  onAddTag: (tagId: string) => Promise<void> | void;
  onRemoveTag: (tagId: string) => Promise<void> | void;
};

export default function ContactTagsEditor({
  tags,
  allTags,
  disabled,
  onAddTag,
  onRemoveTag,
}: Props) {
  const [selectedToAdd, setSelectedToAdd] = useState('');

  // Defensive: never trust runtime values (even if TS types say TagRow[])
  const safeTags = useMemo(() => (Array.isArray(tags) ? tags : []), [tags]);
  const safeAllTags = useMemo(() => (Array.isArray(allTags) ? allTags : []), [allTags]);

  const assignedIds = useMemo(() => new Set(safeTags.map((t) => t.id)), [safeTags]);

  const availableToAdd = useMemo(() => {
    return safeAllTags.filter((t) => !assignedIds.has(t.id));
  }, [safeAllTags, assignedIds]);

  const add = async () => {
    const id = selectedToAdd;
    if (!id) return;
    setSelectedToAdd('');
    await onAddTag(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-gray-700">Tags</label>

        <div className="flex items-center gap-2">
          <select
            value={selectedToAdd}
            onChange={(e) => setSelectedToAdd(e.target.value)}
            disabled={disabled || availableToAdd.length === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            title={availableToAdd.length === 0 ? 'No more tags to add' : 'Select a tag to add'}
          >
            <option value="">Add tag…</option>
            {availableToAdd.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={add}
            disabled={disabled || !selectedToAdd}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {safeTags.length > 0 ? (
          safeTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
            >
              {t.name}
              <button
                type="button"
                onClick={() => onRemoveTag(t.id)}
                disabled={disabled}
                className="p-0.5 rounded-full hover:bg-gray-200 disabled:opacity-50"
                title="Remove tag"
              >
                <X size={12} />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-500">No tags</span>
        )}
      </div>
    </div>
  );
}