import { X } from 'lucide-react';

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function ContactModal(props: {
  open: boolean;
  title: string;
  saving: boolean;

  firstName: string;
  setFirstName: (v: string) => void;

  lastName: string;
  setLastName: (v: string) => void;

  email: string;
  setEmail: (v: string) => void;

  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;

  phone: string;
  setPhone: (v: string) => void;

  // NEW
  isActive: boolean;
  setIsActive: (v: boolean) => void;

  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;

  footerHint?: string;
}) {
  const {
    open,
    title,
    saving,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    linkedinUrl,
    setLinkedinUrl,
    phone,
    setPhone,
    isActive,
    setIsActive,
    onClose,
    onSubmit,
    footerHint,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            {footerHint ? <div className="text-sm text-gray-600 mt-1">{footerHint}</div> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close"
            disabled={saving}
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* NEW: Active/Passive */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={classNames(
                  'w-12 h-7 rounded-full p-0.5 transition-colors',
                  isActive ? 'bg-gray-900' : 'bg-gray-300'
                )}
                title={isActive ? 'Active' : 'Passive'}
                disabled={saving}
              >
                <span
                  className={classNames(
                    'block w-6 h-6 rounded-full bg-white transition-transform',
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
              <span className="text-sm text-gray-800">{isActive ? 'Active' : 'Passive'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">LinkedIn</label>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="https://…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}