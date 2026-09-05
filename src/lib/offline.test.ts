import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

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
      created_by: crypto.randomUUID(),
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
