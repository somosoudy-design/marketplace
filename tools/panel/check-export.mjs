#!/usr/bin/env node
// Checks the static export of the panel before it is published: every JWT inside is a public anon key, there is
// no secret key (sb_secret_…) and no address of the local stack. Usage: node tools/panel/check-export.mjs apps/admin/out
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'apps/admin/out';
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const text = walk(root).filter((f) => /\.(js|html|txt|json)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');

const roles = [...text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].map((m) => {
  try { return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role ?? '?'; } catch { return '?'; }
});
const checks = [
  [`claves JWT: ${[...new Set(roles)].join(', ') || 'ninguna'} (solo anon)`, roles.length > 0 && roles.every((r) => r === 'anon')],
  ['sin claves secretas (sb_secret_…)', !/sb_secret_[A-Za-z0-9_-]{20,}/.test(text)],
  ['sin el backend local', !/(127\.0\.0\.1|localhost):(54321|54322|54331)\b/.test(text)],
];
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
