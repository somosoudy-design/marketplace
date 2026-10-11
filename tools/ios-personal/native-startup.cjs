const assert = require('node:assert/strict');

// SDK 57 already ships this scene delegate. Apply only to the isolated iOS variant.
function sceneManifest() {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [{
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
      }],
    },
  };
}

function verifySceneManifest(manifest) {
  // The plist parser returns objects with null prototypes.
  assert.deepEqual(JSON.parse(JSON.stringify(manifest ?? null)), sceneManifest(),
    'Revisar el manifest de escenas existente');
}

function adoptScenes(source) {
  if (source.includes('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider')) {
    assert.doesNotMatch(source, /window = UIWindow\(frame: UIScreen\.main\.bounds\)/);
    assert.doesNotMatch(source, /factory\.startReactNative\(/);
    return source;
  }
  const legacyWindow = /#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)\n#endif\n/;
  assert.match(source, /class AppDelegate: ExpoAppDelegate \{/);
  assert.match(source, legacyWindow, 'AppDelegate distinto de la plantilla: revisar antes de editar');
  assert.match(source, /var reactNativeFactory: RCTReactNativeFactory\?/);
  return source.replace('class AppDelegate: ExpoAppDelegate {',
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    .replace(legacyWindow, '');
}

const metroIpOutput = '"$(CONFIGURATION_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/ip.txt"';

function declareMetroIpOutput(project) {
  const phases = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase ?? {})
    .filter((phase) => typeof phase === 'object' && phase.name === '"Bundle React Native code and images"');
  assert.equal(phases.length, 1, 'Se requiere una sola fase de bundle React Native');
  const phase = phases[0];
  assert.match(phase.shellScript, /react-native-xcode\.sh/);
  phase.outputPaths ??= [];
  if (!phase.outputPaths.includes(metroIpOutput)) phase.outputPaths.push(metroIpOutput);
}

module.exports = { sceneManifest, verifySceneManifest, adoptScenes, declareMetroIpOutput, metroIpOutput };
