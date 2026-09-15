import { describe, expect, it } from 'vitest';
import { buildPayload, buildUrlPayload, buildEmailPayload, buildPhonePayload, buildWhatsAppPayload, buildWifiPayload, buildVCardPayload, buildCalendarPayload, calendarDate, foldLine } from './payloads';
import { generateSvg } from './generator';
import { defaultConfiguration, emptyContent } from './types';
import { filename } from './download';
describe('QR payloads', () => {
  it('normalizes domains while preserving paths, query and fragments', () => {
    expect(buildUrlPayload(' iacy.com/path?q=a%20b#here ')).toBe('https://iacy.com/path?q=a%20b#here');
    expect(buildUrlPayload('http://localhost:3000/a')).toBe('http://localhost:3000/a');
    expect(buildUrlPayload('example.com:8080/a')).toBe('https://example.com:8080/a');
    expect(buildUrlPayload('tel:+431234567')).toBe('tel:+431234567');
  });
  it.each(['javascript:alert(1)', 'data:text/html,hi', 'vbscript:foo', 'https://', 'https://user:pass@example.com', 'bad url'])('rejects unsafe or invalid URLs: %s', value => expect(() => buildUrlPayload(value)).toThrow());
  it('keeps exact multiline text', () => expect(buildPayload({ type: 'text', data: { text: '  Hi\n世界\n' } })).toBe('  Hi\n世界\n'));
  it('encodes mailto parameters', () => {
    expect(buildEmailPayload({ email: 'a@example.com', subject: 'A & B', message: 'Hi\n世界' })).toBe('mailto:a@example.com?subject=A%20%26%20B&body=Hi%0A%E4%B8%96%E7%95%8C');
    expect(() => buildEmailPayload({ email: 'wrong', subject: '', message: '' })).toThrow();
  });
  it('preserves phone formatting', () => expect(buildPhonePayload('+43 (664) 123-4567')).toBe('tel:+43 (664) 123-4567'));
  it('normalizes WhatsApp international numbers', () => {
    expect(buildWhatsAppPayload({ phone: '+43 (664) 123-4567', message: 'Hello & hi' })).toBe('https://wa.me/436641234567?text=Hello%20%26%20hi');
    expect(buildWhatsAppPayload({ phone: '0043 6641234567', message: '' })).toBe('https://wa.me/436641234567');
    expect(() => buildWhatsAppPayload({ phone: '06641234567', message: '' })).toThrow();
  });
  it('escapes Wi-Fi punctuation and backslashes', () => {
    expect(buildWifiPayload({ ssid: 'A;B:C,D"E\\F', password: 'p;:“”', security: 'WPA', hidden: true })).toBe('WIFI:T:WPA;S:A\\;B\\:C\\,D\\"E\\\\F;P:p\\;\\:\\“\\”;H:true;;');
    expect(buildWifiPayload({ ssid: 'Open', password: 'not included', security: 'nopass', hidden: false })).toBe('WIFI:T:nopass;S:Open;H:false;;');
  });
  it('produces escaped vCard with no injected properties', () => {
    const card = buildVCardPayload({ firstName: 'Ada', lastName: 'Love;lace', company: 'A,B', title: '', phone: '', email: '', website: '', address: 'Street\nCity' });
    expect(card).toContain('VERSION:3.0\r\nN:Love\\;lace;Ada;;;\r\nFN:Ada Love\\;lace');
    expect(card).toContain('ORG:A\\,B'); expect(card).toContain('ADR:;;Street\\nCity;;;;'); expect(card).not.toContain('EMAIL:');
  });
  it('uses floating calendar dates and checks ranges', () => {
    const event = { title: 'Hello; world', startDate: '2026-09-15', startTime: '10:00', endDate: '2026-09-15', endTime: '11:00', location: 'A,B', description: 'Line\nNext', url: '', uid: 'test@planup', stamp: '20260915T080000Z' };
    const payload = buildCalendarPayload(event);
    expect(payload).toContain('DTSTART:20260915T100000\r\n'); expect(payload).toContain('DTEND:20260915T110000\r\n'); expect(payload).toContain('SUMMARY:Hello\\; world');
    expect(payload).toContain('UID:test@planup'); expect(payload).toContain('DTSTAMP:20260915T080000Z');
    expect(() => buildCalendarPayload({ ...event, endTime: '09:00' })).toThrow();
    expect(() => calendarDate('2026-02-30', '10:00')).toThrow();
    expect(() => calendarDate('2026-09-15', '25:00')).toThrow();
  });
  it('folds long Unicode lines at UTF-8 boundaries', () => {
    const original = 'DESCRIPTION:' + '世界'.repeat(60), folded = foldLine(original);
    expect(folded.replace(/\r\n /g, '')).toBe(original);
    expect(folded.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it('rejects empty input for every type', () => { for (const type of ['url', 'text', 'email', 'phone', 'whatsapp', 'wifi', 'vcard', 'event'] as const) expect(() => buildPayload(emptyContent(type))).toThrow(); });
  it('creates real vector output and rejects oversized content', async () => {
    const svg = await generateSvg('https://example.com', defaultConfiguration);
    expect(svg).toContain('<svg'); expect(svg).toContain('<path'); expect(svg).not.toContain('<image');
    await expect(generateSvg('a'.repeat(10000), defaultConfiguration)).rejects.toThrow();
  });
  it('sanitizes export filenames', () => expect(filename('../../My QR / 2026')).toBe('my-qr-2026-qr'));
});
