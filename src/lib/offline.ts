import { openDB, type DBSchema } from 'idb';
import { supabase } from './supabase';

export type OfflineTable = 'tasks' | 'notes' | 'categories';
export type WritableOfflineTable = 'tasks' | 'notes';
export type OfflineOperation = 'insert' | 'update' | 'delete';

type Entity = Record<string, any> & {
  id: string;
  workspace_id: string;
  updated_at?: string;
};

interface CachedEntity {
  key: string;
  table: OfflineTable;
  workspaceId: string;
  value: Entity;
}

export interface PendingMutation {
  id: string;
  table: WritableOfflineTable;
  entityId: string;
  workspaceId: string;
  userId: string;
  operation: OfflineOperation;
  baseRecord: Entity | null;
  localRecord: Entity | null;
  createdAt: string;
}

interface PlanupOfflineDb extends DBSchema {
  entities: {
    key: string;
    value: CachedEntity;
    indexes: { 'by-table-workspace': [OfflineTable, string] };
  };
  mutations: {
    key: string;
    value: PendingMutation;
    indexes: { 'by-created-at': string };
  };
}

const dbPromise = openDB<PlanupOfflineDb>('planup-offline', 1, {
  upgrade(db) {
    const entities = db.createObjectStore('entities', { keyPath: 'key' });
    entities.createIndex('by-table-workspace', ['table', 'workspaceId']);
    const mutations = db.createObjectStore('mutations', { keyPath: 'id' });
    mutations.createIndex('by-created-at', 'createdAt');
  },
});

const entityKey = (table: OfflineTable, id: string) => `${table}:${id}`;

export async function cacheEntities(table: OfflineTable, workspaceId: string, rows: Entity[]) {
  const db = await dbPromise;
  const pending = (await db.getAll('mutations')).filter((item) => item.table === table && item.workspaceId === workspaceId);
  const tx = db.transaction('entities', 'readwrite');
  const existing = await tx.store.index('by-table-workspace').getAllKeys([table, workspaceId]);
  const incoming = new Set(rows.map((row) => entityKey(table, row.id)));
  const pendingKeys = new Set(pending.map((item) => entityKey(table, item.entityId)));
  await Promise.all(existing.filter((key) => !incoming.has(String(key)) && !pendingKeys.has(String(key))).map((key) => tx.store.delete(key)));
  await Promise.all(rows.map((value) => tx.store.put({ key: entityKey(table, value.id), table, workspaceId, value })));
  await Promise.all(pending.map((item) => item.operation === 'delete'
    ? tx.store.delete(entityKey(table, item.entityId))
    : item.localRecord
      ? tx.store.put({ key: entityKey(table, item.entityId), table, workspaceId, value: item.localRecord })
      : Promise.resolve()));
  await tx.done;
}

export async function getCachedEntities<T extends Entity>(table: OfflineTable, workspaceId: string): Promise<T[]> {
  const db = await dbPromise;
  const rows = await db.getAllFromIndex('entities', 'by-table-workspace', [table, workspaceId]);
  return rows.map((row) => row.value as T);
}

export async function getCachedEntity<T extends Entity>(table: OfflineTable, id: string): Promise<T | null> {
  const row = await (await dbPromise).get('entities', entityKey(table, id));
  return (row?.value as T) || null;
}

export async function saveLocalMutation(input: Omit<PendingMutation, 'id' | 'createdAt'>) {
  const db = await dbPromise;
  const tx = db.transaction(['entities', 'mutations'], 'readwrite');
  const queued = await tx.objectStore('mutations').getAll();
  const previous = queued.find((item) => item.table === input.table && item.entityId === input.entityId);

  if (previous && previous.operation === 'insert' && input.operation === 'delete') {
    await tx.objectStore('entities').delete(entityKey(input.table, input.entityId));
    await tx.objectStore('mutations').delete(previous.id);
    await tx.done;
    window.dispatchEvent(new Event('planup-sync-change'));
    return null;
  }

  const mutation: PendingMutation = previous
    ? {
        ...previous,
        operation: previous.operation === 'insert' ? 'insert' : input.operation,
        localRecord: input.localRecord,
      }
    : { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (input.operation === 'delete') {
    await tx.objectStore('entities').delete(entityKey(input.table, input.entityId));
  } else if (input.localRecord) {
    await tx.objectStore('entities').put({
      key: entityKey(input.table, input.entityId),
      table: input.table,
      workspaceId: input.workspaceId,
      value: input.localRecord,
    });
  }
  await tx.objectStore('mutations').put(mutation);
  await tx.done;
  window.dispatchEvent(new Event('planup-sync-change'));
  return mutation;
}

export async function pendingMutationCount() {
  return (await dbPromise).count('mutations');
}

export async function loadOfflineCollection<T extends Entity>(
  table: OfflineTable,
  workspaceId: string,
  fetchRemote: () => Promise<T[]>,
): Promise<T[]> {
  const cached = await getCachedEntities<T>(table, workspaceId);
  if (!navigator.onLine) return cached;
  try {
    const remote = await fetchRemote();
    await cacheEntities(table, workspaceId, remote);
    return getCachedEntities<T>(table, workspaceId);
  } catch (error) {
    if (cached.length) return cached;
    throw error;
  }
}

export async function createOfflineEntity<T extends Entity>(table: WritableOfflineTable, value: T, userId: string) {
  await saveLocalMutation({
    table,
    entityId: value.id,
    workspaceId: value.workspace_id,
    userId,
    operation: 'insert',
    baseRecord: null,
    localRecord: value,
  });
}

export async function updateOfflineEntity<T extends Entity>(table: WritableOfflineTable, base: T, patch: Partial<T>, userId: string) {
  const local = { ...base, ...patch, updated_at: new Date().toISOString() };
  await saveLocalMutation({
    table,
    entityId: base.id,
    workspaceId: base.workspace_id,
    userId,
    operation: 'update',
    baseRecord: base,
    localRecord: local,
  });
  return local;
}

export async function deleteOfflineEntity<T extends Entity>(table: WritableOfflineTable, base: T, userId: string) {
  await saveLocalMutation({
    table,
    entityId: base.id,
    workspaceId: base.workspace_id,
    userId,
    operation: 'delete',
    baseRecord: base,
    localRecord: null,
  });
}

function sameBaseVersion(remote: Entity, base: Entity | null) {
  if (!base) return false;
  if (remote.updated_at || base.updated_at) return remote.updated_at === base.updated_at;
  return JSON.stringify(remote) === JSON.stringify(base);
}

async function preserveConflict(mutation: PendingMutation, remote: Entity | null, reason: string) {
  const { error } = await (supabase as any).from('offline_lost_and_found').insert({
    workspace_id: mutation.workspaceId,
    user_id: mutation.userId,
    device_id: getDeviceId(),
    entity_table: mutation.table,
    entity_id: mutation.entityId,
    operation: mutation.operation,
    reason,
    base_record: mutation.baseRecord,
    local_record: mutation.localRecord,
    server_record: remote,
  } as any);
  if (error) throw error;
}

async function syncMutation(mutation: PendingMutation) {
  const table = (supabase as any).from(mutation.table);
  const { data: remote, error: readError } = await table
    .select('*')
    .eq('workspace_id', mutation.workspaceId)
    .eq('id', mutation.entityId)
    .maybeSingle();
  if (readError) throw readError;

  if (mutation.operation === 'insert') {
    if (remote) {
      await preserveConflict(mutation, remote as Entity, 'The same record ID already exists on the server.');
      return remote as Entity;
    }
    const { error } = await table.insert(mutation.localRecord as any);
    if (error) throw error;
    return mutation.localRecord;
  }

  if (!remote) {
    await preserveConflict(mutation, null, 'The server record was deleted while this device was offline.');
    return null;
  }

  if (!sameBaseVersion(remote as Entity, mutation.baseRecord)) {
    await preserveConflict(mutation, remote as Entity, 'The record changed on another device while this device was offline.');
    return remote as Entity;
  }

  if (mutation.operation === 'delete') {
    const { error } = await table.delete().eq('workspace_id', mutation.workspaceId).eq('id', mutation.entityId);
    if (error) throw error;
    return null;
  }

  const local = { ...(mutation.localRecord || {}) };
  delete local.id;
  delete local.created_at;
  const { data, error } = await table
    .update(local)
    .eq('workspace_id', mutation.workspaceId)
    .eq('id', mutation.entityId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Entity;
}

export async function syncPendingMutations() {
  if (!navigator.onLine) return { synced: 0, conflicts: 0 };
  const db = await dbPromise;
  const mutations = await db.getAllFromIndex('mutations', 'by-created-at');
  let synced = 0;
  let conflicts = 0;

  for (const mutation of mutations) {
    try {
      const result = await syncMutation(mutation);
      const tx = db.transaction(['entities', 'mutations'], 'readwrite');
      if (result) {
        await tx.objectStore('entities').put({
          key: entityKey(mutation.table, mutation.entityId),
          table: mutation.table,
          workspaceId: mutation.workspaceId,
          value: result,
        });
      } else {
        await tx.objectStore('entities').delete(entityKey(mutation.table, mutation.entityId));
      }
      await tx.objectStore('mutations').delete(mutation.id);
      await tx.done;
      synced += 1;
      if (result !== mutation.localRecord && mutation.operation !== 'delete') conflicts += 1;
    } catch (error) {
      console.warn('Offline mutation remains queued:', error);
      break;
    }
  }
  window.dispatchEvent(new Event('planup-sync-change'));
  return { synced, conflicts };
}

export function getDeviceId() {
  const key = 'planup_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function newLocalEntityId() {
  return crypto.randomUUID();
}
