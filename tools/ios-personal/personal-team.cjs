// Only the generated .local/ios-personal project uses this configuration.
const TEST_PROJECT = 'mimnotafmfasvwrclxan';
const DEFAULT_BUNDLE_ID = 'com.example.kora.personallocal';

function validateBundleId(bundleId) {
  if (!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*){2,}$/.test(bundleId)) {
    throw new Error('IOS_PERSONAL_BUNDLE_ID debe ser un identificador inverso válido y único.');
  }
  if (!bundleId.endsWith('.local') && bundleId !== DEFAULT_BUNDLE_ID) {
    throw new Error('El identificador de prueba debe terminar en .local para evitar confundirlo con producción.');
  }
  return bundleId;
}

function validateTestBackend(env) {
  if (env.EXPO_PUBLIC_SUPABASE_URL !== `https://${TEST_PROJECT}.supabase.co`) {
    throw new Error('La variante iOS solo permite el Supabase de pruebas Marketplace.');
  }
  try {
    const payload = JSON.parse(Buffer.from(env.EXPO_PUBLIC_SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon' || payload.ref !== TEST_PROJECT) throw new Error();
  } catch {
    throw new Error('Se requiere la clave pública anon del proyecto de pruebas; nunca service_role.');
  }
  return env;
}

function personalEntitlements(entitlements) {
  const result = { ...entitlements };
  delete result['aps-environment'];
  delete result['com.apple.developer.associated-domains'];
  if (Object.keys(result).length) {
    throw new Error(`Revisar capabilities nuevas antes de firmar con Personal Team: ${Object.keys(result).join(', ')}`);
  }
  return result;
}

function validateEnvironmentOverrides(env, preview) {
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_PANEL_URL']) {
    if (env[key] !== undefined && env[key] !== preview[key]) {
      throw new Error(`La variable exportada ${key} sobrescribiría el entorno de pruebas. Ejecuta unset ${key} y repite.`);
    }
  }
}

function createPersonalConfig(base, bundleId) {
  const config = JSON.parse(JSON.stringify(base));
  delete config._internal;
  delete config.android;
  delete config.owner;
  delete config.runtimeVersion;
  config.platforms = ['ios'];
  config.updates = { enabled: false };
  config.ios = {
    ...config.ios,
    bundleIdentifier: validateBundleId(bundleId),
    entitlements: personalEntitlements(config.ios?.entitlements ?? {}),
    infoPlist: {
      ...config.ios?.infoPlist,
      NSLocalNetworkUsageDescription: 'Conectamos con Metro en tu Mac para ejecutar esta app de desarrollo.',
    },
  };
  delete config.ios.associatedDomains;
  delete config.ios.appleTeamId;
  config.extra = { ...config.extra, variant: 'development', localPersonalTeam: true };
  delete config.extra.eas;
  config.plugins = (config.plugins ?? [])
    .filter((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'expo-notifications')
    .map((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
      ? [plugin[0], { ...plugin[1], photosPermission: 'Usamos tus fotos para tu foto de perfil, comprobantes de pago y evidencias de reclamos.' }]
      : plugin);
  config.plugins.push('./with-personal-team.cjs');
  return config;
}

module.exports = { TEST_PROJECT, DEFAULT_BUNDLE_ID, validateBundleId, validateTestBackend, validateEnvironmentOverrides, personalEntitlements, createPersonalConfig };
