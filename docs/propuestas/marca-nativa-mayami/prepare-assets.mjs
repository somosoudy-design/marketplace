/** Prepara recursos fuera de la app activa. No aplica fuente/configuración ni compila APK. */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd(); // run from repository root, with its existing tooling
const require = createRequire(join(root, 'package.json'));
const sharp = require('sharp'); // existing tooling; never install dependencies automatically
const input = join(here, 'originales');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: node prepare-assets.mjs [--output DIRECTORY]');
const out = args.length ? resolve(args[1]) : join(here, 'prepared-assets');
if (out.startsWith(resolve(root, 'apps') + '/')) throw new Error('Output must stay outside active app assets');
await mkdir(out, { recursive: true });
const records = [];
const record = async (file, source, operation) => records.push({
  file, source, operation,
  sha256: createHash('sha256').update(await readFile(join(out, file))).digest('hex'),
});
for (const [source, file] of [
  ['App/MAYAMI_App_1024.png', 'android-icon.png'],
  ['PNG/MAYAMI_Simbolo_Violeta_1200.png', 'splash-icon.png'],
  ['PNG/MAYAMI_Simbolo_Blanco_1200.png', 'splash-icon-dark.png'],
]) {
  await copyFile(join(input, source), join(out, file));
  await record(file, source, 'byte-for-byte copy');
}
// Place the exact original path in a transparent canvas. No path edits, new lettering or recoloring.
async function place(source, file, size, transform) {
  const original = await readFile(join(input, source), 'utf8');
  const inner = original.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/s, '');
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><g transform="${transform}">${inner}</g></svg>`;
  await sharp(Buffer.from(wrapper)).resize(size, size).png().toFile(join(out, file));
  await record(file, source, `original paths; uniform placement ${transform}; raster ${size}px`);
}
// Adaptive canvas is 108dp. Entire 450x420 M fits in Android's central safe circle (66dp diameter).
// Half-diagonal = 307.77px; safe radius = 1024 * 33 / 108 = 312.89px.
await place('SVG/MAYAMI_Simbolo_Blanco.svg', 'adaptive-foreground.png', 1024, 'translate(287 302) scale(1.5)');
// Notification renders around 24dp: use the supplied optical master and white/transparent pixels.
await place('SVG/MAYAMI_Simbolo_Optico_Blanco.svg', 'notification-icon.png', 96, 'translate(10.5 13) scale(0.25)');
await writeFile(join(out, 'manifest.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`Prepared ${records.length} assets in ${out}. No tracked source or native build was changed.`);
