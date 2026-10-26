#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseMarker(value) {
  const marker = typeof value === 'string' ? JSON.parse(value) : value;
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)
    || Object.keys(marker).sort().join(',') !== 'buildVersion,schemaVersion,sourceSha'
    || marker.schemaVersion !== 1 || typeof marker.sourceSha !== 'string' || !/^[a-f0-9]{40}$/.test(marker.sourceSha)
    || typeof marker.buildVersion !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(marker.buildVersion)) {
    throw new Error('release.json inválido: exige schemaVersion:1, sourceSha completo y buildVersion.');
  }
  return { schemaVersion: 1, sourceSha: marker.sourceSha, buildVersion: marker.buildVersion };
}

export function sameMarker(actual, expected) {
  const a = parseMarker(actual);
  const e = parseMarker(expected);
  return a.sourceSha === e.sourceSha && a.buildVersion === e.buildVersion;
}

export function writeMarker(out, sourceSha, buildVersion, headSha) {
  const marker = parseMarker({ schemaVersion: 1, sourceSha, buildVersion });
  if (headSha !== sourceSha) throw new Error('El checkout compilado no coincide con el sourceSha aprobado.');
  writeFileSync(join(out, 'release.json'), JSON.stringify(marker, null, 2) + '\n');
  return marker;
}

export function readMarker(path) {
  return parseMarker(readFileSync(path, 'utf8'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { execFileSync } = await import('node:child_process');
    const [out, sourceSha, buildVersion] = process.argv.slice(2);
    if (!out) throw new Error('Uso: node tools/panel/release-marker.mjs <export> <sourceSha> <buildVersion>');
    const marker = writeMarker(out, sourceSha, buildVersion, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
    console.log('release.json: ' + marker.sourceSha + ' · ' + marker.buildVersion);
  } catch (error) {
    console.error('::error::' + error.message);
    process.exitCode = 1;
  }
}
