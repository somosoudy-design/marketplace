// Run after a production build, especially if private exhibition was enabled locally.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/storefront');
assert(existsSync(resolve(app, '.next/BUILD_ID')), 'Build the storefront first.');
assert.deepEqual(
  JSON.parse(readFileSync(resolve(app, '.generated/catalog.json'), 'utf8')),
  [],
  'Release must not contain an exhibition registry.',
);
assert(!existsSync(resolve(app, 'public/_exhibition')), 'Release must not contain exhibition files.');
for (const location of ['.next/server', '.next/static/chunks']) {
  for (const file of readdirSync(resolve(app, location), { recursive: true })) {
    if (typeof file === 'string' && /\.(js|html|json)$/.test(file))
      assert(
        !readFileSync(resolve(app, location, file), 'utf8').includes('/_exhibition/'),
        `Exhibition reference found in release: ${file}`,
      );
  }
}
console.log('Release verified: registry empty, no exhibition files or references in server/client bundles.');
