import { planFromSearch, withPlan } from '@kora/core';
const base = 'https://mayami.invalid';
export function safeReturnPath(input: string | null | undefined, fallback = '/cuenta'): string {
  if (!input || input.length > 4096 || !input.startsWith('/') || input.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(input)) return fallback;
  try {
    const url = new URL(input, base);
    const authKeys = new Set(['access_token', 'refresh_token', 'code', 'token_hash', 'provider_token', 'provider_refresh_token', 'id_token']);
    if (url.hash || [...url.searchParams.keys()].some(key => authKeys.has(key.toLowerCase()))) return fallback;
    if (url.origin !== base || url.pathname.startsWith('/auth/') || url.pathname === '/registro' || url.pathname === '/recuperar') return fallback;
    let decoded = url.pathname;
    for (let i = 0; i < 8; i++) {
      if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return fallback;
      const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next;
      if (i === 7) return fallback;
    }
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return fallback;
    const resolved = new URL(decoded, base);
    if (resolved.origin !== base || resolved.pathname.startsWith('/auth/') || resolved.pathname === '/registro' || resolved.pathname === '/recuperar') return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}
export function authHref(path: '/cuenta' | '/registro' | '/recuperar', back: string) {
  return `${path}?volver=${encodeURIComponent(safeReturnPath(back))}`;
}
export function guestReturnPath(back: string) {
  const safe = safeReturnPath(back);
  const pathname = new URL(safe, base).pathname;
  if (pathname === '/cuenta') return '/buscar';
  return pathname === '/checkout' ? withPlan('/carrito', planFromSearch(new URL(safe, base).searchParams)) : safe;
}
export function callbackPath(back: string, recovery = false) {
  const params = new URLSearchParams({ volver: safeReturnPath(back) });
  if (recovery) params.set('tipo', 'recuperar');
  return '/auth/callback?' + params;
}
