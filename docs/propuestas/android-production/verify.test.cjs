const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const base = path.join(root, '.local/android-production-20261108');
fs.mkdirSync(base, { recursive: true });
const fixture = fs.mkdtempSync(path.join(base, 'config-'));
const mobile = path.join(fixture, 'apps/mobile');
fs.mkdirSync(mobile, { recursive: true });
fs.mkdirSync(path.join(fixture, 'config'));
for (const file of ['brand.json', 'expo.json']) {
  fs.copyFileSync(path.join(root, 'config', file), path.join(fixture, 'config', file));
}
fs.copyFileSync(path.join(__dirname, 'app.config.ts.template'), path.join(mobile, 'app.config.ts'));
fs.copyFileSync(path.join(root, 'apps/mobile/package.json'), path.join(mobile, 'package.json'));
fs.copyFileSync(path.join(__dirname, 'eas.production.json'), path.join(mobile, 'eas.json'));
for (const dir of ['node_modules', 'plugins', 'assets']) {
  fs.symlinkSync(path.join(root, 'apps/mobile', dir), path.join(mobile, dir), 'dir');
}
const requireMobile = createRequire(path.join(root, 'apps/mobile/package.json'));
const cli = path.join(path.dirname(requireMobile.resolve('expo/package.json')), 'bin/cli');
const original = JSON.parse(fs.readFileSync(path.join(root, 'config/brand.json')));
function resolveConfig(overrides = {}) {
  return spawnSync(process.execPath, [cli, 'config', '--type', 'public', '--json'], {
    cwd: mobile, encoding: 'utf8', timeout: 30000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', EXPO_OFFLINE: '1', CI: '1',
      APP_VARIANT: 'production', EAS_BUILD_PLATFORM: 'android',
      MAYAMI_ANDROID_APPLICATION_ID: 'app.mayami.marketplace', ...overrides },
  });
}

test('resuelve la propuesta Android sin cambiar esquema de pagos, iOS, permisos ni actualizaciones', () => {
  const result = resolveConfig();
  assert.equal(result.status, 0, result.stderr);
  const c = JSON.parse(result.stdout);
  assert.equal(c.name, 'mayami');
  assert.equal(c.android.package, 'app.mayami.marketplace'); // entrada sintética; no reserva ni aprobación
  assert.equal(c.scheme, original.scheme);
  assert.equal(c.ios.bundleIdentifier, original.iosBundleId);
  assert.deepEqual(c.android.permissions, ['android.permission.POST_NOTIFICATIONS']);
  assert.equal(c.android.icon, './assets/images/mayami/android-icon.png');
  assert.equal(c.extra.supportEmail, 'soporte@mayami.app');
  assert.ok(c.android.intentFilters[0].data.every(d => d.host === 'mayami.app'));
  assert.deepEqual(c.runtimeVersion, { policy: 'fingerprint' });
  assert.equal(c.extra.eas.projectId, '9f629f10-d679-4a99-9965-8a9e588afc85');
  assert.equal(c.updates.url, 'https://u.expo.dev/9f629f10-d679-4a99-9965-8a9e588afc85');
});
test('rechaza identidad ausente o provisional antes de construir', () => {
  for (const id of ['', '__APPLICATION_ID_PENDIENTE__', 'com.example', 'com.example.kora']) {
    const result = resolveConfig({ MAYAMI_ANDROID_APPLICATION_ID: id });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /MAYAMI_ANDROID_APPLICATION_ID/);
  }
});
test('la copia de producción no se puede usar para preview ni iOS', () => {
  for (const env of [{ APP_VARIANT: 'preview' }, { EAS_BUILD_PLATFORM: 'ios' }, { EAS_BUILD_PLATFORM: '' }]) {
    const result = resolveConfig(env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /exclusivo de Android production/);
  }
});
test('el perfil produce AAB en production con configuración pública del proyecto exacto', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'eas.production.json')));
  const prod = p.build.production;
  assert.deepEqual(Object.keys(p.build).sort(), ['base', 'production']);
  assert.equal(prod.distribution, 'store');
  assert.equal(prod.android.buildType, 'app-bundle');
  assert.equal(prod.channel, 'production');
  assert.equal(prod.environment, 'production');
  assert.equal(prod.env.MAYAMI_ANDROID_APPLICATION_ID, '__APPLICATION_ID_PENDIENTE__');
  assert.equal(prod.env.EXPO_PUBLIC_SUPABASE_URL, 'https://mimnotafmfasvwrclxan.supabase.co');
  assert.equal(prod.env.EXPO_PUBLIC_PANEL_URL, 'https://kora-panel.expo.app');
  assert.equal(JSON.parse(Buffer.from(prod.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url')).role, 'anon');
  assert.equal(prod.env.EXPO_PUBLIC_CATALOG_PRESENTATION, undefined);
  assert.equal(p.submit, undefined);
});
