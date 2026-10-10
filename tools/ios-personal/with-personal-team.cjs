// Run last: a native module or a default plugin must not restore a paid capability.
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
const { personalEntitlements } = require('./personal-team.cjs');

module.exports = function withPersonalTeam(config) {
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults = personalEntitlements(mod.modResults);
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    if (Array.isArray(mod.modResults.UIBackgroundModes)) {
      mod.modResults.UIBackgroundModes = mod.modResults.UIBackgroundModes.filter((mode) => mode !== 'remote-notification');
      if (!mod.modResults.UIBackgroundModes.length) delete mod.modResults.UIBackgroundModes;
    }
    return mod;
  });
};
