#!/usr/bin/env node
// Verify this exact export at the immutable deployment and production alias.
// Usage: node tools/panel/check-deploy.mjs <deployment> <production> <expected release.json>
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseMarker, readMarker, sameMarker } from './release-marker.mjs';

export const PAGES = ['/', '/login', '/admin', '/vendedor', '/admin/pedidos', '/admin/pedidos/ver?id=00000000-0000-4000-8000-000000000000', '/vendedor/productos/nuevo', '/vendedor/productos/editar?id=00000000-0000-4000-8000-000000000000', '/admin/tasas'];
export const MISSING_PATH = '/no-existe-esta-pagina';

export class DeploymentVerificationError extends Error {
  constructor(failures, rows) {
    super(failures.join('\n'));
    this.name = 'DeploymentVerificationError';
    this.failures = failures;
    this.rows = rows;
  }
}

function cleanUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('La dirección del panel debe ser una raíz HTTPS sin credenciales ni parámetros.');
  }
  return url.origin;
}

export function headerFailures(headers) {
  const value = (name) => (headers.get(name) ?? '').trim().toLowerCase();
  const checks = [
    ['x-frame-options', value('x-frame-options') === 'deny'],
    ['content-security-policy', value('content-security-policy').split(';').some((part) => part.trim() === "frame-ancestors 'none'")],
    ['x-content-type-options', value('x-content-type-options') === 'nosniff'],
    ['referrer-policy', value('referrer-policy') === 'strict-origin-when-cross-origin'],
    ['x-robots-tag', ['noindex', 'nofollow'].every((token) => value('x-robots-tag').split(/\s*,\s*/).includes(token))],
  ];
  return checks.filter(([, ok]) => !ok).map(([name]) => name);
}

export async function verifyDeployment({
  deployment, production, expected,
  fetchImpl = globalThis.fetch,
  pause = (ms) => new Promise((done) => setTimeout(done, ms)),
  aliasAttempts = 36, intervalMs = 5000,
}) {
  const immutable = cleanUrl(deployment);
  const alias = cleanUrl(production);
  if (immutable === alias) throw new Error('La URL inmutable y el alias de producción deben ser distintos.');
  const marker = parseMarker(expected);
  if (!Number.isInteger(aliasAttempts) || aliasAttempts < 1) throw new Error('Intentos de recepción inválidos.');
  const get = (url) => fetchImpl(url, {
    redirect: 'manual', cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  const markerPath = '/release.json?verify=' + encodeURIComponent(marker.buildVersion);
  async function markerAt(base) {
    const response = await get(base + markerPath);
    if (response.status !== 200 || !(response.headers.get('content-type') ?? '').includes('application/json')) {
      throw new Error(base + '/release.json no devuelve JSON HTTP200.');
    }
    return parseMarker(await response.text());
  }

  if (!sameMarker(await markerAt(immutable), marker)) throw new Error('El deployment inmutable no contiene la fuente/build aprobados.');
  let received = false;
  let lastError = 'marcador de una versión anterior';
  for (let attempt = 0; attempt < aliasAttempts; attempt++) {
    try {
      received = sameMarker(await markerAt(alias), marker);
      if (received) break;
      lastError = 'marcador de una versión anterior';
    } catch (error) {
      lastError = error.message;
    }
    if (attempt + 1 < aliasAttempts) await pause(intervalMs);
  }
  if (!received) throw new Error('El alias de producción no recibió la versión aprobada: ' + lastError);

  const rows = [];
  const failures = [];
  for (const base of [immutable, alias]) {
    const pages = await Promise.all(PAGES.map(async (path) => {
      const response = await get(base + path);
      const good = response.status === 200 && (response.headers.get('content-type') ?? '').includes('text/html');
      rows.push({ base, path, status: response.status, ok: good });
      if (!good) failures.push(base + path + ': se esperaba HTML HTTP200, llegó ' + response.status);
      return { path, response, body: await response.text() };
    }));
    const missing = await get(base + MISSING_PATH);
    rows.push({ base, path: MISSING_PATH, status: missing.status, ok: missing.status === 404 });
    if (missing.status !== 404) failures.push(base + MISSING_PATH + ': se esperaba HTTP404, llegó ' + missing.status);
    const login = pages.find((page) => page.path === '/login');
    for (const header of headerFailures(login.response.headers)) failures.push(base + '/login: cabecera inválida o ausente ' + header);
    // A chunk availability check; build identity comes from release.json, never this generic first chunk.
    const script = login.body.match(/src="(\/_next\/static\/[^"]+\.js)"/)?.[1];
    const js = script ? await get(base + script) : null;
    const jsOk = js?.status === 200 && /(?:application|text)\/javascript/.test(js.headers.get('content-type') ?? '');
    rows.push({ base, path: script ?? '(script ausente)', status: js?.status ?? 0, ok: jsOk });
    if (!jsOk) failures.push(base + ': el JavaScript de acceso no está disponible.');
  }
  if (failures.length) throw new DeploymentVerificationError(failures, rows);
  return { marker, deployment: immutable, production: alias, rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [deployment, production, markerPath] = process.argv.slice(2);
    if (!deployment || !production || !markerPath) throw new Error('Uso: node tools/panel/check-deploy.mjs <deployment> <production> <expected release.json>');
    const result = await verifyDeployment({ deployment, production, expected: readMarker(markerPath) });
    console.log('### Panel recibido: ' + result.production + '\n');
    console.log('Fuente ' + result.marker.sourceSha + ' · build ' + result.marker.buildVersion + '\n');
    console.log('El deployment inmutable y el alias sirven el mismo release.json aprobado.\n');
    console.log('| Origen | Ruta | Estado | Bien |\n|---|---|---|---|');
    for (const row of result.rows) console.log('| ' + row.base + ' | ' + row.path + ' | ' + row.status + ' | ' + (row.ok ? 'sí' : 'NO') + ' |');
    console.log('\n404 y las cinco cabeceras de seguridad de /login comprobados en ambas direcciones.');
  } catch (error) {
    console.error('::error::' + error.message);
    process.exitCode = 1;
  }
}
