import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parseArgs, target, validateSource, validateProfile, validateConfig } from './prepare-production-update.mjs';

const profile = JSON.parse(readFileSync(new URL('../../docs/propuestas/android-production/eas.production.json', import.meta.url)));
profile.build.production.env.MAYAMI_ANDROID_APPLICATION_ID = target.package;
const config = { owner: target.owner, extra: { variant: 'production', eas: { projectId: target.projectId } },
  android: { package: target.package }, scheme: 'kora', updates: { url: 'https://u.expo.dev/' + target.projectId }, runtimeVersion: { policy: 'fingerprint' } };
const facts = { sameRepository: true, head: target.buildSource, clean: true, branch: '', descendsFromBuild: true, nativeInputsChanged: false };
const clone = value => structuredClone(value);

test('accepts the isolated production identity and real reference runtime without publication flags', () => {
  validateSource(facts, target.buildSource); validateProfile(profile); validateConfig(config, { hash: target.runtime });
  assert.equal(target.channel, 'production'); assert.equal(target.branch, 'production');
});
test('requires explicit immutable inputs and rejects publishing or runtime override flags', () => {
  const args = ['--source-root', '/source', '--source', target.buildSource, '--output', '/out'];
  assert.equal(parseArgs(args)['--source'], target.buildSource);
  for (const bad of [[], args.concat('--publish', 'yes'), args.concat('--runtime', target.runtime), args.concat('--source', target.buildSource), ['--source-root', '/source', '--source', 'HEAD', '--output', '/out']]) assert.throws(() => parseArgs(bad));
});
test('rejects shared, mutable, unrelated and native-incompatible sources', () => {
  for (const change of [{ sameRepository: false }, { head: 'a'.repeat(40) }, { clean: false }, { branch: 'claude/marketplace-v1' }, { descendsFromBuild: false }, { nativeInputsChanged: true }]) assert.throws(() => validateSource({ ...facts, ...change }, target.buildSource));
});
test('rejects preview profile, channel, environment and presentation even with production package', () => {
  for (const field of ['channel', 'environment', 'distribution']) { const p = clone(profile); p.build.production[field] = 'preview'; assert.throws(() => validateProfile(p)); }
  for (const change of [{ APP_VARIANT: 'preview' }, { MAYAMI_ANDROID_APPLICATION_ID: 'com.example.kora.preview' }, { EXPO_PUBLIC_CATALOG_PRESENTATION: 'private-preview' }, { GOOGLE_SERVICES_JSON: '/preview.json' }]) {
    const p = clone(profile); Object.assign(p.build.production.env, change); assert.throws(() => validateProfile(p));
  }
});
test('rejects inherited Firebase preview, preview variant and iOS', () => {
  for (const inherited of [{ GOOGLE_SERVICES_JSON: '/preview.json' }, { APP_VARIANT: 'preview' }, { EAS_BUILD_PLATFORM: 'ios' }]) assert.throws(() => validateProfile(profile, inherited));
});
test('rejects mismatched project, package, update URL, scheme and variant', () => {
  for (const change of [c => c.owner = 'other', c => c.extra.eas.projectId = 'other', c => c.extra.variant = 'preview', c => c.android.package = 'com.example.kora.preview', c => c.updates.url = 'https://other.example', c => c.scheme = 'other']) {
    const c = clone(config); change(c); assert.throws(() => validateConfig(c, { hash: target.runtime }));
  }
});
test('rejects old preview fingerprints and forced runtime strings', () => {
  for (const hash of ['eb5ed1179b9c76c9c3cf27333aa48306728eb4ba', 'b691ec2b61ee413fb1d6e7671a1a84446b4cd4f6', 'a'.repeat(40)]) assert.throws(() => validateConfig(config, { hash }));
  assert.throws(() => validateConfig({ ...config, runtimeVersion: target.runtime }, { hash: target.runtime }));
});
