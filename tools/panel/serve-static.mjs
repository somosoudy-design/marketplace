#!/usr/bin/env node
// Serves the static export of the panel the way EAS Hosting does with _expo/.routes.json (tools/panel/eas-routes.mjs):
// an existing file is served as is, then each htmlRoute is tried in order, then the 404 page. For local checks of
// the hosted build: node tools/panel/serve-static.mjs apps/admin/out 3200
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [root = 'apps/admin/out', port = '3200'] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(join(root, '_expo', '.routes.json'), 'utf8'));
const routes = manifest.htmlRoutes.map((r) => ({ ...r, re: new RegExp(r.namedRegex) }));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const send = (file, status = 200) => {
    res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...manifest.headers });
    res.end(readFileSync(file));
  };
  const direct = normalize(join(root, path));
  if (direct.startsWith(normalize(root)) && existsSync(direct) && statSync(direct).isFile()) return send(direct);
  const route = routes.find((r) => r.re.test(path));
  if (route) return send(join(root, `${route.page.slice(1)}.html`));
  return send(join(root, '404.html'), 404);
}).listen(Number(port), '127.0.0.1', () => console.log(`panel estático en http://127.0.0.1:${port}`));
