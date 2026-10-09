#!/usr/bin/env node
// Prepares the static export of the panel (apps/admin/out) for EAS Hosting, which serves a static deployment
// with the route manifest Expo Router writes (_expo/.routes.json): each address is matched against namedRegex
// and answered with <page>.html. Next writes one HTML per page ("admin/pedidos.html") and, for the [id] routes,
// one placeholder page ("admin/pedidos/_.html", see generateStaticParams) that useRouteId() reads the real id for.
// Usage: node tools/panel/eas-routes.mjs apps/admin/out
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const PLACEHOLDER = '_';
const out = process.argv[2];
if (!out) throw new Error('Uso: node tools/panel/eas-routes.mjs <carpeta exportada>');

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pages = walk(out)
  .filter((f) => f.endsWith('.html'))
  .map((f) => relative(out, f).split(sep).join('/').replace(/\.html$/, ''))
  .filter((p) => !['404', '_not-found'].includes(p) && !p.startsWith('_next/'));

const fixed = [];
const dynamic = [];
for (const page of pages.sort()) {
  const parts = page.split('/');
  if (parts.at(-1) === PLACEHOLDER) {
    // the placeholder answers every id under its parent, as "[id].html" so the manifest names it like Expo does
    const parent = parts.slice(0, -1).join('/');
    copyFileSync(join(out, `${page}.html`), join(out, parent, '[id].html'));
    dynamic.push({ file: `./${parent}/[id].tsx`, page: `/${parent}/[id]`, routeKeys: { id: 'id' }, namedRegex: `^/${escape(parent)}/(?<id>[^/]+?)(?:/)?$` });
  } else if (page === 'index') {
    fixed.push({ file: './index.tsx', page: '/index', routeKeys: {}, namedRegex: '^/(?:/)?$' });
  } else {
    fixed.push({ file: `./${page}.tsx`, page: `/${page}`, routeKeys: {}, namedRegex: `^/${escape(page)}(?:/)?$` });
  }
}

const manifest = {
  // fixed pages first: "nuevo" must win over the [id] of the same folder
  htmlRoutes: [...fixed, ...dynamic],
  apiRoutes: [],
  notFoundRoutes: [{ file: './+not-found.tsx', page: '/404', routeKeys: { notfound: 'notfound' }, namedRegex: '^/(?<notfound>.+?)(?:/)?$' }],
  redirects: [],
  rewrites: [],
  // same headers the panel sends when it runs with its own server (apps/admin/next.config.ts)
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Robots-Tag': 'noindex, nofollow',
  },
};
mkdirSync(join(out, '_expo'), { recursive: true });
writeFileSync(join(out, '_expo', '.routes.json'), JSON.stringify(manifest, null, 2));
console.log(`${fixed.length} páginas fijas y ${dynamic.length} con [id] en ${join(out, '_expo', '.routes.json')}`);
