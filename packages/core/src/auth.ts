// Sign-up and sign-in helpers shared by the app and its tests: the six-digit email code and the Spanish copy for
// Supabase Auth errors.

/** Digits in the codes Supabase Auth emails (auth.email.otp_length). */
export const OTP_LENGTH = 6;
/** Seconds before the app offers to send another code; Supabase refuses earlier requests anyway. */
export const OTP_RESEND_SECONDS = 60;
/** Minutes a code stays valid (auth.email.otp_expiry). */
export const OTP_VALID_MINUTES = 60;

/** The code inside whatever was typed or pasted ("Tu código: 482 913" -> "482913"), at most `length` digits. */
export function otpDigits(input: string, length = OTP_LENGTH): string {
  return input.replace(/\D/g, '').slice(0, length);
}

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'already_registered'
  | 'weak_password'
  | 'email_not_confirmed'
  | 'invalid_code'
  | 'resend_too_soon'
  | 'email_limit'
  | 'same_password'
  | 'session_missing'
  | 'network'
  | 'unknown';

/** What went wrong, from a Supabase Auth error (code when present, message otherwise). */
export function authErrorKind(e: unknown): { kind: AuthErrorKind; seconds?: number } {
  const err = e as { code?: string; message?: string; status?: number } | null;
  const code = String(err?.code ?? '');
  const m = String(err?.message ?? '');
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return { kind: 'invalid_credentials' };
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already exists/i.test(m)) return { kind: 'already_registered' };
  if (code === 'weak_password' || /password should be at least|weak password/i.test(m)) return { kind: 'weak_password' };
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return { kind: 'email_not_confirmed' };
  // Supabase answers the same for a mistyped code and an expired one
  if (code === 'otp_expired' || code === 'otp_disabled' || /token has expired or is invalid|otp.*(expired|invalid)/i.test(m)) return { kind: 'invalid_code' };
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) return { kind: 'resend_too_soon', seconds: Math.max(1, Number(wait[1])) };
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(m)) return { kind: 'email_limit' };
  if (code === 'same_password' || /should be different from the old/i.test(m)) return { kind: 'same_password' };
  if (code === 'session_not_found' || /session missing|auth session/i.test(m)) return { kind: 'session_missing' };
  if (code === 'over_request_rate_limit' || /rate limit|too many/i.test(m)) return { kind: 'email_limit' };
  if (/fetch|network|timed? ?out/i.test(m)) return { kind: 'network' };
  return { kind: 'unknown' };
}

/** Spanish copy for a Supabase Auth error. */
export function authErrorMessage(e: unknown): string {
  const { kind, seconds } = authErrorKind(e);
  switch (kind) {
    case 'invalid_credentials': return 'Correo o contraseña incorrectos.';
    case 'already_registered': return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
    case 'weak_password': return 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
    case 'email_not_confirmed': return 'Confirma tu correo con el código que te enviamos.';
    case 'invalid_code': return 'El código no es válido o ya venció. Usa el último que te enviamos o pide uno nuevo.';
    case 'resend_too_soon': return `Ya te enviamos un código hace poco. Podrás pedir otro en ${seconds} s.`;
    case 'email_limit': return 'Enviamos demasiados correos en poco tiempo. Intenta de nuevo en unos minutos.';
    case 'same_password': return 'Usa una contraseña distinta a la anterior.';
    case 'session_missing': return 'Tu verificación venció. Pide un código nuevo.';
    case 'network': return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
    default: return 'No pudimos completar la operación. Intenta de nuevo.';
  }
}

/** UTF-8 bytes of a string, without relying on TextEncoder (not every JavaScript engine in the app has it). */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** The string in UTF-8 bytes (inverse of utf8Encode). */
export function utf8Decode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!;
    let c: number;
    if (b < 0x80) { c = b; i += 1; }
    else if (b < 0xe0) { c = ((b & 31) << 6) | (bytes[i + 1]! & 63); i += 2; }
    else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i + 1]! & 63) << 6) | (bytes[i + 2]! & 63); i += 3; }
    else { c = ((b & 7) << 18) | ((bytes[i + 1]! & 63) << 12) | ((bytes[i + 2]! & 63) << 6) | (bytes[i + 3]! & 63); i += 4; }
    s += String.fromCodePoint(c);
  }
  return s;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (with padding) of the bytes. */
export function base64Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=');
  }
  return out;
}

/** The bytes of a standard base64 string (padding and whitespace optional). Throws on any other character. */
export function base64Decode(text: string): Uint8Array {
  const clean = text.replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let j = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('invalid base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (acc >> bits) & 0xff;
    }
  }
  // a fresh array, not a view: native modules may read the whole underlying buffer
  return j === out.length ? out : out.slice(0, j);
}

/**
 * The text inside an AES-GCM sealed session, from what the decrypt returned (base64 or bytes). expo-crypto's
 * Android decrypt hands back its whole output buffer, a tag's length longer than the plaintext (zero bytes), so
 * the text is cut to the ciphertext's length (combined = IV + ciphertext + tag) and trailing zero bytes are
 * dropped (stored sessions are JSON, which never ends in one).
 */
export function sealedPlaintext(plain: Uint8Array | string, sealed?: { combinedSize?: unknown; ivSize?: unknown; tagSize?: unknown }): string {
  const bytes = typeof plain === 'string' ? base64Decode(plain) : plain;
  const size = Number(sealed?.combinedSize) - Number(sealed?.ivSize) - Number(sealed?.tagSize);
  let end = Number.isInteger(size) && size >= 0 && size < bytes.length ? size : bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  return utf8Decode(bytes.subarray(0, end));
}
