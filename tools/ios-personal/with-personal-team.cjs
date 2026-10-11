// Run last: a native module or a default plugin must not restore a paid capability.
const { withEntitlementsPlist, withInfoPlist, withAppDelegate, withXcodeProject } = require('expo/config-plugins');
const { personalEntitlements } = require('./personal-team.cjs');
const { sceneManifest, adoptScenes, declareMetroIpOutput } = require('./native-startup.cjs');

module.exports = function withPersonalTeam(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults = personalEntitlements(mod.modResults);
    return mod;
  });
  config = withAppDelegate(config, (mod) => {
    mod.modResults.contents = adoptScenes(mod.modResults.contents);
    return mod;
  });
  config = withXcodeProject(config, (mod) => {
    declareMetroIpOutput(mod.modResults);
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = sceneManifest();
    if (Array.isArray(mod.modResults.UIBackgroundModes)) {
      mod.modResults.UIBackgroundModes = mod.modResults.UIBackgroundModes.filter((mode) => mode !== 'remote-notification');
      if (!mod.modResults.UIBackgroundModes.length) delete mod.modResults.UIBackgroundModes;
    }
    return mod;
  });
};
