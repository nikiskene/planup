import { describe, expect, it } from 'vitest';
import { captureMessage } from './email-capture';
const sample = {
  FromFull: { Email: 'NS@iacy.com' }, OriginalRecipient: 'niki@wrxs.cc',
  MessageID: 'provider-1', Headers: [{ Name: 'Message-ID', Value: '<original-1@example.test>' }],
  ToFull: [{ Email: 'person@example.test', Name: 'Test Person' }],
  CcFull: [{ Email: 'PERSON@example.test' }, { Email: 'ns@iacy.com' }],
  BccFull: [{ Email: 'niki@wrxs.cc' }, { Email: 'bcc@example.test' }],
  Subject: 'hello', TextBody: 'body', Date: '2026-10-30T18:00:00Z',
};
describe('WRXS capture envelope', () => {
  it('routes an envelope BCC and preserves all supplied recipients without duplicate/self/capture contacts', async () => {
    const result = await captureMessage(sample);
    expect(result?.recipient).toBe('niki@wrxs.cc');
    expect(result?.sender).toBe('ns@iacy.com');
    expect(result?.people.map(p => p.email)).toEqual(['person@example.test', 'bcc@example.test']);
    expect(result?.message_id).toBe('<original-1@example.test>');
    expect(result?.event_id).toBe('provider-1');
  });
  it('never treats the retired domain as a capture destination', async () => {
    expect(await captureMessage({ ...sample, OriginalRecipient: 'crm@iacy.com', BccFull: [] })).toBeNull();
  });
  it('finds the capture address in BccFull when the envelope has a provider address', async () => {
    expect((await captureMessage({ ...sample, OriginalRecipient: 'route@inbound.postmarkapp.com' }))?.recipient).toBe('niki@wrxs.cc');
  });
  it('deduplicates stable payloads without provider identifiers', async () => {
    const payload = { ...sample, MessageID: '', Headers: [] };
    expect((await captureMessage(payload))?.event_id).toBe((await captureMessage(payload))?.event_id);
  });
});
