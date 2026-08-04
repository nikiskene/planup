import { Search, X } from 'lucide-react';

type Props = {
  q: string;
  setQ: (v: string) => void;
};

export default function ContactsSearch({ q, setQ }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2">
        <Search size={18} className="text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, LinkedIn…"
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
  );
}