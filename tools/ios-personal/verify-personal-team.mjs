import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import personal from './personal-team.cjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = join(root, '.local/ios-personal');
const preview = JSON.parse(readFileSync(join(root, 'apps/mobile/eas.json'), 'utf8')).build.preview.env;
personal.validateTestBackend(preview);
personal.validateEnvironmentOverrides(process.env, preview);
const require = createRequire(join(root, 'apps/mobile/package.json'));
const cli = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
const config = JSON.parse(execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
  cwd: target, env: { ...process.env, CI: '1', EXPO_OFFLINE: '1' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
}));
const marker = JSON.parse(readFileSync(join(target, '.personal-team.json'), 'utf8'));
const ios = config._internal.modResults.ios;
assert.deepEqual(config.platforms, ['ios']);
assert.equal(config.ios.bundleIdentifier, marker.bundleId);
assert.deepEqual(ios.entitlements, {}, 'Personal Team debe quedar sin capabilities restringidas');
assert.equal(ios.expoPlist.EXUpdatesEnabled, false);
assert.equal(config.updates.url, undefined);
assert.equal(config.extra.eas, undefined);
assert.match(ios.infoPlist.NSPhotoLibraryUsageDescription, /perfil/);
assert.match(ios.infoPlist.NSCameraUsageDescription, /comprobante/);
assert.equal(ios.infoPlist.NSMicrophoneUsageDescription, undefined);
assert.match(ios.infoPlist.NSLocalNetworkUsageDescription, /Metro/);
assert.equal(ios.infoPlist.UIBackgroundModes?.includes('remote-notification') ?? false, false);
assert.equal(config.icon, './assets/images/violet/icon.png');
assert.equal(config.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1].backgroundColor, '#F8F7FC');
const push = readFileSync(join(target, 'src/lib/push.ts'), 'utf8');
assert.doesNotMatch(push, /getExpoPushTokenAsync|registerPushToken|expo-notifications/);
assert.match(push, /Apple Developer de pago/);
const bridge = readFileSync(join(target, 'src/components/PushBridge.tsx'), 'utf8');
assert.doesNotMatch(bridge, /expo-notifications|addNotificationResponse/);
if (process.argv.includes('--native')) {
  // Introspection evaluates mods in memory; also inspect what Xcode will actually sign.
  const expoRequire = createRequire(require.resolve('expo/config-plugins'));
  const pluginRequire = createRequire(expoRequire.resolve('@expo/config-plugins'));
  const plist = pluginRequire('@expo/plist').default;
  const iosRoot = join(target, 'ios');
  const app = readdirSync(iosRoot).find((name) => name.endsWith('.xcodeproj'))?.replace(/\.xcodeproj$/, '');
  assert.ok(app, 'Primero genera el proyecto con expo prebuild --platform ios');
  const readPlist = (path) => plist.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(Object.keys(readPlist(join(iosRoot, app, `${app}.entitlements`))), [], 'Revisar las capabilities realmente guardadas por Xcode');
  const info = readPlist(join(iosRoot, app, 'Info.plist'));
  assert.match(info.NSPhotoLibraryUsageDescription, /perfil/);
  assert.equal(info.NSMicrophoneUsageDescription, undefined);
  const updates = readPlist(join(iosRoot, app, 'Supporting/Expo.plist'));
  assert.equal(updates.EXUpdatesEnabled, false);
  assert.equal(updates.EXUpdatesURL, undefined);
  const project = readFileSync(join(iosRoot, `${app}.xcodeproj/project.pbxproj`), 'utf8');
  assert.ok(project.includes(`PRODUCT_BUNDLE_IDENTIFIER = "${marker.bundleId}"`));
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 16\.4;/);
  console.log('PASS: archivos nativos iOS generados (entitlements, permisos, OTA, bundle ID e iOS 16.4). Compilación y firma pendientes del Mac.');
}
console.log('PASS: iOS local, bundle ID aislado, entitlements vacíos, OTA/APNs desactivados, permisos mínimos en español e identidad violeta conservada.');
