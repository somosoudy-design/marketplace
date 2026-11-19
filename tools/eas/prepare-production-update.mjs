// Offline source validation for the first production runtime. Never publishes or changes channels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const target = Object.freeze({
  projectId: '9f629f10-d679-4a99-9965-8a9e588afc85', owner: 'marketplacebrand',
  package: 'app.mayami.marketplace', buildId: '44d230e2-fd34-4772-bf72-55c79f4ea69e',
  buildSource: 'bb3de95871419ac35afb213067d02c9e6cd02835',
  runtime: 'b6ccf6e187d74e4c38c968346618a194df34d4df',
  channel: 'production', branch: 'production', platform: 'android',
});
const repo = fileURLToPath(new URL('../../', import.meta.url));

export function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    assert(['--source-root', '--source', '--output'].includes(name), 'Unknown flag; publishing and runtime overrides are not supported');
    assert(args[i + 1] && !args[i + 1].startsWith('--') && !(name in options), 'Missing or duplicate flag');
    options[name] = args[i + 1];
  }
  assert.equal(Object.keys(options).length, 3, 'Explicit source-root, full source SHA and output are required');
  assert.match(options['--source'], /^[a-f0-9]{40}$/, 'A full immutable source SHA is required');
  return options;
}

export function validateSource(facts, source) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.equal(facts.sameRepository, true, 'Source must belong to this repository');
  assert.equal(facts.head, source, 'Source checkout must be exactly the requested commit');
  assert.equal(facts.clean, true, 'Source has uncommitted or untracked files');
  assert.notEqual(facts.branch, 'claude/marketplace-v1', 'Do not prepare from the combined shared branch');
  assert.equal(facts.descendsFromBuild, true, 'Source must descend from the verified production build');
  assert.equal(facts.nativeInputsChanged, false, 'Native configuration or dependencies changed; review and build a new AAB');
}

export function validateProfile(profile, inherited = {}) {
  assert(!inherited.GOOGLE_SERVICES_JSON, 'This reference AAB has no Firebase file; do not inject preview configuration');
  for (const [key, expected] of [['APP_VARIANT', 'production'], ['EAS_BUILD_PLATFORM', 'android']]) {
    assert(!inherited[key] || inherited[key] === expected, 'Inherited preview/iOS environment is forbidden');
  }
  const p = profile.build?.production;
  assert(p, 'Production profile missing');
  assert.deepEqual(Object.keys(profile.build).sort(), ['base', 'production'], 'Use the isolated production profile, not preview');
  assert.equal(profile.submit, undefined, 'No submit configuration in this source');
  assert.equal(p.distribution, 'store'); assert.equal(p.android?.buildType, 'app-bundle');
  assert.equal(p.channel, target.channel); assert.equal(p.environment, 'production');
  const env = p.env ?? {};
  assert.equal(env.APP_VARIANT, 'production');
  assert.equal(env.MAYAMI_ANDROID_APPLICATION_ID, target.package);
  assert.equal(env.GOOGLE_SERVICES_JSON, undefined);
  assert.equal(env.EXPO_PUBLIC_CATALOG_PRESENTATION, undefined, 'Do not export private preview presentation');
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://mimnotafmfasvwrclxan.supabase.co');
  assert.equal(env.EXPO_PUBLIC_PANEL_URL, 'https://kora-panel.expo.app');
  const claims = JSON.parse(Buffer.from(String(env.EXPO_PUBLIC_SUPABASE_ANON_KEY).split('.')[1], 'base64url'));
  assert.equal(claims.role, 'anon'); assert.equal(claims.ref, 'mimnotafmfasvwrclxan');
  assert.deepEqual(Object.keys(env).sort(), ['APP_VARIANT', 'MAYAMI_ANDROID_APPLICATION_ID', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_PANEL_URL'].sort(), 'Unexpected environment inputs need review');
  return env;
}

export function validateConfig(config, fingerprint) {
  assert.equal(config.owner, target.owner);
  assert.equal(config.extra?.eas?.projectId, target.projectId);
  assert.equal(config.extra?.variant, 'production');
  assert.equal(config.android?.package, target.package);
  assert.equal(config.android?.googleServicesFile, undefined);
  assert.equal(config.scheme, 'kora', 'Preserve existing payment returns');
  assert.equal(config.updates?.url, 'https://u.expo.dev/' + target.projectId);
  assert.deepEqual(config.runtimeVersion, { policy: 'fingerprint' }, 'Do not force a runtime string');
  assert.equal(fingerprint.hash, target.runtime, 'Computed native fingerprint differs; this needs a new AAB, not a runtime override');
}

function command(binary, args, cwd, env) {
  const r = spawnSync(binary, args, { cwd, env, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(r.status, 0, 'Local validation command failed: ' + binary + ' ' + args[0]);
  return r.stdout.trim();
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function prepare({ sourceRoot, source, output }) {
  const root = resolve(sourceRoot);
  const git = args => command('git', args, root);
  const common = cwd => command('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  const head = git(['rev-parse', 'HEAD']);
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', target.buildSource, head], { cwd: root });
  const packageFiles = git(['ls-tree', '-r', '--name-only', target.buildSource, '--', 'packages']).split('\n').filter(p => p.endsWith('/package.json'));
  const nativeInputs = ['apps/mobile/app.config.ts', 'apps/mobile/eas.json', 'apps/mobile/package.json', 'apps/mobile/plugins', 'config', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', ...packageFiles];
  const facts = { head, branch: git(['branch', '--show-current']), sameRepository: common(root) === common(repo),
    clean: git(['status', '--porcelain']).length === 0, descendsFromBuild: ancestor.status === 0,
    nativeInputsChanged: git(['diff', '--name-only', target.buildSource, head, '--', ...nativeInputs]).length > 0 };
  validateSource(facts, source);
  for (const base of [root, resolve(root, 'apps/mobile')]) for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
    assert(!existsSync(resolve(base, name)), 'Dotenv inputs are not allowed in this preparation');
  }
  const profile = JSON.parse(readFileSync(resolve(root, 'apps/mobile/eas.json'), 'utf8'));
  const publicEnv = validateProfile(profile, process.env);
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  Object.assign(env, publicEnv, { APP_VARIANT: 'production', EAS_BUILD_PLATFORM: 'android', EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', CI: '1' });
  const requireMobile = createRequire(resolve(root, 'apps/mobile/package.json'));
  const cli = resolve(dirname(requireMobile.resolve('expo/package.json')), 'bin/cli');
  const config = JSON.parse(command(process.execPath, [cli, 'config', '--type', 'public', '--json'], resolve(root, 'apps/mobile'), env));
  const fpScript = `const {createRequire}=require('node:module');const r=createRequire(process.cwd()+'/apps/mobile/package.json');const fp=createRequire(r.resolve('expo-updates/package.json'))('@expo/fingerprint');fp.createFingerprintAsync(process.cwd()+'/apps/mobile',{platforms:['android']}).then(x=>process.stdout.write(JSON.stringify({hash:x.hash}))).catch(()=>process.exit(1));`;
  const fingerprint = JSON.parse(command(process.execPath, ['-e', fpScript], root, env));
  validateConfig(config, fingerprint);
  assert.equal(git(['status', '--porcelain']), '', 'Source changed during preparation');
  assert.equal(git(['rev-parse', 'HEAD']), source);
  const plan = { schemaVersion: 1, target, sourceCommit: source, sourceTree: git(['rev-parse', 'HEAD^{tree}']),
    computedRuntime: fingerprint.hash, configSha256: digest(config), profileSha256: digest(profile),
    sameSourceAsEmbeddedBuild: source === target.buildSource,
    stage: 'source-validated-only', exported: false, published: false, remoteMutations: 0,
    nextStep: 'For a reviewed JS/assets increment: export Android locally from this source, validate catalogue and output hashes, then separately authorize publication after fresh Free/quota/mapping checks and compatible-device validation. Never promote an APK5 preview group.' };
  const file = resolve(output); mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2));
  console.log(JSON.stringify(prepare({ sourceRoot: o['--source-root'], source: o['--source'], output: o['--output'] }), null, 2));
}
