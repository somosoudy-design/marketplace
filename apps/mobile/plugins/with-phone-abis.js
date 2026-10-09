// Release APKs only carry the CPU architectures real phones use (ARM 64 and 32 bit). The x86 libraries exist
// for emulators and add roughly a third to the download, which matters on mobile data.
const { withGradleProperties } = require('expo/config-plugins');

const ABIS = 'armeabi-v7a,arm64-v8a';

module.exports = function withPhoneAbis(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures'));
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: ABIS });
    return cfg;
  });
};
