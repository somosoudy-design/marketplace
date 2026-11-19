import { describe, expect, it } from 'vitest';
import { MAYAMI_STORE_ID, publicStorePath, resolvePublicStore } from '../src/store-link';

const official = { id: MAYAMI_STORE_ID, slug: 'kora' };
const merchant = { id: 'merchant', slug: 'cora' };
const lookup = (rows: typeof official[]) => async (slug: string) => rows.find(row => row.slug === slug) ?? null;

describe('public store links', () => {
  it('shares the official store by identity and preserves an independent store verbatim', () => {
    expect(publicStorePath(official)).toBe('/tienda/mayami');
    expect(publicStorePath(merchant)).toBe('/tienda/cora');
    expect(publicStorePath({ id: 'another', slug: 'a/b' })).toBe('/tienda/a%2Fb');
  });
  it.each(['mayami', 'kora', 'cora'])('resolves %s to the same stored identity', async slug => {
    expect(await resolvePublicStore(slug, lookup([official]))).toEqual(official);
  });
  it('never maps a live third-party slug to the official store or substitutes a foreign fallback', async () => {
    expect(await resolvePublicStore('cora', lookup([official, merchant]))).toEqual(merchant);
    expect(await resolvePublicStore('mayami', lookup([{ id: 'another', slug: 'kora' }]))).toBeNull();
    expect(await resolvePublicStore('unknown', lookup([official]))).toBeNull();
  });
});
