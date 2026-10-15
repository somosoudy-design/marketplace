#!/usr/bin/env node
// Serves the static export of the panel the way EAS Hosting does: a file at its own address or at its clean address
// (/admin/pedidos -> admin/pedidos.html, / -> index.html), the headers of _expo/.routes.json, and 404.html otherwise.
// For local checks of the published build: node tools/panel/serve-static.mjs apps/admin/out 3100
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [root = 'apps/admin/out', port = '3200'] = process.argv.slice(2);
const routes = join(root, '_expo', '.routes.json');
const headers = existsSync(routes) ? JSON.parse(readFileSync(routes, 'utf8')).headers ?? {} : {};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const isFile = (p) => p.startsWith(normalize(root)) && existsSync(p) && statSync(p).isFile();

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/\/$/, '') || '/';
  const send = (file, status = 200) => {
    res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers });
    res.end(readFileSync(file));
  };
  const candidates = path === '/' ? ['index.html'] : [path, `${path}.html`, `${path}/index.html`];
  for (const c of candidates) {
    const file = normalize(join(root, c));
    if (isFile(file)) return send(file);
  }
  return send(join(root, '404.html'), 404);
}).listen(Number(port), '127.0.0.1', () => console.log(`panel estático en http://127.0.0.1:${port}`));
