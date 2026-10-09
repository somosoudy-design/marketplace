import type { ExpoConfig, ConfigContext } from 'expo/config';
import brand from '../../config/brand.json';
import expo from '../../config/expo.json';

// APP_VARIANT is set per EAS build profile (eas.json) so development, preview and production builds
// can be installed side by side with different identifiers.
const variant = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';
const suffix = variant === 'production' ? '' : `.${variant}`;
const nameSuffix = variant === 'production' ? '' : variant === 'preview' ? ' (Preview)' : ' (Dev)';

// The icon, splash and notification colour are compiled into the APK, so changing them changes the runtime
// fingerprint and updates stop reaching the test APKs already installed. They switch with a new APK only:
// 'original' is what APK 4 carries; 'violet' (assets/images/violet) is the Electric Violet identity.
const NATIVE_IDENTITY: 'original' | 'violet' = 'original';
const native = {
  original: { dir: './assets/images', brand: '#0E5E54', splash: '#F6F0E7', splashDark: '#121416' },
  violet: { dir: './assets/images/violet', brand: '#6D42E8', splash: '#F8F7FC', splashDark: '#110F18' },
}[NATIVE_IDENTITY];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${brand.name}${nameSuffix}`,
  slug: expo.slug,
  version: '0.1.0',
  orientation: 'portrait',
  icon: `${native.dir}/icon.png`,
  scheme: brand.scheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: `${brand.iosBundleId}${suffix}`,
    supportsTablet: true,
    associatedDomains: [`applinks:${brand.webDomain}`],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDevelopmentRegion: 'es',
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: `${brand.androidPackage}${suffix}`,
    adaptiveIcon: {
      backgroundColor: native.brand,
      foregroundImage: `${native.dir}/android-icon-foreground.png`,
      backgroundImage: `${native.dir}/android-icon-background.png`,
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: true,
    // Only what the app uses; nothing else is requested.
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: brand.webDomain, pathPrefix: '/p/' }, { scheme: 'https', host: brand.webDomain, pathPrefix: '/tienda/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: brand.name,
    lang: 'es',
  },
  plugins: [
    ['expo-router', { origin: `https://${brand.webDomain}` }],
    [
      'expo-splash-screen',
      {
        backgroundColor: native.splash,
        image: `${native.dir}/splash-icon.png`,
        imageWidth: 96,
        dark: { backgroundColor: native.splashDark, image: `${native.dir}/splash-icon-dark.png` },
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Usamos tus fotos solo para adjuntar el comprobante de un pago o la evidencia de un reclamo.',
        cameraPermission: 'Usamos la cámara solo para fotografiar el comprobante de un pago o la evidencia de un reclamo.',
        microphonePermission: false,
      },
    ],
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: native.brand }],
    'expo-web-browser',
  ],
  // EAS Update: test builds pick up JavaScript and image changes without a new APK. The fingerprint changes
  // whenever native code does, so an update only reaches builds it can run on.
  runtimeVersion: { policy: 'fingerprint' },
  updates: expo.projectId ? { url: `https://u.expo.dev/${expo.projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } : undefined,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant,
    supportEmail: brand.supportEmail,
    eas: expo.projectId ? { projectId: expo.projectId } : undefined,
  },
  owner: expo.owner,
});
