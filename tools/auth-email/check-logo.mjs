// Run without --local immediately before installing the email templates.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const p = JSON.parse(await readFile(resolve(root, 'assets/brand/mayami/v3/email-provenance.json'), 'utf8'));
const url = new URL(p.productionUrl);
if (url.origin !== 'https://mayami.app' || url.pathname !== '/' + p.png.path.replace('apps/storefront/public/', '') || url.search || url.hash)
  throw new Error('Unexpected email logo destination');
for (const name of ['confirmation', 'recovery']) {
  const html = await readFile(resolve(root, `supabase/templates/${name}.html`), 'utf8');
  if (!html.includes(`src="${url}"`) || !html.includes('alt="Mayami"')) throw new Error('Email template/logo mismatch');
}
let bytes;
const local = process.argv.includes('--local');
if (local) bytes = await readFile(resolve(root, p.png.path));
else {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0]?.trim() !== 'image/png')
    throw new Error('Email logo is not published as HTTP200 image/png; do not install templates');
  bytes = Buffer.from(await response.arrayBuffer());
}
if (bytes.length !== p.png.bytes || createHash('sha256').update(bytes).digest('hex') !== p.png.sha256 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Email logo integrity mismatch');
console.log(JSON.stringify({ status: local ? 'local-ready' : 'hosted-logo-verified', remoteVerified: !local,
  bytes: bytes.length, sha256: p.png.sha256, url: url.toString() }));
