#!/usr/bin/env node
// Edge functions are deployed from supabase/functions only, so the pure modules they share with the apps
// (rate adapters, payment provider helpers, the URL importer, error copy) are copied there. Edit packages/core, then run
// `pnpm edge:sync`. `--check` fails when a copy is out of date (used by the tests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  'packages/core/src/rates/index.ts': 'supabase/functions/_shared/core/rates.ts',
  'packages/core/src/payments/index.ts': 'supabase/functions/_shared/core/payments.ts',
  'packages/core/src/import/index.ts': 'supabase/functions/_shared/core/import.ts',
  'packages/core/src/errors.ts': 'supabase/functions/_shared/core/errors.ts',
};
const check = process.argv.includes('--check');
let stale = 0;
for (const [src, dest] of Object.entries(files)) {
  const out = `// GENERATED from ${src} by tools/sync-edge-shared.mjs. Do not edit; run \`pnpm edge:sync\`.\n${readFileSync(join(root, src), 'utf8')}`;
  const current = existsSync(join(root, dest)) ? readFileSync(join(root, dest), 'utf8') : null;
  if (current === out) continue;
  if (check) { console.error(`· ${dest} is out of date with ${src}`); stale++; continue; }
  writeFileSync(join(root, dest), out);
  console.log(`· wrote ${dest}`);
}
if (stale) { console.error('Run `pnpm edge:sync`.'); process.exit(1); }
