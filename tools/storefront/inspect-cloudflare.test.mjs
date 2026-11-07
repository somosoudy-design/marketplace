import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectCloudflare } from './inspect-cloudflare.mjs';
const zoneId = 'a'.repeat(32);
const zone = { id: zoneId, name: 'mayami.app', status: 'active', account: { id: 'account' }, name_servers: ['ns.example.test'] };
const ok = (result, totalPages = 1) => ({ ok: true, json: async () => ({ success: true, result, result_info: { total_pages: totalPages } }) });

test('inspecciona la zona exacta sólo con GET y no publica token ni registros de correo', async () => {
  const calls = [];
  const report = await inspectCloudflare({ token: 'secret-test-token', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) return ok([zone]);
    const name = new URL(url).searchParams.get('name');
    return ok([{ id: 'record', name, type: 'CNAME', content: 'origin.example.test', proxied: false, ttl: 1 },
      { name, type: 'TXT', content: 'not-for-output' }, { name, type: 'MX', content: 'mail.example.test' }]);
  } });
  assert.equal(calls.length, 5);
  assert(calls.every(({ url, init }) => new URL(url).hostname === 'api.cloudflare.com' && init.method === 'GET' && init.redirect === 'error'));
  assert.equal(report.records.length, 4);
  assert(!/secret-test-token|not-for-output|mail\.example/.test(JSON.stringify(report)));
});

test('sin credencial no realiza ninguna petición', async () => {
  await assert.rejects(inspectCloudflare({ fetchImpl: () => { throw new Error('unexpected'); } }), /Falta CLOUDFLARE_API_TOKEN/);
});

test('rechaza zonas incorrectas, ambiguas y respuestas truncadas', async () => {
  for (const response of [ok([]), ok([{ ...zone, name: 'other.test' }]), ok([zone, zone]), ok([zone], 2)])
    await assert.rejects(inspectCloudflare({ token: 'test', fetchImpl: async () => response }));
});

test('no sigue redirecciones ni revela cuerpos de error o errores de transporte', async () => {
  await assert.rejects(inspectCloudflare({ token: 'secret-test-token', fetchImpl: async () => {
    throw new Error('secret-test-token');
  } }), error => !error.message.includes('secret-test-token'));
  await assert.rejects(inspectCloudflare({ token: 'test', fetchImpl: async () => ({ ok: false, status: 403,
    json: async () => ({ privateValue: 'not-for-output' }) }) }), /HTTP 403/);
});

test('rechaza registros fuera del nombre solicitado', async () => {
  let calls = 0;
  await assert.rejects(inspectCloudflare({ token: 'test', fetchImpl: async () => ++calls === 1 ? ok([zone])
    : ok([{ name: 'unrelated.test', type: 'A', content: '127.0.0.1' }]) }), /ajenos/);
});
