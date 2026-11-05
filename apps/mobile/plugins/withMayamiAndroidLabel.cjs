// Changes Android's installed display label only. No package, scheme, project, or iOS changes.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withMayamiAndroidLabel(config, { name }) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Android display name is required');
  return withAndroidManifest(config, mod => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    app.$['android:label'] = name;
    return mod;
  });
};
