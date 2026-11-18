const platformStoreId = '5afbabbf-0678-40ee-a5d8-540f53efe114';

export function storeDisplayName(store: { id?: string; name: string }) {
  return store.id === platformStoreId ? 'MAYAMI' : store.name;
}

export function hasOfficialSeal(store: { kind?: string | null; status?: string | null }) {
  return store.kind === 'platform' && (!store.status || store.status === 'active');
}

export function isLegacyOfficialCover(store: { id: string; cover_path: string | null }) {
  return store.id === platformStoreId && store.cover_path === 'demo/kora-cover.webp';
}
