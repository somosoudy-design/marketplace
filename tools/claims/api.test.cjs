const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const m = { exports: {} };
new vm.Script(ts.transpileModule(fs.readFileSync('packages/api/src/claim-ugc.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText).runInNewContext({ exports: m.exports });
test('claim controls preserve exact server payload and explicit audience', async () => {
  const calls = []; const api = m.exports.createClaimUgcApi(async (...args) => { calls.push(args); return { id: 'receipt' }; });
  await api.report('claim', null, 'harassment', null, 'stable-request');
  await api.report('claim', 12, 'other', 'detail', 'stable-request-2');
  await api.setBlock('claim', false);
  await api.adminMessage('claim', 'body', 'buyer_admin');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['claim_ugc_report', { p_claim_id: 'claim', p_message_id: null, p_reason: 'harassment', p_detail: null, p_request_id: 'stable-request' }],
    ['claim_ugc_report', { p_claim_id: 'claim', p_message_id: 12, p_reason: 'other', p_detail: 'detail', p_request_id: 'stable-request-2' }],
    ['claim_ugc_set_block', { p_claim_id: 'claim', p_blocked: false }],
    ['post_claim_admin_message', { p_claim_id: 'claim', p_body: 'body', p_audience: 'buyer_admin' }],
  ]);
});
test('missing capability does not fallback or synthesize success', async () => {
  let count = 0; const failure = new Error('function unavailable');
  const api = m.exports.createClaimUgcApi(async () => { count++; throw failure; });
  await assert.rejects(api.status('claim'), e => e === failure);
  await assert.rejects(api.setBlock('claim', true), e => e === failure);
  assert.equal(count, 2);
});
