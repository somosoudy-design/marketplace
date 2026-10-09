import type { ExpoConfig, ConfigContext } from 'expo/config';
import brand from '../../config/brand.json';
import expo from '../../config/expo.json';

// APP_VARIANT is set per EAS build profile (eas.json) so development, preview and production builds
// can be installed side by side with different identifiers.
const variant = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';
const suffix = variant === 'production' ? '' : `.${variant}`;
const nameSuffix = variant === 'production' ? '' : variant === 'preview' ? ' (Preview)' : ' (Dev)';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `${brand.name}${nameSuffix}`,
  slug: expo.slug,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
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
      backgroundColor: '#0E5E54',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
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
        backgroundColor: '#F6F0E7',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
        dark: { backgroundColor: '#121416', image: './assets/images/splash-icon-dark.png' },
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
    ['expo-notifications', { icon: './assets/images/notification-icon.png', color: '#0E5E54' }],
    'expo-web-browser',
    // development builds keep every architecture so emulators work
    ...(variant === 'development' ? [] : ['./plugins/with-phone-abis.js']),
  ],
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
