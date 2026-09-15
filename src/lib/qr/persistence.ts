import { supabase } from '../supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyContent, type QRContent, type QRConfiguration, type QRType, typeLabels } from './types';
import type { Json } from '../types';
export type QRRecord = {
  id: string; workspace_id: string; created_by: string; name: string; type: string;
  payload: string; input_data: Json; configuration: Json;
  source_type: string | null; source_id: string | null;
  created_at: string; updated_at: string;
}
// The legacy Database declaration does not satisfy the current SDK schema contract.
// Narrow the existing authenticated client at this boundary; no second auth client.
type QRDatabase = { public: { Tables: { qr_codes: {
  Row: QRRecord;
  Insert: Omit<QRRecord, 'id' | 'created_at' | 'updated_at' | 'source_type' | 'source_id'>;
  Update: Partial<Pick<QRRecord, 'name' | 'type' | 'payload' | 'input_data' | 'configuration'>>;
  Relationships: [];
} }; Views: Record<string, never>; Functions: Record<string, never> } };
const qrClient = supabase as unknown as SupabaseClient<QRDatabase>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved QR');
  return value as Record<string, unknown>;
}
export function restore(record: QRRecord): { content: QRContent; config: QRConfiguration } {
  if (!Object.prototype.hasOwnProperty.call(typeLabels, record.type)) throw new Error('Unsupported QR type');
  const data = object(record.input_data), expected = emptyContent(record.type as QRType);
  for (const [key, value] of Object.entries(expected.data)) if (typeof data[key] !== typeof value) throw new Error('Invalid saved form');
  if (record.type === 'wifi' && !['WPA', 'WEP', 'nopass'].includes(String(data.security))) throw new Error('Invalid security');
  const config = object(record.configuration);
  if (![config.foreground, config.background].every(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) || ![0, 1, 2, 3, 4, 6, 8].includes(Number(config.margin)) || !['L', 'M', 'Q', 'H'].includes(String(config.errorCorrectionLevel))) throw new Error('Invalid QR configuration');
  return { content: { type: record.type, data } as QRContent, config: config as unknown as QRConfiguration };
}
export async function listQR(workspaceId: string) {
  const records: QRRecord[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await qrClient.from('qr_codes').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
    if (error) throw error;
    records.push(...data);
    if (data.length < 100) return records;
  }
}
export async function saveQR(workspaceId: string, userId: string, name: string, content: QRContent, config: QRConfiguration, payload: string, previous: QRRecord | null) {
  const values = { name: name.trim() || 'Untitled QR', type: content.type, input_data: content.data as Json, configuration: { ...config }, payload };
  const query = previous ? qrClient.from('qr_codes').update(values).eq('id', previous.id).eq('workspace_id', workspaceId).eq('updated_at', previous.updated_at) : qrClient.from('qr_codes').insert({ ...values, workspace_id: workspaceId, created_by: userId });
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
export async function deleteQR(record: QRRecord) {
  const { data, error } = await qrClient.from('qr_codes').delete().eq('id', record.id).eq('workspace_id', record.workspace_id).eq('updated_at', record.updated_at).select('id').single();
  if (error || !data) throw error || new Error('Record changed');
}
