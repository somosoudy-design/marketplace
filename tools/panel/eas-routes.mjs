#!/usr/bin/env node
// Prepares the static export of the panel (apps/admin/out) for EAS Hosting. For a static deployment EAS Hosting
// serves each file at its clean address ("admin/pedidos.html" at /admin/pedidos) and reads only `headers` and
// `redirects` from _expo/.routes.json (the same subset `expo export` writes for static output). Detail pages take
// their id in the query (/admin/pedidos/ver?id=…), so there are no per-record pages to route.
// Usage: node tools/panel/eas-routes.mjs apps/admin/out
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('Uso: node tools/panel/eas-routes.mjs <carpeta exportada>');

const manifest = {
  // same headers the panel sends when it runs with its own server (apps/admin/next.config.ts)
  headers: {
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Robots-Tag': 'noindex, nofollow',
  },
  redirects: [],
};
mkdirSync(join(out, '_expo'), { recursive: true });
writeFileSync(join(out, '_expo', '.routes.json'), JSON.stringify(manifest, null, 2));
console.log(`cabeceras para EAS Hosting en ${join(out, '_expo', '.routes.json')}`);
