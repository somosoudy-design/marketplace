import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inspectBatch } from './prepare.mjs';

const selection = JSON.parse(readFileSync(new URL('../../docs/catalogo-exhibicion/lote-01.json', import.meta.url), 'utf8'));

test('the actual 15-product selection cannot copy or bundle any unverified reference', () => {
  const result = inspectBatch(selection);
  assert.equal(result.length, 15);
  assert.equal(result.filter((p) => p.ready).length, 0);
  for (const p of result) assert.equal(p.missing.length, 3);
});

test('a public official URL alone is neither model correspondence nor redistribution permission', () => {
  const batch = structuredClone(selection);
  for (const p of batch.products) p.photo = { file: '.local/reference.jpg', originUrl: 'https://www.ugreen.com/product', author: 'UGREEN' };
  for (const p of inspectBatch(batch)) {
    assert(!p.ready);
    assert(p.missing.includes('modelo/variante sin confirmar'));
    assert(p.missing.includes('redistribución sin permiso comprobado'));
  }
});

test('unknown backends, duplicate IDs and oversized batches are rejected', () => {
  const duplicate = structuredClone(selection); duplicate.products[1].productId = duplicate.products[0].productId;
  assert.throws(() => inspectBatch(duplicate), /Duplicate/);
  assert.throws(() => inspectBatch({ ...selection, backendOrigin: 'https://production.example' }), /backend/);
  assert.throws(() => inspectBatch({ ...selection, products: [...selection.products, selection.products[0]] }), /5–15/);
});
