// Exercise the email flows of a local Supabase Auth server using the repository's SMTP sink.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

function local(input) {
  const url = new URL(input);
  assert.equal(url.protocol, 'http:');
  assert.ok(['127.0.0.1', '[::1]'].includes(url.hostname), 'Email QA requires a loopback host.');
  return url.href.replace(/\/$/, '');
}
const auth = local(process.env.MAYAMI_QA_AUTH_URL || 'http://127.0.0.1:54321/auth/v1');
const mail = local(process.env.MAYAMI_QA_MAIL_URL || 'http://127.0.0.1:2501');
const email = `auth-mail-${randomUUID()}@example.com`;
const updatedEmail = `new-${email}`;
const password = randomUUID() + 'Aa9!';
const logo = 'https://mayami.app/brand/email/mayami-v3-violet-whiteplate-78ede630b3696d6c.png';

async function request(path, data, { method = 'POST', token, expectSuccess = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (process.env.MAYAMI_QA_ANON_KEY) headers.apikey = process.env.MAYAMI_QA_ANON_KEY;
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(auth + path, { method, headers, redirect: 'error', body: JSON.stringify(data) });
  assert.equal(response.ok, expectSuccess, `${method} ${path}: unexpected status ${response.status}`);
  return response.json();
}

async function message(to, subject, since = 0) {
  for (let retries = 0; retries < 60; retries++) {
    const response = await fetch(mail + '/messages?to=' + encodeURIComponent(to), { redirect: 'error' });
    assert.ok(response.ok);
    const messages = (await response.json()).filter(m => m.subject === subject && Date.parse(m.at) >= since);
    if (messages.length) {
      assert.equal(messages.length, 1, 'Expected one email for this action');
      const m = messages[0];
      assert.match(m.code || '', /^\d{6}$/);
      assert.ok(m.text.includes(m.code));
      assert.ok(m.html.includes('src="' + logo + '"'));
      assert.ok(m.html.includes('alt="Mayami"'));
      assert.deepEqual(m.links, ['mailto:soporte@mayami.app', 'https://mayami.app/contacto']);
      assert.doesNotMatch(m.html, /Kora|\{\{|localhost|127\.0\.0\.1|token_hash=/i);
      return m;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('SMTP delivery timed out for ' + subject);
}

await request('/signup', { email, password });
const confirmation = await message(email, 'Confirma tu correo en Mayami');
const wrong = confirmation.code === '000000' ? '111111' : '000000';
await request('/verify', { email, token: wrong, type: 'signup' }, { expectSuccess: false });
const account = await request('/verify', { email, token: confirmation.code, type: 'signup' });
assert.equal(account.user.email, email);
await request('/verify', { email, token: confirmation.code, type: 'signup' }, { expectSuccess: false });
console.log('PASS confirmation delivery, invalid code rejection, verification and replay rejection');

await request('/recover', { email });
const recovery = await message(email, 'Restablece tu contraseña de Mayami');
const recovered = await request('/verify', { email, token: recovery.code, type: 'recovery' });
assert.equal(recovered.user.id, account.user.id);
const newPassword = randomUUID() + 'Bb2!';
await request('/user', { password: newPassword }, { method: 'PUT', token: recovered.access_token });
await request('/token?grant_type=password', { email, password }, { expectSuccess: false });
await request('/token?grant_type=password', { email, password: newPassword });
console.log('PASS recovery delivery, verified owner, password replacement and sign-in');

// GoTrue rate-limits mail per recipient. This test uses the 1s interval of tools/local-stack/start.sh.
await new Promise(resolve => setTimeout(resolve, 1100));
await request('/otp', { email, create_user: false });
const access = await message(email, 'Tu código de acceso a Mayami');
const signed = await request('/verify', { email, type: 'magiclink', token: access.code });
assert.equal(signed.user.id, account.user.id);
console.log('PASS sign-in code delivery and account identity');

const changeStart = Date.now() - 1000;
await request('/user', { email: updatedEmail }, { method: 'PUT', token: signed.access_token });
const change = await message(updatedEmail, 'Confirma el cambio de correo en Mayami', changeStart);
const result = await request('/verify', { email: updatedEmail, token: change.code, type: 'email_change' });
if (!result.user) {
  // Secure email change requires approval by both mailboxes.
  const previous = await message(email, 'Confirma el cambio de correo en Mayami', changeStart);
  const both = await request('/verify', { email, token: previous.code, type: 'email_change' });
  assert.equal(both.user.email, updatedEmail);
} else {
  assert.equal(result.user.email, updatedEmail);
}
console.log('PASS address change delivery and verification');
