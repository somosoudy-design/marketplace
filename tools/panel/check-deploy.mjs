#!/usr/bin/env node
// After publishing: checks the pages that matter on the new deployment's own address (kora-panel--<id>.expo.app,
// which never changes), then waits until the production address serves that same build (the alias takes a moment
// to move). Prints a Markdown table for the job summary and fails if a page does not come back as HTML.
// Usage: node tools/panel/check-deploy.mjs <deployment url> [production url]
const clean = (u) => (u ?? '').replace(/\/$/, '');
const deployment = clean(process.argv[2]);
const production = clean(process.argv[3]);
if (!/^https?:\/\//.test(deployment)) {
  console.log('No hubo URL de publicación.');
  process.exit(1);
}
const pages = ['/', '/login', '/admin', '/vendedor', '/admin/pedidos', '/admin/pedidos/ver?id=00000000-0000-4000-8000-000000000000', '/vendedor/productos/nuevo', '/vendedor/productos/editar?id=00000000-0000-4000-8000-000000000000', '/admin/tasas'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { redirect: 'manual' }).catch(() => null);
    if (res && res.status < 500) return res;
    await sleep(5000);
  }
  return null;
};
/** The first script of the login page names the build (Next hashes every chunk). */
const buildOf = async (base) => ((await (await get(`${base}/login`))?.text()) ?? '').match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1] ?? null;

const rows = [];
let ok = true;
for (const path of pages) {
  const res = await get(deployment + path);
  const type = res?.headers.get('content-type') ?? '';
  const good = res?.status === 200 && type.includes('text/html');
  ok &&= good;
  rows.push(`| ${path} | ${res?.status ?? 'sin respuesta'} | ${good ? 'sí' : 'NO'} |`);
}
const missing = await get(`${deployment}/no-existe-esta-pagina`);
rows.push(`| /no-existe-esta-pagina | ${missing?.status ?? 'sin respuesta'} | ${missing?.status === 404 ? 'sí (404)' : 'revisar'} |`);
const script = await buildOf(deployment);
const js = script ? await get(deployment + script) : null;
ok &&= js?.status === 200;
rows.push(`| ${script ?? 'script'} | ${js?.status ?? 'no encontrado'} | ${js?.status === 200 ? 'sí' : 'NO'} |`);
const head = await get(`${deployment}/login`);
const headers = ['x-frame-options', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-robots-tag'].map((h) => `${h}: ${head?.headers.get(h) ?? '—'}`);

let live = 'sin dirección de producción';
if (production) {
  live = 'todavía sirve la versión anterior (revisar en unos minutos)';
  for (let i = 0; i < 36; i++) {
    if (script && (await buildOf(production)) === script) {
      live = 'sirve esta versión';
      break;
    }
    await sleep(5000);
  }
}

console.log(`### Panel publicado: ${production || deployment}\n`);
console.log(`Versión comprobada en ${deployment}; ${production ? `${production}: ${live}.` : ''}\n`);
console.log('| Ruta | Estado | Bien |\n|---|---|---|');
console.log(rows.join('\n'));
console.log(`\nCabeceras de /login: ${headers.join(' · ')}`);
if (!ok) process.exit(1);
