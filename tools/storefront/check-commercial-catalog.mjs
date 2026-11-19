import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCommercialCatalog } from '../../apps/storefront/src/lib/commercial-catalog-policy.mjs';

export function verifyCommercialCatalog(app, assetRoot = resolve(app, 'public')) {
  const manifest = JSON.parse(readFileSync(resolve(app, 'src/data/commercial-catalog.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest).sort(), ['approvedAt', 'approvedProducts', 'photos', 'version']);
  assert(new Set(manifest.approvedProducts).size === manifest.approvedProducts.length, 'Duplicate commercial product approval.');
  createCommercialCatalog(manifest);
  const expected = new Map();
  for (const photo of manifest.photos) {
    assert(!('localSource' in photo), 'Local source path in commercial manifest.');
    assert(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0, 'Invalid image dimensions.');
    for (const url of [photo.licenseUrl, photo.originUrl, ...(photo.additionalSources ?? []).map(s => s.url)].filter(Boolean))
      assert(/^https?:\/\//.test(url), 'Invalid public attribution URL.');
    assert(!expected.has(photo.source) || expected.get(photo.source) === photo.sha256, 'Conflicting commercial image hash.');
    expected.set(photo.source, photo.sha256);
  }
  const files = readdirSync(resolve(assetRoot, 'catalog'));
  assert(files.length === expected.size, 'Unexpected commercial asset count.');
  for (const name of files) {
    const key = `/catalog/${name}`;
    assert(expected.has(key), 'Unapproved commercial asset.');
    const file = resolve(assetRoot, 'catalog', name);
    assert(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), 'Commercial asset must be a regular file.');
    assert(createHash('sha256').update(readFileSync(file)).digest('hex') === expected.get(key), 'Commercial asset hash mismatch.');
  }
  return { products: manifest.approvedProducts.length, files: expected.size, associations: manifest.photos.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/storefront');
  console.log(`Commercial catalog verified: ${JSON.stringify(verifyCommercialCatalog(app))}`);
}
