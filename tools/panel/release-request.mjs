#!/usr/bin/env node
// A release request is a separate commit immediately after the approved source.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUEST_PATH = '.github/panel-deploy-request';
const SHA = /^[a-f0-9]{40}$/;

export function parseRequest(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const sources = lines.filter((line) => line.startsWith('source:'));
  if (sources.length !== 1 || !/^source: [a-f0-9]{40}$/.test(sources[0])) {
    throw new Error('La solicitud necesita una sola línea source: seguida del SHA completo de 40 caracteres.');
  }
  if (lines.some((line) => !line.startsWith('source:') && !/^message: .+$/.test(line))) {
    throw new Error('Campo desconocido en la solicitud; sólo se aceptan source: y message:.');
  }
  if (lines.filter((line) => line.startsWith('message:')).length > 1) throw new Error('La solicitud tiene mensajes duplicados.');
  return { sourceSha: sources[0].slice('source: '.length), message: lines.find((line) => line.startsWith('message: '))?.slice(9) ?? '' };
}

export function validateRequest({ text, headSha, parents, changedPaths }) {
  const request = parseRequest(text);
  if (!SHA.test(headSha) || parents.length !== 1 || !SHA.test(parents[0])) {
    throw new Error('La solicitud debe ser un commit normal con un único padre; checkout necesita fetch-depth: 2.');
  }
  if (request.sourceSha !== parents[0]) throw new Error('source: debe ser exactamente HEAD^, el commit aprobado anterior.');
  // A strict request-only commit avoids an incomplete allowlist of build inputs.
  if (changedPaths.length !== 1 || changedPaths[0] !== REQUEST_PATH) {
    throw new Error('El commit de solicitud sólo puede cambiar ' + REQUEST_PATH + '; código, herramientas, pruebas y documentos van en el commit aprobado anterior.');
  }
  return request;
}

export function inspectRequest(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const [headSha, ...parents] = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
  const changedPaths = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD^', 'HEAD'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
  return validateRequest({ text: readFileSync(resolve(cwd, REQUEST_PATH), 'utf8'), headSha, parents, changedPaths });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const request = inspectRequest();
    // This value is safe to pass to GITHUB_OUTPUT and actions/checkout: 40 lowercase hex.
    console.log('source=' + request.sourceSha);
  } catch (error) {
    console.error('::error::' + error.message);
    process.exitCode = 1;
  }
}
