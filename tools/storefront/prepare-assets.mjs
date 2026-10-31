// Reuse the existing mobile exhibition registry without importing React Native into Next.
// Private loopback development ONLY. Release builds contain no exhibition files or metadata.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const app = resolve(root, 'apps/storefront');
try {
  process.loadEnvFile(resolve(app, '.env.local'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const out = resolve(app, 'public/_exhibition');
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(app, '.generated'), { recursive: true });
let photos = [];
if (process.env.STOREFRONT_PRIVATE_PREVIEW === '1' && process.env.NODE_ENV !== 'production') {
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname) ||
    backend.port !== '54321' ||
    backend.protocol !== 'http:'
  )
    throw new Error('Exhibition assets require the local test backend.');
  const registry = resolve(root, 'apps/mobile/src/lib/catalog-exhibition-assets.ts');
  const code = ts.transpileModule(readFileSync(registry, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (path) => resolve(dirname(registry), path) });
  mkdirSync(out, { recursive: true });
  photos = exports.exhibitionPhotos.map((photo) => {
    const bytes = readFileSync(photo.source);
    if (createHash('sha256').update(bytes).digest('hex') !== photo.sha256)
      throw new Error('Exhibition asset hash mismatch');
    const name = basename(photo.source);
    copyFileSync(photo.source, resolve(out, name));
    return { ...photo, source: `/_exhibition/${name}` };
  });
}
writeFileSync(resolve(app, '.generated/catalog.json'), JSON.stringify(photos));
console.log(`Storefront: ${photos.length} local reference mappings. Public builds exclude these assets.`);
