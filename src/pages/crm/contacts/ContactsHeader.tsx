import { Plus } from 'lucide-react';

type Props = {
  onNew: () => void;
};

export default function ContactsHeader({ onNew }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">CRM · Contacts</h1>
        <p className="text-sm text-gray-600 mt-1">Your private contact database inside this workspace.</p>
      </div>

      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
      >
        <Plus size={18} />
        New contact
      </button>
    </div>
  );
}