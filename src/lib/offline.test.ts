import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ userId: 'user' as string | null }));
vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: auth.userId ? { user: { id: auth.userId }, access_token: 'test-token' } : null } }) } },
  createSessionClient: vi.fn(() => { throw new Error('Network client must not be created while signed out'); }),
}));

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
});

describe('offline mutation queue', () => {
  it('keeps a new item locally and cancels it cleanly when deleted before sync', async () => {
    const offline = await import('./offline');
    const now = new Date().toISOString();
    const note = {
      id: crypto.randomUUID(),
      workspace_id: crypto.randomUUID(),
      headline: 'Flight note',
      body: 'Saved without a connection',
      category_id: null,
      task_id: null,
      created_by: 'user',
      created_at: now,
      updated_at: now,
    };

    await offline.createOfflineEntity('notes', note, note.created_by);
    expect(await offline.getCachedEntity('notes', note.id)).toMatchObject(note);
    expect(await offline.pendingMutationCount()).toBe(1);

    await offline.deleteOfflineEntity('notes', note, note.created_by);
    expect(await offline.getCachedEntity('notes', note.id)).toBeNull();
    expect(await offline.pendingMutationCount()).toBe(0);
  });

  it('coalesces repeated offline edits into one queued mutation', async () => {
    const offline = await import('./offline');
    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      workspace_id: crypto.randomUUID(),
      title: 'Original',
      updated_at: now,
    };
    await offline.cacheEntities('tasks', task.workspace_id, [task]);
    const first = await offline.updateOfflineEntity('tasks', task, { title: 'First' }, 'user');
    await offline.updateOfflineEntity('tasks', first, { title: 'Final' }, 'user');

    expect(await offline.pendingMutationCount()).toBe(1);
    expect(await offline.getCachedEntity<typeof task>('tasks', task.id)).toMatchObject({ title: 'Final' });
  });
});


describe('account separation', () => {
  it('does not reveal another account’s cached records or queued edits in the same workspace', async () => {
    const offline = await import('./offline');
    const note = { id: crypto.randomUUID(), workspace_id: 'shared', body: 'Private offline draft' };
    auth.userId = 'alice';
    await offline.createOfflineEntity('notes', note, 'alice');
    expect(await offline.pendingMutationCount()).toBe(1);
    auth.userId = 'bob';
    expect(await offline.getCachedEntity('notes', note.id)).toBeNull();
    expect(await offline.getCachedEntities('notes', 'shared')).toEqual([]);
    expect(await offline.pendingMutationCount()).toBe(0);
    await offline.cacheEntities('notes', 'shared', [{ ...note, body: 'Server version for Bob' }]);
    await offline.updateOfflineEntity('notes', { ...note, body: 'Server version for Bob' }, { body: 'Bob edit' }, 'bob');
    auth.userId = 'alice';
    expect(await offline.getCachedEntity('notes', note.id)).toMatchObject({ body: 'Private offline draft' });
    expect(await offline.pendingMutationCount()).toBe(1);
    await expect(offline.updateOfflineEntity('notes', note, { body: 'Wrong account' }, 'bob')).rejects.toThrow('account changed');
  });

  it('rejects remote results that finish after an account switch', async () => {
    const offline = await import('./offline');
    auth.userId = 'alice';
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    await expect(offline.loadOfflineCollection('notes', 'shared', async () => {
      auth.userId = 'bob';
      return [{ id: 'late', workspace_id: 'shared', body: 'Alice response' }];
    })).rejects.toThrow('account changed');
    expect(await offline.getCachedEntity('notes', 'late')).toBeNull();
  });

  it('never uploads or exposes a queue when signed out', async () => {
    const offline = await import('./offline');
    auth.userId = null;
    expect(await offline.pendingMutationCount()).toBe(0);
    expect(await offline.getCachedEntities('notes', 'shared')).toEqual([]);
    expect(await offline.syncPendingMutations()).toEqual({ synced: 0, conflicts: 0 });
  });

  it('preserves legacy queued work while hiding cache entries with unknown ownership', async () => {
    const { openDB } = await import('idb');
    const offline = await import('./offline');
    const db = await openDB('planup-offline', 1);
    const note = { id: 'legacy-note', workspace_id: 'legacy-workspace', body: 'Unsynced legacy draft' };
    await db.put('entities', { key: 'notes:legacy-note', table: 'notes', workspaceId: note.workspace_id, value: note });
    await db.put('mutations', { id: 'legacy-mutation', table: 'notes', entityId: note.id, workspaceId: note.workspace_id, userId: 'legacy-owner', operation: 'insert', localRecord: note, baseRecord: null, createdAt: new Date().toISOString() });
    auth.userId = 'bob';
    expect(await offline.getCachedEntities('notes', note.workspace_id)).toEqual([]);
    auth.userId = 'legacy-owner';
    expect(await offline.getCachedEntities('notes', note.workspace_id)).toEqual([note]);
    expect(await db.get('entities', 'notes:legacy-note')).toBeTruthy();
    db.close();
  });
});

describe('sync account ownership', () => {
  it('syncs only the signed-in author and pins in-flight work to the original client', async () => {
    const offline = await import('./offline');
    const { createSessionClient } = await import('./supabase');
    const first = { id: 'sync-first', workspace_id: 'sync-workspace', body: 'First account' };
    const other = { id: 'sync-other', workspace_id: 'sync-workspace', body: 'Other account' };
    auth.userId = 'sync-owner';
    await offline.createOfflineEntity('notes', first, 'sync-owner');
    auth.userId = 'other-owner';
    await offline.createOfflineEntity('notes', other, 'other-owner');
    const insert = vi.fn(async () => ({ error: null }));
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => {
        // Another tab changes the active account while the original request runs.
        auth.userId = 'other-owner';
        return { data: null, error: null };
      },
      insert,
    };
    vi.mocked(createSessionClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createSessionClient>);
    auth.userId = 'sync-owner';
    expect(await offline.syncPendingMutations()).toEqual({ synced: 1, conflicts: 0 });
    expect(createSessionClient).toHaveBeenLastCalledWith('test-token');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(first);
    expect(await offline.pendingMutationCount()).toBe(1);
    expect(await offline.getCachedEntity('notes', other.id)).toMatchObject(other);
    auth.userId = 'sync-owner';
    expect(await offline.pendingMutationCount()).toBe(0);
    expect(await offline.getCachedEntity('notes', first.id)).toMatchObject(first);
  });
});
