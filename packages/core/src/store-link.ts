/** The existing database slug is retained for installed clients and historical records. */
export const MAYAMI_STORE_ID = '5afbabbf-0678-40ee-a5d8-540f53efe114';
const officialSlug = 'mayami';
const historicalSlug = 'kora';

type StoreRoute = { id?: string; slug: string };

export function publicStoreSlug(store: StoreRoute): string {
  return store.id === MAYAMI_STORE_ID ? officialSlug : store.slug;
}

export function publicStorePath(store: StoreRoute): string {
  return '/tienda/' + encodeURIComponent(publicStoreSlug(store));
}

export function isOfficialStoreAlias(slug: string): boolean {
  return slug === officialSlug || slug === 'cora' || slug === historicalSlug;
}

/** An exact record takes precedence. An alias fallback must match the real platform store ID. */
export async function resolvePublicStore<T extends StoreRoute>(slug: string, read: (slug: string) => Promise<T | null>): Promise<T | null> {
  const exact = await read(slug);
  if (exact || !isOfficialStoreAlias(slug) || slug === historicalSlug) return exact;
  const candidate = await read(historicalSlug);
  return candidate?.id === MAYAMI_STORE_ID ? candidate : null;
}
