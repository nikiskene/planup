import type { QRContent, QRInputs } from './types';
const required = (value: string, label: string) => { if (!value.trim()) throw new Error(`Enter ${label}.`); return value; };
export function buildUrlPayload(value: string): string {
  let url = required(value.trim(), 'a destination');
  if (/\s/.test(url)) throw new Error('Enter a URL without spaces.');
  if (!/^[a-z][a-z\d+.-]*:/i.test(url) || /^[^/:]+\.\w+:\d+(\/|$)/.test(url)) url = `https://${url}`;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Enter a valid URL.'); }
  if (!['https:', 'http:', 'mailto:', 'tel:', 'sms:', 'geo:', 'facetime:', 'maps:'].includes(parsed.protocol)) throw new Error('Use a web URL or a supported phone, email, or map link.');
  if (['https:', 'http:'].includes(parsed.protocol) && (!parsed.hostname || parsed.username || parsed.password)) throw new Error('Enter a web URL without embedded login details.');
  return url;
}
export const buildTextPayload = (text: string) => { if (!text.length) throw new Error('Enter some text.'); return text; };
export function buildEmailPayload(data: QRInputs['email']) {
  const email = required(data.email.trim(), 'an email address');
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) throw new Error('Enter a valid email address.');
  const params = [data.subject && `subject=${encodeURIComponent(data.subject)}`, data.message && `body=${encodeURIComponent(data.message)}`].filter(Boolean);
  return `mailto:${email}${params.length ? '?' + params.join('&') : ''}`;
}
export function buildPhonePayload(phone: string) {
  required(phone, 'a phone number');
  if (!/^\+?[\d ().-]+$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 3) throw new Error('Enter a valid phone number.');
  return `tel:${phone.trim()}`;
}
export function buildWhatsAppPayload(data: QRInputs['whatsapp']) {
  buildPhonePayload(data.phone);
  const number = data.phone.replace(/\D/g, '').replace(/^00/, '');
  if (!/^[1-9]\d{5,14}$/.test(number)) throw new Error('Include the international country code.');
  return `https://wa.me/${number}${data.message ? '?text=' + encodeURIComponent(data.message) : ''}`;
}
export const escapeWifi = (value: string) => value.replace(/([\\;,:"“”])/g, '\\$1');
export function buildWifiPayload(data: QRInputs['wifi']) {
  required(data.ssid, 'a network name');
  if (data.security !== 'nopass') required(data.password, 'a network password');
  return `WIFI:T:${data.security};S:${escapeWifi(data.ssid)};${data.security === 'nopass' ? '' : `P:${escapeWifi(data.password)};`}H:${data.hidden};;`;
}
export const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
// Fold at 75 UTF-8 octets, without splitting a multi-byte character.
export function foldLine(line: string) {
  let result = '', width = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (width + size > 75) { result += '\r\n '; width = 1; }
    result += char; width += size;
  }
  return result;
}
const lines = (values: string[]) => values.filter(Boolean).map(foldLine).join('\r\n') + '\r\n';
export function buildVCardPayload(data: QRInputs['vcard']) {
  const name = required([data.firstName, data.lastName].filter(Boolean).join(' '), 'a contact name');
  return lines(['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeText(data.lastName)};${escapeText(data.firstName)};;;`, `FN:${escapeText(name)}`,
    data.company && `ORG:${escapeText(data.company)}`, data.title && `TITLE:${escapeText(data.title)}`,
    data.phone && `TEL:${escapeText(data.phone)}`, data.email && `EMAIL:${escapeText(data.email)}`,
    data.website && `URL:${buildUrlPayload(data.website)}`, data.address && `ADR:;;${escapeText(data.address)};;;;`, 'END:VCARD']);
}
export function calendarDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Enter the event dates and times.');
  const parsed = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== `${date}T${time}`) throw new Error('Enter valid event dates and times.');
  return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
}
export function buildCalendarPayload(data: QRInputs['event']) {
  required(data.title, 'an event title');
  const start = calendarDate(data.startDate, data.startTime), end = calendarDate(data.endDate, data.endTime);
  if (end <= start) throw new Error('The event end must be after its start.');
  return lines(['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PlanUp//QR Codes//EN', 'BEGIN:VEVENT',
    `UID:${escapeText(data.uid)}`, `DTSTAMP:${data.stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${escapeText(data.title)}`,
    data.location && `LOCATION:${escapeText(data.location)}`, data.description && `DESCRIPTION:${escapeText(data.description)}`,
    data.url && `URL:${buildUrlPayload(data.url)}`, 'END:VEVENT', 'END:VCALENDAR']);
}
export function buildPayload(content: QRContent): string {
  switch (content.type) {
    case 'url': return buildUrlPayload(content.data.url);
    case 'text': return buildTextPayload(content.data.text);
    case 'email': return buildEmailPayload(content.data);
    case 'phone': return buildPhonePayload(content.data.phone);
    case 'whatsapp': return buildWhatsAppPayload(content.data);
    case 'wifi': return buildWifiPayload(content.data);
    case 'vcard': return buildVCardPayload(content.data);
    case 'event': return buildCalendarPayload(content.data);
  }
}
