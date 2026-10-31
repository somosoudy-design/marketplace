const assert = require('node:assert/strict');

// pbxproj permits bare strings and quoted strings. Validate parsed values, not their spelling.
const unquote = (value) => typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value;

function verifyNativeBundleId(project, appName, expectedId) {
  const targets = Object.values(project.pbxNativeTargetSection() ?? {}).filter((target) =>
    target?.isa === 'PBXNativeTarget' && unquote(target.name) === appName &&
    unquote(target.productType) === 'com.apple.product-type.application');
  assert.equal(targets.length, 1, `Se requiere el target principal ${appName}`);
  const list = project.pbxXCConfigurationList()[targets[0].buildConfigurationList];
  assert.ok(list?.buildConfigurations?.length, 'El target principal no tiene configuraciones de compilación');
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const ref of list.buildConfigurations) {
    const config = configurations[unquote(typeof ref === 'string' ? ref : ref.value)];
    assert.ok(config?.buildSettings, 'No se encuentra la configuración de compilación del target principal');
    const name = unquote(config.name);
    assert.equal(unquote(config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER), expectedId,
      `Bundle ID incorrecto en ${appName}/${name}; debe coincidir con la variante local`);
  }
  return list.buildConfigurations.length;
}

module.exports = { verifyNativeBundleId };
