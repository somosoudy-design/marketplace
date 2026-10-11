import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyNativeBundleId } from './native-project.cjs';
import { sceneManifest, verifySceneManifest, adoptScenes, declareMetroIpOutput } from './native-startup.cjs';

// Repair the existing native project in place. No prebuild, Pods, signing or data reset.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = join(root, '.local/ios-personal');
const marker = JSON.parse(readFileSync(join(target, '.personal-team.json'), 'utf8'));
assert.equal(marker.generator, 'hayazgo-ios-personal-v1');
const require = createRequire(join(root, 'apps/mobile/package.json'));
const expoRequire = createRequire(require.resolve('expo/config-plugins'));
const pluginRequire = createRequire(expoRequire.resolve('@expo/config-plugins'));
const plist = pluginRequire('@expo/plist').default;
const xcode = pluginRequire('xcode');
assert.match(readFileSync(join(dirname(require.resolve('expo/package.json')),
  'ios/AppDelegates/ExpoAppSceneDelegate.swift'), 'utf8'), /EXExpoAppSceneDelegate/);
const ios = join(target, 'ios');
const projectPath = join(ios, 'KoraDev.xcodeproj/project.pbxproj');
const delegatePath = join(ios, 'KoraDev/AppDelegate.swift');
const infoPath = join(ios, 'KoraDev/Info.plist');
const project = xcode.project(projectPath);
project.parseSync();
verifyNativeBundleId(project, 'KoraDev', marker.bundleId);
const delegate = adoptScenes(readFileSync(delegatePath, 'utf8'));
const info = plist.parse(readFileSync(infoPath, 'utf8'));
if (info.UIApplicationSceneManifest) {
  verifySceneManifest(info.UIApplicationSceneManifest);
}
info.UIApplicationSceneManifest = sceneManifest();
declareMetroIpOutput(project);
// Validate everything before the first write; keep originals privately, including local signing settings.
const backup = join(root, '.local/ios-diagnosis', `startup-backup-${Date.now()}`);
mkdirSync(backup, { recursive: true });
for (const path of [projectPath, delegatePath, infoPath]) copyFileSync(path, join(backup, path.split('/').at(-1)));
writeFileSync(delegatePath, delegate);
writeFileSync(infoPath, plist.build(info));
writeFileSync(projectPath, project.writeSync());
for (const file of ['with-personal-team.cjs', 'native-startup.cjs']) {
  copyFileSync(join(root, 'tools/ios-personal', file), join(target, file));
}
console.log('PASS: proyecto iOS existente preparado para escenas y salida Metro declarada; firma y sandbox conservados.');
