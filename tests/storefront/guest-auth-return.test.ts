import { describe, expect, it } from 'vitest';
import { authHref, callbackPath, guestReturnPath, safeReturnPath } from '../../apps/storefront/src/lib/auth-return';
describe('guest auth return', () => {
  it.each(['/carrito', '/checkout', '/p/producto?variant=chosen', '/buscar?q=100%25', '/pedidos/id'])('preserves an internal destination %s', path => expect(safeReturnPath(path)).toBe(path));
  it.each(['https://other.invalid', '//other.invalid', '/\\other.invalid', '/%5cother.invalid', '/%2fother.invalid', '/%252fother.invalid', '/%00x', '/%ZZ', '/auth/callback?code=value', '/auth%2fcallback', '/reg%69stro', '/x/%252e%252e/auth/callback', '/registro?volver=/carrito', '/recuperar'])('rejects an unsafe or recursive destination %s', path => expect(safeReturnPath(path)).toBe('/cuenta'));
  it.each(['/p/item#stock', '/p/item#access_token=ignored', '/p/item?access_token=ignored', '/p/item?refresh_token=ignored', '/p/item?code=ignored', '/p/item?token_hash=ignored', '/p/item?provider_token=ignored', '/p/item?%61ccess_token=ignored'])('rejects anchors and session credentials in a return path %s', path => expect(safeReturnPath(path)).toBe('/cuenta'));
  it('keeps a visitor out of an auth loop when cancelling checkout', () => { expect(guestReturnPath('/checkout')).toBe('/carrito'); expect(guestReturnPath('/cuenta')).toBe('/buscar'); expect(guestReturnPath('/cuenta?foo=1')).toBe('/buscar'); expect(guestReturnPath('/p/item?variant=chosen')).toBe('/p/item?variant=chosen'); });
  it('carries the same destination through signup, login and email callback without storing credentials', () => {
    const back = '/p/item?variant=chosen';
    for (const path of ['/cuenta', '/registro', '/recuperar'] as const) expect(new URL(authHref(path, back), 'https://mayami.invalid').searchParams.get('volver')).toBe(back);
    const callback = new URL(callbackPath(back, true), 'https://mayami.invalid'); expect(callback.pathname).toBe('/auth/callback'); expect(callback.searchParams.get('volver')).toBe(back); expect(callback.searchParams.get('tipo')).toBe('recuperar');
  });
});
