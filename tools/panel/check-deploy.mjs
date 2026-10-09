#!/usr/bin/env node
// After publishing: asks the hosted panel for the pages that matter (fixed pages, an [id] page, a missing page and
// a script) and prints a Markdown table for the job summary. Fails if a page does not come back as HTML.
// Usage: node tools/panel/check-deploy.mjs https://<dominio>
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) {
  console.log('No hubo URL de publicación.');
  process.exit(1);
}
const pages = ['/', '/login', '/admin', '/admin/pedidos', '/admin/pedidos/00000000-0000-4000-8000-000000000000', '/vendedor/productos/nuevo', '/vendedor/productos/00000000-0000-4000-8000-000000000000', '/admin/tasas'];
const rows = [];
let ok = true;
const get = async (path) => {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(base + path, { redirect: 'manual' }).catch(() => null);
    if (res && res.status < 500) return res;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
};
for (const path of pages) {
  const res = await get(path);
  const type = res?.headers.get('content-type') ?? '';
  const good = res?.status === 200 && type.includes('text/html');
  ok &&= good;
  rows.push(`| ${path} | ${res?.status ?? 'sin respuesta'} | ${type} | ${good ? 'sí' : 'NO'} |`);
}
const missing = await get('/no-existe-esta-pagina');
rows.push(`| /no-existe-esta-pagina | ${missing?.status ?? 'sin respuesta'} | ${missing?.headers.get('content-type') ?? ''} | ${missing?.status === 404 ? 'sí (404)' : 'revisar'} |`);
const html = (await (await get('/login'))?.text()) ?? '';
const script = html.match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1];
const js = script ? await get(script) : null;
rows.push(`| ${script ?? 'script'} | ${js?.status ?? 'no encontrado'} | ${js?.headers.get('content-type') ?? ''} | ${js?.status === 200 ? 'sí' : 'NO'} |`);
ok &&= js?.status === 200;
const head = await get('/login');
const headers = ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'x-robots-tag'].map((h) => `${h}: ${head?.headers.get(h) ?? '—'}`);

console.log(`### Panel publicado: ${base}\n`);
console.log('| Ruta | Estado | Tipo | Bien |\n|---|---|---|---|');
console.log(rows.join('\n'));
console.log(`\nCabeceras de /login: ${headers.join(' · ')}`);
if (!ok) process.exit(1);
