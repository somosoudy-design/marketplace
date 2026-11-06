// Inspect the adapted artifact that is actually uploaded, after verify:release checks Next's output.
import assert from 'node:assert/strict';
import { verifyCommercialCatalog } from './check-commercial-catalog.mjs';
import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, basename, sep, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function verifyCloudflareArtifact(app) {
  const output = resolve(app, '.open-next');
  assert(existsSync(output), 'Build the Cloudflare worker first.');
  const artifact = realpathSync(output);
  assert(existsSync(resolve(artifact, 'worker.js')), 'Build the Cloudflare worker first.');
  assert(existsSync(resolve(artifact, 'assets')), 'Cloudflare asset output is missing.');
  verifyCompiledEnvironments(resolve(artifact, 'cloudflare/next-env.mjs'));
  if (existsSync(resolve(app, 'src/data/commercial-catalog.json'))) verifyCommercialCatalog(app, resolve(artifact, 'assets'));
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(artifact, { recursive: true, withFileTypes: true })) {
    const file = resolve(entry.parentPath, entry.name);
    const name = relative(artifact, file);
    assert(!name.split(sep).includes('_exhibition'), `Private exhibition entry in Cloudflare artifact: ${name}`);
    assert(!basename(file).startsWith('.env') && !basename(file).startsWith('.dev.vars'), `Environment file in Cloudflare artifact: ${name}`);
    if (entry.isSymbolicLink()) {
      verifyServerDependencyLink(artifact, file, name);
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.(?:js|mjs|cjs|json|html|css|map|txt)$/.test(name)) {
      assert(!readFileSync(file, 'utf8').includes('/_exhibition/'), `Private exhibition reference in Cloudflare artifact: ${name}`);
    }
    files += 1;
    bytes += statSync(file).size;
  }
  return { files, bytes };
}

function verifyServerDependencyLink(artifact, file, name) {
  let target;
  try { target = realpathSync(file); }
  catch { throw new Error(`Unresolvable symbolic link in Cloudflare artifact: ${name}`); }
  const inside = relative(artifact, target);
  const server = `server-functions${sep}default${sep}`;
  assert(
    !isAbsolute(inside) && inside !== '..' && !inside.startsWith(`..${sep}`) &&
    name.startsWith(server) && inside.startsWith(server) &&
    name.split(sep).includes('node_modules') && inside.split(sep).includes('node_modules') &&
    statSync(target).isDirectory(),
    `Unsafe symbolic link in Cloudflare artifact: ${name}`,
  );
  assert(!inside.split(sep).includes('_exhibition'), `Private exhibition target in Cloudflare artifact: ${name}`);
  assert(!inside.split(sep).some(p => p.startsWith('.env') || p.startsWith('.dev.vars')), `Environment target in Cloudflare artifact: ${name}`);
}

function verifyCompiledEnvironments(file) {
  assert(existsSync(file), 'Cloudflare compiled environment module is missing.');
  const source = readFileSync(file, 'utf8');
  assert(source.endsWith('\n'), 'Invalid compiled environment format.');
  const lines = source.slice(0, -1).split('\n');
  assert(lines.length === 3, 'Invalid compiled environment profiles.');
  const allowed = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  for (const [index, mode] of ['production', 'development', 'test'].entries()) {
    const prefix = `export const ${mode} = `;
    const line = lines[index];
    assert(line.startsWith(prefix) && line.endsWith(';'), 'Invalid compiled environment syntax.');
    let variables;
    try { variables = JSON.parse(line.slice(prefix.length, -1)); }
    catch { throw new Error('Invalid compiled environment JSON.'); }
    assert(variables !== null && typeof variables === 'object' && !Array.isArray(variables), 'Invalid compiled environment object.');
    assert(Object.entries(variables).every(([key, value]) => allowed.has(key) && typeof value === 'string'), 'Unapproved compiled environment variable.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/storefront');
  const report = verifyCloudflareArtifact(app);
  console.log(`Cloudflare artifact verified: ${report.files} files, ${report.bytes} bytes; no private exhibition, dotenv files, or unapproved compiled environment variables.`);
}
