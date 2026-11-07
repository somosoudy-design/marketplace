import { describe, expect, it } from 'vitest';
import { emailWebCallbackUrl, productionNativeEmailCallback } from '../src/email-auth-url';
const backend = 'https://mimnotafmfasvwrclxan.supabase.co';
describe('outbound production email callbacks', () => {
  it.each(['https://mayami.app', 'http://localhost:3200', 'http://127.0.0.1:8081', 'https://unexpected.invalid'])('MIM always uses the real web callback even from %s', origin => {
    const url = new URL(emailWebCallbackUrl(backend, origin, '/auth/callback?volver=%2Fcheckout&tipo=recuperar'));
    expect(url.origin).toBe('https://mayami.app'); expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('volver')).toBe('/checkout'); expect(url.searchParams.get('tipo')).toBe('recuperar');
  });
  it('allows loopback only when both the backend and client are explicitly local', () => {
    expect(emailWebCallbackUrl('http://127.0.0.1:55301', 'http://localhost:3200', '/auth/callback')).toBe('http://localhost:3200/auth/callback');
    expect(() => emailWebCallbackUrl('https://foreign.supabase.co', 'http://localhost:3200', '/auth/callback')).toThrow();
    expect(() => emailWebCallbackUrl('http://127.0.0.1:55301', 'https://mayami.app', '/auth/callback')).toThrow();
  });
  it.each(['//evil.invalid/auth/callback', '/missing', '/auth/callback?redirect_to=https://evil.invalid', '/auth/callback?tipo=signup', '/auth/callback?tipo=recuperar&tipo=recuperar', '/auth/callback#access_token=x'])('rejects undefined routes, redirect overrides and ambiguous purpose: %s', path => {
    expect(() => emailWebCallbackUrl(backend, 'https://mayami.app', path)).toThrow();
  });
  it('uses the installed APK scheme and distinct confirmation/recovery routes', () => {
    expect(productionNativeEmailCallback(backend, '/auth-callback')).toBe('kora://auth-callback');
    expect(productionNativeEmailCallback(backend, '/reset-password')).toBe('kora://reset-password');
    expect(() => productionNativeEmailCallback(backend, '/missing')).toThrow();
    expect(productionNativeEmailCallback('http://127.0.0.1:55301', '/auth-callback')).toBeNull();
  });
});
