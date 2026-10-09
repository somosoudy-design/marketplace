import { describe, expect, it } from 'vitest';
import { authErrorKind, authErrorMessage, base64Decode, base64Encode, otpDigits, sealedPlaintext, utf8Decode, utf8Encode } from '../src';

describe('email code', () => {
  it('keeps the digits of whatever is pasted', () => {
    expect(otpDigits('482913')).toBe('482913');
    expect(otpDigits('Tu código: 482 913')).toBe('482913');
    expect(otpDigits(' 48-29-13 \n')).toBe('482913');
    expect(otpDigits('4829131234')).toBe('482913');
    expect(otpDigits('48a')).toBe('48');
    expect(otpDigits('')).toBe('');
  });
});

describe('auth errors', () => {
  // shapes returned by the local GoTrue (see tools/local-stack) and supabase-js
  it('reads the error code first', () => {
    expect(authErrorKind({ code: 'otp_expired', message: 'Token has expired or is invalid', status: 403 }).kind).toBe('invalid_code');
    expect(authErrorKind({ code: 'email_not_confirmed', message: 'Email not confirmed' }).kind).toBe('email_not_confirmed');
    expect(authErrorKind({ code: 'invalid_credentials', message: 'Invalid login credentials' }).kind).toBe('invalid_credentials');
    expect(authErrorKind({ code: 'same_password', message: 'New password should be different from the old password.' }).kind).toBe('same_password');
  });
  it('tells a resend that came too soon from the hourly email limit', () => {
    expect(authErrorKind({ code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' })).toEqual({ kind: 'resend_too_soon', seconds: 42 });
    expect(authErrorKind({ code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 0 seconds.' })).toEqual({ kind: 'resend_too_soon', seconds: 1 });
    expect(authErrorKind({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }).kind).toBe('email_limit');
  });
  it('falls back to the message and to a generic line', () => {
    expect(authErrorKind({ message: 'User already registered' }).kind).toBe('already_registered');
    expect(authErrorKind(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(authErrorKind(null).kind).toBe('unknown');
    expect(authErrorMessage({ message: 'something else' })).toBe('No pudimos completar la operación. Intenta de nuevo.');
  });
  it('speaks Spanish for every case', () => {
    expect(authErrorMessage({ code: 'otp_expired' })).toMatch(/código no es válido o ya venció/);
    expect(authErrorMessage({ message: 'For security purposes, you can only request this after 9 seconds.' })).toBe('Ya te enviamos un código hace poco. Podrás pedir otro en 9 s.');
  });
});

describe('utf8', () => {
  it('round-trips sessions with accents and emoji', () => {
    const s = JSON.stringify({ full_name: 'Ana Pérez Ñúñez', note: 'Señal 📦 ✓', ascii: 'abc' });
    expect(utf8Decode(utf8Encode(s))).toBe(s);
    expect(Array.from(utf8Encode('é✓📦'))).toEqual(Array.from(new TextEncoder().encode('é✓📦')));
    expect(utf8Decode(new TextEncoder().encode('Mérida 🛵'))).toBe('Mérida 🛵');
  });
});

describe('sealed session', () => {
  const session = JSON.stringify({ access_token: 'a.b.c', user: { email: 'compradora@example.com', name: 'Ñandú ✓' } });
  const bytes = utf8Encode(session);
  // 12-byte IV + ciphertext (same length as the text) + 16-byte tag
  const sizes = { combinedSize: 12 + bytes.length + 16, ivSize: 12, tagSize: 16 };
  const android = new Uint8Array(bytes.length + 16);
  android.set(bytes);

  it('base64 matches the platform encoder both ways', () => {
    for (const sample of [new Uint8Array([]), new Uint8Array([0]), new Uint8Array([255, 254]), bytes, android]) {
      const b64 = base64Encode(sample);
      expect(b64).toBe(Buffer.from(sample).toString('base64'));
      expect(Array.from(base64Decode(b64))).toEqual(Array.from(sample));
      expect(base64Decode(b64).byteLength).toBe(base64Decode(b64).buffer.byteLength);
    }
    expect(() => base64Decode('no es base64!')).toThrow();
  });

  it('reads back exactly the stored session when Android adds the tag length in zero bytes', () => {
    expect(utf8Decode(android)).not.toBe(session);
    expect(sealedPlaintext(android, sizes)).toBe(session);
    expect(sealedPlaintext(base64Encode(android), sizes)).toBe(session);
    // without usable sizes the zero bytes are still dropped
    expect(sealedPlaintext(base64Encode(android))).toBe(session);
    expect(sealedPlaintext(android, { combinedSize: undefined, ivSize: undefined, tagSize: undefined })).toBe(session);
    expect(JSON.parse(sealedPlaintext(android, sizes)).user.name).toBe('Ñandú ✓');
  });

  it('leaves an exact plaintext as it is (iOS, web)', () => {
    expect(sealedPlaintext(bytes, sizes)).toBe(session);
    expect(sealedPlaintext(base64Encode(bytes), sizes)).toBe(session);
  });
});
