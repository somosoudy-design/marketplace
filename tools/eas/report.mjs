// Prints the outcome of `eas build --json` for the CI log and the job summary: build page, APK link,
// and, when the build did not finish, the tail of its EAS logs. Usage: node tools/eas/report.mjs eas-build.json
import { appendFileSync, readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../config/expo.json', import.meta.url), 'utf8'));
let builds = [];
try {
  const raw = readFileSync(process.argv[2], 'utf8');
  builds = JSON.parse(raw.slice(raw.indexOf('[')));
} catch {
  console.log('::error::EAS no devolvió el resultado de la compilación (revisa el paso anterior).');
  process.exit(1);
}

const lines = [];
let ok = true;
for (const b of builds) {
  const page = `https://expo.dev/accounts/${cfg.owner}/projects/${cfg.slug}/builds/${b.id}`;
  lines.push(`### Android ${b.buildProfile ?? ''}: ${b.status}`, '', `- Página de la compilación (instalar): ${page}`);
  if (b.artifacts?.buildUrl) lines.push(`- APK: ${b.artifacts.buildUrl}`);
  if (b.appVersion) lines.push(`- Versión: ${b.appVersion} (${b.appBuildVersion ?? '?'})`);
  if (b.error) lines.push(`- Error: ${b.error.errorCode ?? ''} ${b.error.message ?? ''}`);
  if (b.status !== 'FINISHED') {
    ok = false;
    for (const url of b.logFiles ?? []) {
      try {
        const text = await (await fetch(url)).text();
        const msgs = text
          .split('\n')
          .map((l) => { try { const j = JSON.parse(l); return j.msg ?? ''; } catch { return l; } })
          .filter(Boolean);
        console.log(`----- ${new URL(url).pathname.split('/').pop()} (últimas 150 líneas) -----`);
        console.log(msgs.slice(-150).join('\n'));
      } catch (e) {
        console.log(`No se pudo leer un registro de EAS: ${e}`);
      }
    }
  }
}
const out = lines.join('\n');
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${out}\n`);
process.exit(ok ? 0 : 1);
