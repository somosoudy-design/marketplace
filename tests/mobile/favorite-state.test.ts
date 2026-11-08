import { describe, expect, it } from 'vitest';
import { favoriteState } from '../../packages/api/src/favorite-state';
const a = { product_id: 'a', created_at: '2026-11-04T10:00:00Z' };
const b = { product_id: 'b', created_at: '2026-11-04T11:00:00Z' };
const c = { product_id: 'c', created_at: '2026-11-04T12:00:00Z' };
describe('favorite rollback with concurrent products', () => {
  it('a failed save does not undo a different product saved in parallel', () => {
    const optimistic = favoriteState(favoriteState([], a.product_id, a), b.product_id, b);
    expect(favoriteState(optimistic, a.product_id, null)).toEqual([b]);
  });
  it('a failed removal restores its original timestamp without replacing newer saves', () => {
    const removed = favoriteState([b, a], a.product_id, null);
    const anotherSave = favoriteState(removed, c.product_id, c);
    expect(favoriteState(anotherSave, a.product_id, a)).toEqual([c, b, a]);
  });
  it('a retry preserves a single entry and leaves unrelated favorites unchanged', () => {
    expect(favoriteState(favoriteState([b], a.product_id, a), a.product_id, a)).toEqual([b, a]);
  });
});
