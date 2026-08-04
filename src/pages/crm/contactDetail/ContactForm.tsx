import type { CompanyRow, ContactRow, DealRow, LeadStatus } from './types';

type Props = {
  contact: ContactRow;

  companies: CompanyRow[];
  companyId: string;
  setCompanyId: (v: string) => void;

  deals: DealRow[];
  associatedDealId: string;
  setAssociatedDealId: (v: string) => void;

  leadStatus: LeadStatus | '';
  setLeadStatus: (v: LeadStatus | '') => void;

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
};

const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'connected', label: 'Connected' },
  { value: 'bad_timing', label: 'Bad Timing' },
  { value: 'in_progress', label: 'In Progress' },
];

export default function ContactForm({
  contact,
  companies,
  companyId,
  setCompanyId,

  deals,
  associatedDealId,
  setAssociatedDealId,

  leadStatus,
  setLeadStatus,

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
}: Props) {
  const currentCompanyName = contact.company?.name || null;
  const currentDealName = contact.deal?.name || null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Company */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">None</option>
          {companies.map((co) => (
            <option key={co.id} value={co.id}>
              {co.name}
            </option>
          ))}
        </select>

        {currentCompanyName ? (
          <div className="text-xs text-gray-500 mt-1">Current: {currentCompanyName}</div>
        ) : null}
      </div>

      {/* Lead Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lead status</label>
        <select
          value={leadStatus}
          onChange={(e) => setLeadStatus((e.target.value as LeadStatus) || '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">None</option>
          {LEAD_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {contact.lead_status ? (
          <div className="text-xs text-gray-500 mt-1">
            Current: {LEAD_STATUS_OPTIONS.find((o) => o.value === contact.lead_status)?.label || contact.lead_status}
          </div>
        ) : null}
      </div>

      {/* Associated Deal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Associated deal</label>
        <select
          value={associatedDealId}
          onChange={(e) => setAssociatedDealId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">None</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || 'Unnamed deal'}
            </option>
          ))}
        </select>

        {currentDealName ? (
          <div className="text-xs text-gray-500 mt-1">Current: {currentDealName}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
        <input
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://linkedin.com/in/…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="+43 …"
        />
      </div>

      <p className="text-xs text-gray-500 pt-2">
        Tasks reference this contact via <code>crm_contact_id</code>. This screen edits only the contact record.
      </p>
    </div>
  );
}