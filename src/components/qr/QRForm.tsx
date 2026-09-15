import type { QRContent, QRType } from '../../lib/qr/types';
export const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900';
export const buttonClass = 'min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 disabled:opacity-40';
const fields: Record<QRType, [string, string, string?][]> = {
  url: [['url', 'URL', 'url']], text: [['text', 'Text', 'textarea']],
  email: [['email', 'Email address', 'email'], ['subject', 'Subject'], ['message', 'Message', 'textarea']],
  phone: [['phone', 'Phone number', 'tel']], whatsapp: [['phone', 'Phone number with country code', 'tel'], ['message', 'Message', 'textarea']],
  wifi: [['ssid', 'Network name / SSID'], ['password', 'Password', 'password']],
  vcard: [['firstName', 'First name'], ['lastName', 'Last name'], ['company', 'Company'], ['title', 'Job title'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'email'], ['website', 'Website'], ['address', 'Address', 'textarea']],
  event: [['title', 'Event title'], ['startDate', 'Start date', 'date'], ['startTime', 'Start time', 'time'], ['endDate', 'End date', 'date'], ['endTime', 'End time', 'time'], ['location', 'Location'], ['description', 'Description', 'textarea'], ['url', 'URL']],
};
export default function QRForm({ content, onChange }: { content: QRContent; onChange: (value: QRContent) => void }) {
  // The field registry limits updates to the active discriminated form's keys.
  const update = (key: string, value: string | boolean) => onChange({ ...content, data: { ...content.data, [key]: value } } as QRContent);
  return <div className="space-y-4">
    {fields[content.type].filter(([key]) => !(content.type === 'wifi' && content.data.security === 'nopass' && key === 'password')).map(([key, label, type]) => {
      const value = String(content.data[key as keyof typeof content.data] ?? '');
      return <label key={key} className="block text-sm font-medium">{label}
        {type === 'textarea' ? <textarea className={inputClass} rows={4} value={value} onChange={e => update(key, e.target.value)} /> :
          <input className={inputClass} type={type === 'url' ? 'text' : type || 'text'} autoComplete="off" value={value} placeholder={key === 'url' ? 'https://example.com' : undefined} onChange={e => update(key, e.target.value)} />}
      </label>;
    })}
    {content.type === 'wifi' && <><label className="block text-sm font-medium">Security<select className={inputClass} value={content.data.security} onChange={e => onChange({ type: 'wifi', data: { ...content.data, security: e.target.value as 'WPA' | 'WEP' | 'nopass', password: e.target.value === 'nopass' ? '' : content.data.password } })}><option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">None</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={content.data.hidden} onChange={e => update('hidden', e.target.checked)} />Hidden network</label><p className="text-sm text-gray-500">Credentials stay on this device unless you choose Save. A saved QR shares these credentials with your workspace.</p></>}
    {content.type === 'event' && <p className="text-sm text-gray-500">Times are local to the calendar importing this event. No time zone conversion is applied.</p>}
  </div>;
}
