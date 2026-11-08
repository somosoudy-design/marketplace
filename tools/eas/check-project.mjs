// Verifies, before any EAS build, that EXPO_TOKEN can see the exact Expo project in config/expo.json
// and that its projectId matches. Never creates a project. Usage: node tools/eas/check-project.mjs
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../config/expo.json', import.meta.url), 'utf8'));
const fullName = `@${cfg.owner}/${cfg.slug}`;
const fail = (msg) => {
  console.log(`::error::${msg}`);
  process.exit(1);
};

if (!process.env.EXPO_TOKEN) fail('Falta el secreto EXPO_TOKEN en GitHub (Settings > Secrets and variables > Actions).');

const res = await fetch('https://api.expo.dev/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EXPO_TOKEN}` },
  body: JSON.stringify({
    query: 'query($fullName: String!) { app { byFullName(fullName: $fullName) { id fullName } } }',
    variables: { fullName },
  }),
});
const body = await res.json().catch(() => ({}));
const app = body?.data?.app?.byFullName;
if (!res.ok || !app) {
  const why = body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
  fail(`El token no ve el proyecto ${fullName} (${why}).`);
}
console.log(`Proyecto Expo encontrado: ${app.fullName} (projectId ${app.id})`);
if (!cfg.projectId) fail(`config/expo.json no tiene projectId; el de ${fullName} es ${app.id}.`);
if (cfg.projectId !== app.id) fail(`config/expo.json apunta a ${cfg.projectId}, pero ${fullName} es ${app.id}.`);
console.log('projectId verificado.');
