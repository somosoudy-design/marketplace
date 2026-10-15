// Mints HS256 JWTs for the local stack (anon / service_role keys), like `supabase status` prints.
import { createHmac } from 'node:crypto';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function sign(payload, secret) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
export function verify(token, secret) {
  const [h, b, s] = String(token).split('.');
  if (!h || !b || !s) return null;
  const expected = createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const secret = process.env.JWT_SECRET;
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
  const role = process.argv[2] ?? 'anon';
  process.stdout.write(sign({ iss: 'supabase-local', role, exp }, secret));
}
