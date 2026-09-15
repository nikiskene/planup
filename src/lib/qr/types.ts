export interface QRInputs {
  url: { url: string };
  text: { text: string };
  email: { email: string; subject: string; message: string };
  phone: { phone: string };
  whatsapp: { phone: string; message: string };
  wifi: { ssid: string; password: string; security: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };
  vcard: { firstName: string; lastName: string; company: string; title: string; phone: string; email: string; website: string; address: string };
  event: { title: string; startDate: string; startTime: string; endDate: string; endTime: string; location: string; description: string; url: string; uid: string; stamp: string };
}
export type QRType = keyof QRInputs;
export type QRContent = { [K in QRType]: { type: K; data: QRInputs[K] } }[QRType];
export interface QRConfiguration { foreground: string; background: string; margin: number; errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' }
export const defaultConfiguration: QRConfiguration = { foreground: '#000000', background: '#ffffff', margin: 4, errorCorrectionLevel: 'M' };
export const typeLabels: Record<QRType, string> = { url: 'Website', text: 'Text', email: 'Email', phone: 'Phone', whatsapp: 'WhatsApp', wifi: 'Wi-Fi', vcard: 'Contact', event: 'Event' };
export function emptyContent(type: QRType): QRContent {
  switch (type) {
    case 'url': return { type, data: { url: '' } };
    case 'text': return { type, data: { text: '' } };
    case 'email': return { type, data: { email: '', subject: '', message: '' } };
    case 'phone': return { type, data: { phone: '' } };
    case 'whatsapp': return { type, data: { phone: '', message: '' } };
    case 'wifi': return { type, data: { ssid: '', password: '', security: 'WPA', hidden: false } };
    case 'vcard': return { type, data: { firstName: '', lastName: '', company: '', title: '', phone: '', email: '', website: '', address: '' } };
    case 'event': return { type, data: { title: '', startDate: '', startTime: '', endDate: '', endTime: '', location: '', description: '', url: '', uid: crypto.randomUUID() + '@planup', stamp: new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') } };
  }
}
