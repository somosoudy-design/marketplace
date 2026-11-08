import { test } from 'node:test';
import assert from 'node:assert/strict';
import personal from './personal-team.cjs';

const env = (role = 'anon', ref = personal.TEST_PROJECT) => ({
  EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: `header.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.signature`,
});

test('only the existing test backend and its anon role are accepted', () => {
  assert.equal(personal.validateTestBackend(env()).EXPO_PUBLIC_SUPABASE_URL, `https://${personal.TEST_PROJECT}.supabase.co`);
  assert.throws(() => personal.validateTestBackend(env('service_role')), /anon/);
  assert.throws(() => personal.validateTestBackend(env('anon', 'another-project')), /pruebas/);
  assert.throws(() => personal.validateTestBackend({ ...env(), EXPO_PUBLIC_SUPABASE_ANON_KEY: 'invalid' }), /anon/);
});

test('a personal identifier cannot reuse the development, preview or production identifiers', () => {
  assert.equal(personal.validateBundleId('com.somosoudy.hayazgo.oliver.local'), 'com.somosoudy.hayazgo.oliver.local');
  for (const id of ['com.example.kora', 'com.example.kora.preview', 'com.example.kora.development', 'bad id.local']) {
    assert.throws(() => personal.validateBundleId(id));
  }
});

test('exported variables cannot silently replace the test backend or expose another credential', () => {
  assert.doesNotThrow(() => personal.validateEnvironmentOverrides({}, env()));
  assert.doesNotThrow(() => personal.validateEnvironmentOverrides(env(), env()));
  assert.throws(() => personal.validateEnvironmentOverrides({ EXPO_PUBLIC_SUPABASE_URL: 'https://other.example.com' }, env()), /unset EXPO_PUBLIC_SUPABASE_URL/);
  assert.throws(() => personal.validateEnvironmentOverrides({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'private-value-must-not-be-logged' }, env()), (error) => {
    assert.doesNotMatch(error.message, /private-value/);
    return /unset EXPO_PUBLIC_SUPABASE_ANON_KEY/.test(error.message);
  });
});

test('unsupported capabilities are removed and unexpected new capabilities fail closed', () => {
  const original = { 'aps-environment': 'development', 'com.apple.developer.associated-domains': ['applinks:example.com'] };
  assert.deepEqual(personal.personalEntitlements(original), {});
  assert.equal(original['aps-environment'], 'development');
  assert.throws(() => personal.personalEntitlements({ 'com.apple.developer.applesignin': ['Default'] }), /capabilities nuevas/);
});

test('local config isolates iOS, keeps visual identity and updates photo text without mutating the base', () => {
  const base = {
    name: 'Kora (Dev)', icon: './assets/images/violet/icon.png', scheme: 'kora',
    android: { package: 'com.example.kora.development' }, owner: 'marketplacebrand',
    runtimeVersion: { policy: 'fingerprint' }, updates: { url: 'https://u.expo.dev/project' },
    ios: { bundleIdentifier: 'com.example.kora.development', appleTeamId: 'PRIVATE', associatedDomains: ['applinks:example.com'] },
    extra: { eas: { projectId: 'project' }, supportEmail: 'soporte@example.com' },
    plugins: [['expo-notifications', { color: '#6D42E8' }], ['expo-image-picker', { photosPermission: 'old', microphonePermission: false }], 'expo-router'],
  };
  const unchanged = structuredClone(base);
  const config = personal.createPersonalConfig(base, personal.DEFAULT_BUNDLE_ID);
  assert.deepEqual(base, unchanged);
  assert.deepEqual(config.platforms, ['ios']);
  assert.equal(config.android, undefined);
  assert.deepEqual(config.updates, { enabled: false });
  assert.equal(config.runtimeVersion, undefined);
  assert.equal(config.extra.eas, undefined);
  assert.equal(config.ios.associatedDomains, undefined);
  assert.equal(config.ios.appleTeamId, undefined);
  assert.equal(config.name, base.name);
  assert.equal(config.icon, base.icon);
  assert.equal(config.scheme, base.scheme);
  assert.equal(config.plugins.some((p) => Array.isArray(p) && p[0] === 'expo-notifications'), false);
  assert.match(config.plugins[0][1].photosPermission, /perfil/);
  assert.equal(config.plugins[0][1].microphonePermission, false);
  assert.equal(config.plugins.at(-1), './with-personal-team.cjs');
});
