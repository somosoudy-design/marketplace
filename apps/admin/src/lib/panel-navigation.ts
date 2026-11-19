const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function validStoreId(value: string | null): value is string {
  return !!value && uuid.test(value);
}

// Only local panel pages and their known query fields survive authentication.
export function safePanelReturn(raw: string | null): string | null {
  if (!raw || !/^\/(admin|vendedor)(?:\/[a-z0-9-]+)*\/?(?:\?|$)/.test(raw) || raw.includes('\\') || raw.includes('#')) return null;
  const url = new URL(raw, 'https://panel.mayami.app');
  if (url.origin !== 'https://panel.mayami.app') return null;
  const result = new URLSearchParams();
  if (url.searchParams.has('id') && (url.searchParams.getAll('id').length !== 1 || !validStoreId(url.searchParams.get('id')))) {
    return '/sin-acceso';
  }
  for (const [name, value] of url.searchParams) {
    if (name === 'id' && validStoreId(value)) result.set(name, value);
    else if (name === 'tab' && /^[a-z0-9-]{1,40}$/.test(value)) result.set(name, value);
  }
  return url.pathname + (result.size ? '?' + result : '');
}

export function panelLoginPath(location: { pathname: string; search: string }): string {
  const target = safePanelReturn(location.pathname + location.search);
  return target ? '/login?returnTo=' + encodeURIComponent(target) : '/login';
}

export function selectedStore<T extends {id: string}>(stores: T[], requested: string | null, preferred: string | null): T | null {
  if (requested !== null) return validStoreId(requested) ? stores.find(store => store.id === requested) ?? null : null;
  return stores.find(store => store.id === preferred) ?? stores[0] ?? null;
}
