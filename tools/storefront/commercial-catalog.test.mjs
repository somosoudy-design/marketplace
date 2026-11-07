import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCommercialCatalog } from '../../apps/storefront/src/lib/commercial-catalog-policy.mjs';
import { verifyCommercialCatalog } from './check-commercial-catalog.mjs';
const app = new URL('../../apps/storefront/', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(new URL('../../apps/storefront/src/data/commercial-catalog.json', import.meta.url)));
const catalog = createCommercialCatalog(manifest);

test('only the forty owner-approved products receive commercial presentation', () => {
  assert.equal(manifest.approvedProducts.length, 40);
  for (const id of manifest.approvedProducts) assert.equal(catalog.sample(id, true), false);
  for (const id of ['3d0aae18-6668-4b5a-b094-7b322e67b6e4', '648be3ae-6ce1-4293-af7a-0cae15648c09', '791b9673-d6b4-4f5a-a9b3-4019f2094fb3', 'new-seller-product']) {
    assert.equal(catalog.approved(id), false);
    assert.equal(catalog.sample(id, true), true);
  }
});
test('every approved identity and variant resolves to its exact public asset', () => {
  for (const photo of manifest.photos) assert.equal(catalog.photo(photo.productId, photo.originalPath, photo.variantId)?.sha256, photo.sha256);
});
test('an unknown variant never receives another known color or an old sample fallback', () => {
  const p = manifest.photos.find(p => p.variantId);
  assert.equal(catalog.photo(p.productId, p.originalPath, 'unknown-variant'), undefined);
  assert.equal(catalog.blockedLegacy(p.productId, p.originalPath), true);
  assert.equal(catalog.photo('other-product', p.originalPath, p.variantId), undefined);
  assert.equal(catalog.photo(p.productId, 'demo/unapproved-path.webp', p.variantId), undefined);
});
test('gallery excludes superseded templates, deduplicates approved aliases and preserves fresh seller uploads', () => {
  const p = manifest.photos.find(p => !p.variantId);
  const items = [{ path: p.originalPath }, { path: p.originalPath }, { path: 'demo/unapproved-secondary.webp' }, { path: 'seller/fresh.jpg' }];
  assert.deepEqual(catalog.gallery(p.productId, items).map(p => p.path), [p.originalPath, 'seller/fresh.jpg']);
  assert.deepEqual(catalog.gallery('unapproved-product', items), items);
});
test('commercial manifest rejects unsafe URLs and duplicate visual identities', () => {
  const p = manifest.photos[0];
  assert.throws(() => createCommercialCatalog({ approvedProducts: [p.productId], photos: [{ ...p, source: 'javascript:bad' }] }));
  assert.throws(() => createCommercialCatalog({ approvedProducts: [p.productId], photos: [p, p] }));
});
test('all fifty-three approved assets have exact recorded hashes and no extra files', () => {
  assert.deepEqual(verifyCommercialCatalog(app), { products: 40, files: 53, associations: 92 });
});
