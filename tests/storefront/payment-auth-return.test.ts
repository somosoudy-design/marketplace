import { describe, expect, it } from 'vitest';
import { authHref, callbackPath, guestReturnPath, safeReturnPath } from '../../apps/storefront/src/lib/auth-return';

describe('web payment preference through authentication', () => {
  it('preserves checkout preference inside login, registration and callback destinations', () => {
    for (const route of ['/cuenta', '/registro'] as const) {
      const url = new URL(authHref(route, '/checkout?plan=three_parts'), 'https://mayami.invalid');
      expect(url.searchParams.get('volver')).toBe('/checkout?plan=three_parts');
    }
    expect(new URL(callbackPath('/checkout?plan=three_parts'), 'https://mayami.invalid').searchParams.get('volver')).toBe('/checkout?plan=three_parts');
  });
  it('returns a cancelled checkout to guest cart with only the sanitized plan', () => {
    expect(guestReturnPath('/checkout?variant=private-looking-value&plan=three_parts&other=discard')).toBe('/carrito?plan=three_parts');
  });
  it.each(['/checkout?plan=three_parts&plan=full', '/checkout?plan=', '/checkout?plan=%2Fexternal'])('discards invalid or repeated preferences: %s', path => {
    expect(guestReturnPath(path)).toBe('/carrito');
  });
  it('retains protection against auth tokens, hashes and outside return URLs', () => {
    for (const path of ['/checkout?access_token=discard', '/checkout#token', '//outside.invalid/checkout']) {
      expect(safeReturnPath(path)).toBe('/cuenta');
      expect(guestReturnPath(path)).toBe('/buscar');
    }
  });
  it('keeps recovery purpose separate from the nested payment preference', () => {
    const url = new URL(callbackPath('/checkout?plan=three_parts', true), 'https://mayami.invalid');
    expect(url.searchParams.get('tipo')).toBe('recuperar');
    expect(url.searchParams.get('volver')).toBe('/checkout?plan=three_parts');
  });
});
