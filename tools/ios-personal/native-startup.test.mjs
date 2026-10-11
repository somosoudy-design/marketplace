import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { adoptScenes, declareMetroIpOutput, metroIpOutput, sceneManifest, verifySceneManifest,
  configureDebugScripts } from './native-startup.cjs';

const mobile = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const expo = createRequire(mobile.resolve('expo/config-plugins'));
const plugins = createRequire(expo.resolve('@expo/config-plugins'));
const plist = plugins('@expo/plist').default;

const legacy = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?
  func launch() {
    reactNativeFactory = factory
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  // Linking methods and factory delegate remain here.
}`;

test('scene adoption gives Expo ownership of the window without starting React twice', () => {
  const fixed = adoptScenes(legacy);
  assert.match(fixed, /ExpoReactNativeFactoryProvider/);
  assert.doesNotMatch(fixed, /factory.startReactNative|window = UIWindow/);
  assert.match(fixed, /reactNativeFactory = factory/);
  assert.match(fixed, /super.application/);
  assert.match(fixed, /Linking methods and factory delegate remain here/);
  assert.equal(adoptScenes(fixed), fixed);
});

test('unknown or partly migrated AppDelegates fail before edits', () => {
  assert.throws(() => adoptScenes(legacy.replace('withModuleName: "main"', 'withModuleName: "custom"')));
  assert.throws(() => adoptScenes(legacy.replace('ExpoAppDelegate {', 'ExpoAppDelegate, ExpoReactNativeFactoryProvider {')));
});

test('one scene uses the built-in SDK 57 class', () => {
  const manifest = sceneManifest();
  assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);
  assert.deepEqual(manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication,
    [{ UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' }]);
});

test('the actual plist parser roundtrip validates and rejects wrong scene delegates', () => {
  const parsed = plist.parse(plist.build({ UIApplicationSceneManifest: sceneManifest() }));
  verifySceneManifest(parsed.UIApplicationSceneManifest);
  parsed.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName = 'WrongDelegate';
  assert.throws(() => verifySceneManifest(parsed.UIApplicationSceneManifest));
});

test('Metro output is declared once without changing scripts or sandbox settings', () => {
  const phase = { name: '"Bundle React Native code and images"', shellScript: 'react-native-xcode.sh', outputPaths: ['existing'] };
  const project = { hash: { project: { objects: { PBXShellScriptBuildPhase: { phase, phase_comment: 'comment' } } } } };
  declareMetroIpOutput(project);
  declareMetroIpOutput(project);
  assert.deepEqual(phase.outputPaths, ['existing', metroIpOutput]);
  assert.equal(phase.shellScript, 'react-native-xcode.sh');
});

test('unexpected bundle phases fail closed', () => {
  assert.throws(() => declareMetroIpOutput({ hash: { project: { objects: {} } } }));
});

test('script compatibility is limited to app Debug and preserves Release, project defaults and signing', () => {
  const phase = { name: '"[CP] Copy Pods Resources"', shellScript: 'Pods-KoraDev-resources.sh', outputPaths: ['"$(TARGET_BUILD_DIR)/existing.bundle/"', '"$(PODS_ROOT)/resources-to-copy-$(TARGETNAME).txt"'] };
  const debug = { name: 'Debug', buildSettings: { DEVELOPMENT_TEAM: 'unchanged', PRODUCT_BUNDLE_IDENTIFIER: 'com.test.local' } };
  const release = { name: 'Release', buildSettings: { ENABLE_USER_SCRIPT_SANDBOXING: 'YES' } };
  const other = { name: 'Debug', buildSettings: { ENABLE_USER_SCRIPT_SANDBOXING: 'YES' } };
  const project = {
    hash: { project: { objects: { PBXShellScriptBuildPhase: { phase } } } },
    pbxNativeTargetSection: () => ({ app: { isa: 'PBXNativeTarget', name: 'KoraDev', buildConfigurationList: 'configs' } }),
    pbxXCConfigurationList: () => ({ configs: { buildConfigurations: [{ value: 'debug' }, { value: 'release' }] } }),
    pbxXCBuildConfigurationSection: () => ({ debug, release, other }),
  };
  configureDebugScripts(project);
  configureDebugScripts(project);
  assert.deepEqual(debug.buildSettings, { DEVELOPMENT_TEAM: 'unchanged', PRODUCT_BUNDLE_IDENTIFIER: 'com.test.local', ENABLE_USER_SCRIPT_SANDBOXING: 'NO' });
  assert.equal(release.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING, 'YES');
  assert.equal(other.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING, 'YES');
  assert.deepEqual(phase.outputPaths, ['"$(TARGET_BUILD_DIR)/existing.bundle"']);
  assert.equal(phase.shellScript, 'Pods-KoraDev-resources.sh');
});

test('repair stays in the existing isolated project and never regenerates or modifies Pods', () => {
  const script = readFileSync(new URL('./repair-native-startup.mjs', import.meta.url), 'utf8');
  assert.match(script, /verifyNativeBundleId/);
  assert.doesNotMatch(script, /execFileSync|rmSync|DEVELOPMENT_TEAM|ENABLE_USER_SCRIPT_SANDBOXING|Pods\/Pods/);
});
