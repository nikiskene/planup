import { expect, it, vi } from 'vitest';
import { sentEmail } from './sent-email';
it('recovers hidden BCCs from the original sent email and keeps the body', async () => {
  const request = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'test' }))
    .mockResolvedValueOnce(Response.json({ value: [{ internetMessageId: '<original>', bccRecipients: [{ emailAddress: { address: 'hidden@example.test' } }], subject: 'Sent subject' }] }));
  const result = await sentEmail({ Headers: [{ Name: 'Message-ID', Value: '<original>' }], TextBody: 'Full body' }, 'sender@example.test', { tenant: 'test', client: 'test', secret: 'test' }, request);
  expect(result.BccFull).toEqual([{ Email: 'hidden@example.test', Name: undefined }]);
  expect(result.TextBody).toBe('Full body');
});
it('fails retryably if the original sent item is not available', async () => {
  const request = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'test' }))
    .mockResolvedValueOnce(Response.json({ value: [] }));
  await expect(sentEmail({ Headers: [{ Name: 'Message-ID', Value: '<original>' }] }, 'sender@example.test', { tenant: 'test', client: 'test', secret: 'test' }, request)).rejects.toThrow('not available yet');
});
