#!/usr/bin/env node
// Read Hosting metadata and public release markers. No deploy/upload/alias mutation.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseMarker, sameMarker } from './release-marker.mjs';

export const REQUEST_PATH = '.github/panel-receipt-request';
export const APPROVED = { schemaVersion: 1, sourceSha: '14802742ef1dfe7d327cc60adcdbb14293107e36', buildVersion: '40410656172.1' };
export const PROJECT_ID = '9f629f10-d679-4a99-9965-8a9e588afc85';
export const FULL_NAME = '@marketplacebrand/marketplace';
export const CANONICAL = 'https://kora-panel.expo.app';
// EAS CLI24.12.1 has no deploy:list. Its worker/queries.js uses these read fields.
export const QUERY = `query PanelHostingReceipt($fullName: String!) {
  app { byFullName(fullName: $fullName) {
    id fullName
    workerDeploymentAlias(aliasName: null) {
      url workerDeployment { deploymentIdentifier }
    }
    workerDeployments(first: 10) { edges { node {
      deploymentIdentifier url aliases { aliasName url }
    } } }
  } }
}`;

export function parseRequest(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))) {
    const match = /^(source|build): (\S+)$/.exec(line);
    if (!match || Object.hasOwn(fields, match[1])) throw new Error('invalid_request');
    fields[match[1]] = match[2];
  }
  if (Object.keys(fields).length !== 2 || fields.source !== APPROVED.sourceSha || fields.build !== APPROVED.buildVersion) throw new Error('unapproved_request');
  return { ...APPROVED };
}

export function validateRequest({ text, parents, changedPaths }) {
  if (parents.length !== 1 || !/^[a-f0-9]{40}$/.test(parents[0]) || changedPaths.length !== 1 || changedPaths[0] !== REQUEST_PATH) throw new Error('request_only_commit_required');
  return parseRequest(text);
}

export function publicRoot(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash || !/^[a-z0-9][a-z0-9-]*\.expo\.app$/.test(u.hostname)) throw new Error('invalid_public_url');
  return u.origin;
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(value)) throw new Error('invalid_identifier');
  return value;
}

export function publicMetadata(app) {
  if (app?.id !== PROJECT_ID || app?.fullName !== FULL_NAME) throw new Error('project_mismatch');
  const prod = app.workerDeploymentAlias;
  const production = prod ? { identifier: identifier(prod.workerDeployment?.deploymentIdentifier), url: publicRoot(prod.url) } : null;
  const edges = app.workerDeployments?.edges;
  if (!Array.isArray(edges) || edges.length > 10) throw new Error('invalid_deployments');
  const deployments = edges.map(({ node: d }) => {
    const id = identifier(d.deploymentIdentifier);
    return {
      identifier: id, url: publicRoot(d.url),
      production: production?.identifier === id ? { url: production.url } : null,
      aliases: (d.aliases ?? []).map((a) => ({ name: a.aliasName === null ? null : identifier(a.aliasName), url: publicRoot(a.url) })),
    };
  });
  return { production, deployments };
}

export function notice(title, value) {
  const escape = (s) => s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `::notice title=${title},file=.github/workflows/panel-receipt.yml,line=1::${escape(JSON.stringify(value))}`;
}

function publicLocation(value, base) {
  if (!value) return { location: null };
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'https:' || u.username || u.password) return { location: '[redacted]' };
    return { location: u.origin + u.pathname.slice(0, 256), locationParametersOmitted: Boolean(u.search || u.hash) };
  } catch { return { location: '[invalid]' }; }
}

export async function probeRelease(root, expected, fetchImpl = globalThis.fetch) {
  const url = publicRoot(root) + '/release.json?verify=' + encodeURIComponent(expected.buildVersion);
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'manual', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(12_000) });
    const rawType = res.headers.get('content-type') ?? '';
    const contentType = rawType.split(';')[0].trim().toLowerCase();
    const result = { url, status: res.status, contentType: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType) ? contentType : null, ...publicLocation(res.headers.get('location'), url), marker: null, matchesExpected: false };
    if (res.status !== 200 || contentType !== 'application/json') return result;
    if (Number(res.headers.get('content-length') ?? 0) > 4096) return { ...result, markerError: 'oversized_marker' };
    try {
      result.marker = parseMarker(await res.text());
      result.matchesExpected = sameMarker(result.marker, expected);
    } catch { result.markerError = 'invalid_marker'; }
    return result;
  } catch { return { url, status: null, contentType: null, location: null, marker: null, matchesExpected: false, markerError: 'network_error' }; }
}

export async function readReceipt({ token, expected, fetchImpl = globalThis.fetch, emit = console.log }) {
  if (!token) throw new Error('missing_expo_token');
  const res = await fetchImpl('https://api.expo.dev/graphql', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: QUERY, variables: { fullName: FULL_NAME } }), signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error('graphql_http_' + res.status);
  const json = await res.json().catch(() => null);
  if (json?.errors?.length || !json?.data?.app?.byFullName) throw new Error('graphql_read_failed');
  const metadata = publicMetadata(json.data.app.byFullName);
  emit(notice('Panel receipt metadata', { expected, ...metadata }));
  const roots = [...new Set([CANONICAL, metadata.production?.url, ...metadata.deployments.map((d) => d.url)].filter(Boolean))];
  const probes = await Promise.all(roots.map((root) => probeRelease(root, expected, fetchImpl)));
  probes.forEach((probe, i) => emit(notice('Panel receipt HTTP ' + (i + 1), probe)));
  return { metadata, probes };
}

function inspectRequest() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const [, ...parents] = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
  const changedPaths = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD^', 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  return validateRequest({ text: readFileSync(REQUEST_PATH, 'utf8'), parents, changedPaths });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const expected = inspectRequest();
    await readReceipt({ token: process.env.EXPO_TOKEN, expected });
  } catch (error) {
    // Only static code errors or HTTP status are emitted; never upstream body, headers, token, or stack.
    const known = /^(invalid_request|unapproved_request|request_only_commit_required|project_mismatch|invalid_public_url|invalid_identifier|invalid_deployments|missing_expo_token|graphql_http_\d{3}|graphql_read_failed)$/;
    console.error(notice('Panel receipt failure', { error: known.test(error.message) ? error.message : 'receipt_failed' }));
    process.exitCode = 1;
  }
}
