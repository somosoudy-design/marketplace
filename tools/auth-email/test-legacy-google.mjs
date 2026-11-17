// Run only against a disposable, distinct local GoTrue database. This test installs the migration.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

function loopback(value, protocol) {
  const url = new URL(value);
  assert.ok(['127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === protocol);
  return url;
}
const database = loopback(process.env.MAYAMI_QA_DATABASE_URL, 'postgres:');
assert.match(database.pathname, /^\/qa_(mail|google)_[a-f\d]+$/);
const auth = loopback(process.env.MAYAMI_QA_AUTH_URL, 'http:');
const mail = loopback(process.env.MAYAMI_QA_MAIL_URL, 'http:');
const migration = new URL('../../supabase/migrations/20261117050000_protect_historical_google_links.sql', import.meta.url);

function sql(statement, expectSuccess = true) {
  const result = spawnSync('psql', ['-XAtq', '-v', 'ON_ERROR_STOP=1'], {
    input: statement, encoding: 'utf8', env: { ...process.env, PGHOST: database.hostname, PGPORT: database.port,
      PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password),
      PGDATABASE: database.pathname.slice(1) },
  });
  assert.equal(result.status === 0, expectSuccess, result.stderr.replace(/DETAIL:.*$/gm, '').slice(0, 400));
  return expectSuccess ? result.stdout.trim() : result.stderr;
}
assert.equal(sql("select to_regnamespace('mayami_auth_private') is null"), 't', 'Use a fresh QA database.');
async function req(path, data, token, method = 'POST', expectSuccess = true) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await fetch(new URL(path, auth), { method, headers, body: JSON.stringify(data), redirect: 'error' });
  assert.equal(r.ok, expectSuccess, method + ' ' + path + ' ' + r.status);
  return r.status === 204 ? {} : r.json();
}
async function otp(email, subject) {
  const time = Date.now();
  while (Date.now() - time < 5000) {
    const messages = await (await fetch(new URL('/messages?to=' + encodeURIComponent(email), mail))).json();
    const m = messages.find(m => m.subject === subject);
    if (m) return m.code;
    await new Promise(ok => setTimeout(ok, 100));
  }
  throw Error('No local fixture message for ' + subject);
}
// When a test-only trust root is installed in GoTrue's transport, also exercise the
// real Google id_token endpoint against a local signed OpenID fixture.
const fixtureKey = process.env.MAYAMI_QA_GOOGLE_FIXTURE_SIGNING_KEY;
async function google(address, expectSuccess = true) {
  const now = Math.floor(Date.now() / 1000);
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = enc({ alg: 'RS256', kid: 'qa', typ: 'JWT' }) + '.' + enc({
    iss: 'https://accounts.google.com', aud: 'mayami-local-qa', iat: now, exp: now + 180,
    sub: createHash('sha256').update(address).digest('hex'), email: address, email_verified: true,
  });
  const signature = sign('sha256', Buffer.from(payload), readFileSync(fixtureKey)).toString('base64url');
  return req('/token?grant_type=id_token', { provider: 'google', id_token: payload + '.' + signature },
    undefined, 'POST', expectSuccess);
}
function ownStatus(session) {
  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
  assert.match(payload.sub, /^[a-f\d-]{36}$/); assert.match(payload.session_id, /^[a-f\d-]{36}$/);
  return sql("begin; set local role authenticated; set local request.jwt.claims = '"
    + JSON.stringify({ sub: payload.sub, session_id: payload.session_id, role: 'authenticated' })
    + "'; select public.my_google_link_recovery_status(); rollback;");
}
const randomPassword = () => randomUUID() + 'Az!9';
const email = 'legacy-' + randomUUID() + '@example.com';
let password = randomPassword();
const account = await req('/signup', { email, password });
const id = account.id || account.user?.id;
assert.match(id, /^[a-f\d-]{36}$/);
sql("update auth.users set email_confirmed_at = now() where id = '" + id + "'");
const passwordLogin = () => req('/token?grant_type=password', { email, password });
const squatter = await passwordLogin();
if (fixtureKey) {
  const reference = 'baseline-' + randomUUID() + '@example.com';
  const created = await req('/signup', { email: reference, password });
  const referenceId = created.id || created.user?.id;
  assert.match(referenceId, /^[a-f\d-]{36}$/);
  sql("update auth.users set email_confirmed_at = now() where id = '" + referenceId + "'");
  const baseline = await google(reference);
  assert.equal(baseline.user.id, referenceId);
  assert.equal((await req('/token?grant_type=password', { email: reference, password })).user.id, referenceId);
  console.log('PASS reproduces legacy pre-hijacking without the migration through actual GoTrue Google grant');
}
sql(readFileSync(migration, 'utf8'));
const state = "select allow_after is not null from mayami_auth_private.google_recovery where user_id = '" + id + "'";
assert.equal(sql(state), 'f');
assert.equal(sql("select has_schema_privilege('authenticated','mayami_auth_private','USAGE')"), 'f');

// Simulate only Google's authenticated identity insert at the Auth/DB boundary.
// All password, verification, session creation, refresh and revocation requests exercise actual GoTrue.
function link(userId, address, good, verified = true) {
  assert.match(userId, /^[a-f\d-]{36}$/); assert.match(address, /^[a-z\d@.\-]+$/);
  const sub = randomUUID();
  const err = sql("insert into auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at) values ('"
    + userId + "','" + sub + "','google', jsonb_build_object('email','" + address + "','email_verified',"
    + verified + ",'sub','" + sub + "'), now(), now())", good);
  if (!good) assert.match(err, /Mayami requires verified account recovery/);
}
link(id, email, false);
assert.equal(ownStatus(squatter), '');
assert.equal(sql("select has_function_privilege('anon','public.my_google_link_recovery_status()','execute')"), 'f');
if (fixtureKey) {
  const denied = await google(email, false);
  assert.equal(denied.error_code, 'unexpected_failure');
  assert.equal(denied.msg, 'Error creating identity');
}
await req('/recover', { email });
const code = await otp(email, 'Restablece tu contraseña de Mayami');
await req('/verify', { email, token: code === '000000' ? '111111' : '000000', type: 'recovery' }, undefined, 'POST', false);
link(id, email, false);
const recovery = await req('/verify', { email, token: code, type: 'recovery' });
link(id, email, false);
password = randomPassword();
await req('/user', { password }, squatter.access_token, 'PUT');
assert.equal(sql(state), 'f');
link(id, email, false);
await req('/token?grant_type=refresh_token', { refresh_token: recovery.refresh_token }, undefined, 'POST', false);
console.log('PASS historical password, requesting OTP, wrong OTP, OTP alone and rotation from an old session cannot unlock Google');

const secondStart = Date.now();
await new Promise(ok => setTimeout(ok, 1100));
await req('/recover', { email });
const messages = await (await fetch(new URL('/messages?to=' + encodeURIComponent(email), mail))).json();
const secondCode = messages.find(m => m.subject === 'Restablece tu contraseña de Mayami' && Date.parse(m.at) >= secondStart)?.code;
assert.ok(secondCode);
const legitimate = await req('/verify', { email, token: secondCode, type: 'recovery' });
const previous = password;
password = randomPassword();
await req('/user', { password }, legitimate.access_token, 'PUT');
assert.equal(sql(state), 't');
const status = JSON.parse(ownStatus(legitimate));
assert.equal(status.other_sessions_open, false);
assert.ok(Date.parse(status.allow_after) > Date.now() + 60 * 60 * 1000);
assert.equal(ownStatus(squatter), '');
await req('/token?grant_type=password', { email, password: previous }, undefined, 'POST', false);
await req('/token?grant_type=refresh_token', { refresh_token: squatter.refresh_token }, undefined, 'POST', false);
await req('/user', undefined, squatter.access_token, 'GET', false);
link(id, email, false);
assert.equal(sql("select allow_after > now() + interval '60 minutes' from mayami_auth_private.google_recovery where user_id = '" + id + "'"), 't');
const expireDrain = () => sql("update mayami_auth_private.google_recovery set allow_after = now() - interval '1 second' where user_id = '" + id + "'; update mayami_auth_private.google_session_closures set closed_at = null where user_id = '" + id + "'");
const parallelLogin = await passwordLogin();
assert.equal(JSON.parse(ownStatus(legitimate)).other_sessions_open, true);
assert.equal(ownStatus(parallelLogin), '');
expireDrain();
link(id, email, false);
await req('/logout?scope=local', undefined, parallelLogin.access_token);
link(id, email, false);
expireDrain();
link(id, 'different@example.com', false);
link(id, email, false, false);
if (fixtureKey) {
  assert.equal((await google(email)).user.id, id);
  assert.equal((await google(email)).user.id, id);
} else link(id, email, true);
assert.equal(sql(state), '');
console.log('PASS real email recovery rotates password, rejects old session and refresh, checks concurrent sessions, JWT drain, matching verified Google email and one-time release');

const fresh = 'new-' + randomUUID() + '@example.com';
const signup = await req('/signup', { email: fresh, password: randomPassword() });
const freshCode = await otp(fresh, 'Confirma tu correo en Mayami');
const verified = await req('/verify', { email: fresh, token: freshCode, type: 'signup' });
assert.equal(verified.user.id, signup.id || signup.user?.id);
if (fixtureKey) {
  assert.equal((await google(fresh)).user.id, verified.user.id);
  const googleOnly = await google('google-only-' + randomUUID() + '@example.com');
  assert.deepEqual(googleOnly.user.app_metadata.providers, ['google']);
} else link(verified.user.id, fresh, true);
console.log('PASS verified new signup remains eligible without historical recovery');
