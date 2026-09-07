import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }));
import { allRows } from './data';
describe('complete workspace pagination', () => {
  beforeEach(() => mocks.from.mockReset());
  it('continues after short server pages until an empty page, with workspace and cursor filters', async () => {
    const pages = [[{ id: 'a' }], [{ id: 'b' }], []];
    const eq = vi.fn(); const gt = vi.fn();
    mocks.from.mockImplementation(() => {
      const result = { data: pages.shift(), error: null };
      const query = { select: () => query, eq: (...args: unknown[]) => { eq(...args); return query; },
        order: () => query, limit: () => query, gt: (...args: unknown[]) => { gt(...args); return query; },
        then: (resolve: (value: typeof result) => void) => resolve(result) };
      return query;
    });
    expect(await allRows('crm_contacts', 'id', 'workspace-a')).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(eq).toHaveBeenCalledWith('workspace_id', 'workspace-a');
    expect(gt.mock.calls).toEqual([['id', 'a'], ['id', 'b']]);
  });
  it('fails the entire load instead of returning a partial attention list', async () => {
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: null, error: new Error('Denied') }) };
    mocks.from.mockReturnValue(query);
    await expect(allRows('crm_contacts', 'id', 'w')).rejects.toThrow('Denied');
  });
});
