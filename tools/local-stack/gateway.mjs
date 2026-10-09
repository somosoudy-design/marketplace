// Minimal API gateway that mimics the Supabase URL layout for local development and CI:
//   /auth/v1/*      -> GoTrue
//   /rest/v1/*      -> PostgREST
//   /storage/v1/*   -> tiny filesystem-backed storage shim (upload/download with JWT + bucket policy check)
//   /functions/v1/* -> edge functions served by the local functions runner (if running)
// It is NOT a production component; hosted Supabase provides all of this.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { verify } from './jwt.mjs';

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const SECRET = process.env.JWT_SECRET;
const STORAGE_DIR = process.env.STORAGE_DIR;
const PUBLIC_BUCKETS = new Set(['catalog', 'stores']);
const upstream = {
  '/auth/v1': Number(process.env.GOTRUE_PORT ?? 9999),
  '/rest/v1': Number(process.env.POSTGREST_PORT ?? 3000),
  '/functions/v1': Number(process.env.FUNCTIONS_PORT ?? 54331),
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-upsert, idempotency-key',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, content-location',
};

function proxy(req, res, port, rest) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  // GoTrue/PostgREST only need the bearer; fall back to apikey like Kong does.
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const p = http.request({ host: '127.0.0.1', port, path: rest, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
    up.pipe(res);
  });
  p.on('error', (e) => { res.writeHead(502, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ error: 'upstream_unavailable', message: e.message })); });
  req.pipe(p);
}

function claims(req) {
  const auth = req.headers.authorization ?? (req.headers.apikey ? `Bearer ${req.headers.apikey}` : '');
  return verify(auth.replace(/^Bearer\s+/i, ''), SECRET);
}

function storage(req, res, rest) {
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(body)); };
  const m = rest.match(/^\/object\/(public\/|authenticated\/|sign\/)?([a-z0-9_-]+)\/(.+)$/);
  if (!m) return send(404, { error: 'not_found' });
  const [, mode, bucket, rawName] = m;
  const name = decodeURIComponent(rawName.split('?')[0]);
  if (name.includes('..')) return send(400, { error: 'invalid_path' });
  const file = path.join(STORAGE_DIR, bucket, name);
  const c = claims(req);
  if (req.method === 'GET') {
    const isPublic = PUBLIC_BUCKETS.has(bucket);
    if (!isPublic) {
      if (!c) return send(401, { error: 'unauthorized' });
      // private buckets: owner folder = user id, or admin/service role
      const owner = name.split('/')[0];
      if (c.role !== 'service_role' && c.sub !== owner && !(c.app_metadata?.roles ?? []).some((r) => r === 'admin' || r === 'superadmin')) return send(403, { error: 'forbidden' });
    }
    if (!fs.existsSync(file)) return send(404, { error: 'not_found' });
    res.writeHead(200, { ...cors, 'content-type': guessType(file), 'cache-control': 'public, max-age=3600' });
    return fs.createReadStream(file).pipe(res);
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!c || (c.role !== 'service_role' && c.role !== 'authenticated')) return send(401, { error: 'unauthorized' });
    // Mirrors the storage policies: private buckets -> own folder; catalog/stores -> admins or members of the
    // store named by the first folder (hosted Supabase checks membership live; here the JWT claim is used).
    const folder = name.split('/')[0];
    const isAdmin = (c.app_metadata?.roles ?? []).some((r) => r === 'admin' || r === 'superadmin');
    const allowed = c.role === 'service_role'
      || (PUBLIC_BUCKETS.has(bucket) ? isAdmin || (c.app_metadata?.stores ?? []).includes(folder) : folder === c.sub);
    if (!allowed) return send(403, { error: 'forbidden' });
    const type = String(req.headers['content-type'] ?? '');
    const types = PUBLIC_BUCKETS.has(bucket) ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!types.some((t) => type.startsWith(t))) return send(415, { error: 'unsupported_media_type' });
    const chunks = []; let size = 0;
    req.on('data', (d) => { size += d.length; if (size > 5 * 1024 * 1024) { req.destroy(); } else chunks.push(d); });
    req.on('end', () => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.concat(chunks));
      send(200, { Key: `${bucket}/${name}`, Id: `${bucket}/${name}` });
    });
    return;
  }
  send(405, { error: 'method_not_allowed' });
}

function guessType(f) {
  const ext = path.extname(f).toLowerCase();
  return { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' }[ext] ?? 'application/octet-stream';
}

http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    // like the hosted API, accept whatever headers the client library asks for (e.g. x-supabase-api-version)
    const asked = req.headers['access-control-request-headers'];
    res.writeHead(204, { ...cors, ...(asked ? { 'access-control-allow-headers': asked } : {}), 'access-control-max-age': '600' });
    return res.end();
  }
  const url = req.url ?? '/';
  if (url.startsWith('/storage/v1')) return storage(req, res, url.slice('/storage/v1'.length));
  for (const [prefix, port] of Object.entries(upstream)) {
    if (url.startsWith(prefix)) return proxy(req, res, port, url.slice(prefix.length) || '/');
  }
  if (url === '/health') { res.writeHead(200, cors); return res.end('ok'); }
  res.writeHead(404, cors); res.end();
}).listen(PORT, '0.0.0.0', () => console.log(`gateway listening on ${PORT}`));
