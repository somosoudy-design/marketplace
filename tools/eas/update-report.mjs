// Prints what `eas update --json` published: group, runtime version (which APKs can take it), message and link.
// Usage: node tools/eas/update-report.mjs eas-update.json
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'eas-update.json';
const raw = existsSync(file) ? readFileSync(file, 'utf8') : '';
const start = raw.indexOf('[');
if (start < 0) {
  console.log(raw.slice(-2000) || 'eas update no produjo resultado');
  process.exit(1);
}
const updates = JSON.parse(raw.slice(start));
const lines = ['### Actualización publicada (EAS Update)'];
for (const u of updates) {
  lines.push(
    `- ${u.platform}: grupo \`${u.group}\` · runtime \`${u.runtimeVersion}\` · canal preview · «${u.message ?? ''}»`,
    `  https://expo.dev/accounts/marketplacebrand/projects/marketplace/updates/${u.group}`,
  );
}
const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
