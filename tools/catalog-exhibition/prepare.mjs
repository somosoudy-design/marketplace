// No network, remote writes, resizing or publication. Default operation only reports readiness.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../demo-assets/package.json', import.meta.url));

export function inspectBatch(batch) {
  assert.equal(batch.version, 1, 'Unsupported manifest');
  assert.equal(batch.scope, 'private-preview', 'Exhibition assets must be scoped to private preview');
  assert.equal(batch.backendOrigin, 'https://mimnotafmfasvwrclxan.supabase.co', 'Unexpected catalogue backend');
  assert(batch.products.length >= 5 && batch.products.length <= 15, 'Select 5–15 existing products');
  const ids = new Set();
  return batch.products.map((p) => {
    assert.match(p.productId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i, 'Use the original product UUID');
    assert(!ids.has(p.productId), 'Duplicate product UUID'); ids.add(p.productId);
    assert(typeof p.originalPath === 'string' && p.originalPath.startsWith('demo/'), 'Bind the original demo photo path');
    const missing = [];
    if (p.modelStatus !== 'confirmed' || !p.modelEvidence?.trim()) missing.push('modelo/variante sin confirmar');
    if (!p.photo?.file || !/^https:\/\//.test(p.photo?.originUrl ?? '') || !p.photo?.author?.trim()) missing.push('fotografía auténtica/procedencia ausente');
    if (p.rights?.status !== 'confirmed' || !p.rights?.evidence?.trim() || !p.rights?.reviewedBy?.trim()) missing.push('redistribución sin permiso comprobado');
    return { productId: p.productId, slug: p.slug, missing, ready: missing.length === 0 };
  });
}

async function prepare(manifest, write) {
  const batch = JSON.parse(readFileSync(resolve(manifest), 'utf8'));
  const status = inspectBatch(batch);
  for (const p of status) console.log(`${p.slug}: ${p.ready ? 'documentación completa; falta inspección del archivo' : p.missing.join('; ')}`);
  const ready = status.filter((p) => p.ready);
  console.log(`${ready.length}/${status.length} referencias con modelo, procedencia y derechos documentados.`);
  if (ready.length < 1) { process.exitCode = 2; return; }

  // Existing sharp dependency reads metadata only: never generate or alter photographic content.
  const sharp = require('sharp');
  const referenceRoot = realpathSync(resolve(repo, '.local')) + sep;
  const inspected = [];
  for (const product of batch.products.filter((p) => ready.some((r) => r.productId === p.productId))) {
   for (const p of [product, ...(product.additionalPhotos ?? []).map((photo) => ({ ...product, ...photo, additionalPhotos: undefined }))]) {
    assert(p.rights?.status === 'confirmed' && p.rights?.evidence && p.rights?.reviewedBy, 'Every gallery photo needs its own distribution permission');
    const source = realpathSync(resolve(repo, p.photo.file));
    assert(source.startsWith(referenceRoot), 'Keep private source files under ignored .local/');
    const extension = extname(source).toLowerCase();
    assert(['.jpg', '.jpeg', '.png', '.webp'].includes(extension), 'Use a still photograph, never SVG or animated imagery');
    const bytes = readFileSync(source);
    assert(bytes.length <= 512 * 1024, 'Photograph exceeds 512 KiB: obtain an authorized optimized original');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha256, p.photo.sha256, 'Photo differs from the independently reviewed original');
    const { width, height, pages } = await sharp(bytes).metadata();
    assert(width >= 768 && height >= 768 && (!pages || pages === 1), 'Use a sharp original of at least 768 × 768, without animation/upscaling');
    assert.equal(width, p.photo.width); assert.equal(height, p.photo.height);
    inspected.push({ ...p, source, width, height, sha256, filename: `${p.productId}-${sha256.slice(0, 12)}${extension}` });
  }
  }
  if (!write) { console.log('Archivos inspeccionados. Sin escritura ni publicación.'); return; }

  const modulePath = resolve(repo, 'apps/mobile/src/lib/catalog-exhibition-assets.ts');
  assert(/exhibitionPhotos[^=]*=\s*\[\s*\]/.test(readFileSync(modulePath, 'utf8')), 'Preserve existing assignments; review the next batch manually');
  const target = resolve(repo, 'apps/mobile/assets/catalog-exhibition');
  assert(!existsSync(target), 'Do not overwrite existing assets');
  mkdirSync(target, { recursive: true });
  const photos = inspected.map((p) => {
    copyFileSync(p.source, resolve(target, p.filename));
    return `{ productId: ${JSON.stringify(p.productId)}, originalPath: ${JSON.stringify(p.originalPath)}, source: require(${JSON.stringify(`../../assets/catalog-exhibition/${p.filename}`)}), sha256: ${JSON.stringify(p.sha256)}, width: ${p.width}, height: ${p.height}, author: ${JSON.stringify(p.photo.author)}, license: ${JSON.stringify(p.rights.license)}, licenseUrl: ${JSON.stringify(p.rights.licenseUrl)}, originUrl: ${JSON.stringify(p.photo.originUrl)} }`;
  });
  writeFileSync(modulePath, `import type { ExhibitionPhoto } from './catalog-exhibition-policy';\n// Verified photographs only. Private preview, never production.\nexport const exhibitionPhotos: readonly ExhibitionPhoto[] = [\n  ${photos.join(',\n  ')}\n];\n`);
  writeFileSync(resolve(target, 'manifest.json'), JSON.stringify({ version: 1, scope: 'private-preview', products: inspected.map(({ source, ...p }) => ({ ...p, photo: { ...p.photo, file: basename(p.filename) } })) }, null, 2) + '\n');
  console.log(`Preparados ${inspected.length} recursos locales. Antes de distribuir: revisión visual, tests, runtime y autorización específica de Oliver.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const manifest = args.find((arg) => !arg.startsWith('--')) ?? resolve(repo, 'docs/catalogo-exhibicion/lote-01.json');
  await prepare(manifest, args.includes('--write'));
}
