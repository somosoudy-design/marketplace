// Opens a built APK and checks what the phone will really talk to, before anyone installs it:
//   - the JS bundle points at the Supabase project in eas.json (preview profile), not at a local address;
//   - every JWT embedded in the bundle is a public `anon` key (never service_role);
//   - the embedded Expo config carries this project's id (push tokens and updates need it).
// Usage: node tools/eas/verify-apk.mjs <apk url>  |  node tools/eas/verify-apk.mjs --from-json eas-build.json
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const expo = JSON.parse(readFileSync(new URL('config/expo.json', root), 'utf8'));
const eas = JSON.parse(readFileSync(new URL('apps/mobile/eas.json', root), 'utf8'));
const supabaseUrl = eas.build.preview.env.EXPO_PUBLIC_SUPABASE_URL;

let url = process.argv[2];
if (url === '--from-json') {
  const raw = readFileSync(process.argv[3], 'utf8');
  url = JSON.parse(raw.slice(raw.indexOf('[')))[0]?.artifacts?.buildUrl;
}
if (!url || !/^(https:\/\/|http:\/\/127\.0\.0\.1:)/.test(url)) { // local address only for the script's own check
  console.log('::error::Falta el enlace del APK.');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'apk-'));
const apk = join(dir, 'app.apk');
const res = await fetch(url);
if (!res.ok) {
  console.log(`::error::No se pudo descargar el APK (HTTP ${res.status}).`);
  process.exit(1);
}
writeFileSync(apk, Buffer.from(await res.arrayBuffer()));
const entry = (name) => execFileSync('unzip', ['-p', apk, name], { maxBuffer: 256 * 1024 * 1024 }).toString('latin1');

const bundle = entry('assets/index.android.bundle');
const config = entry('assets/app.config');
const jwtRoles = [...new Set([...bundle.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)].map((m) => {
  try { return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role ?? '?'; } catch { return '?'; }
}))];

const checks = [
  [`apunta a ${supabaseUrl}`, bundle.includes(supabaseUrl)],
  // the local stack's gateway, database, panel and web build; React Native's own dev-server default (localhost:8081)
  // stays in release bundles and is never used there, so it is not counted
  ['sin el backend local (127.0.0.1, localhost o 10.0.2.2 en los puertos del stack)', !/(127\.0\.0\.1|localhost|10\.0\.2\.2):(54321|54322|3100|8089)\b/.test(bundle)],
  [`claves embebidas solo anon (${jwtRoles.join(', ') || 'ninguna'})`, jwtRoles.length > 0 && jwtRoles.every((r) => r === 'anon')],
  ['sin claves sb_secret_', !bundle.includes('sb_secret_')],
  [`projectId ${expo.projectId}`, config.includes(expo.projectId)],
];
const lines = ['### Revisión del APK', '', `- APK: ${url}`, ...checks.map(([name, ok]) => `- ${ok ? '✅' : '❌'} ${name}`)];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
if (checks.some(([, ok]) => !ok)) {
  console.log('::error::El APK no pasó la revisión.');
  process.exit(1);
}
