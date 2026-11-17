import { emailWebCallbackUrl, productionNativeEmailCallback } from '@kora/api';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { env } from './env';

// The email itself contains a code. A production email never points back to Expo Go or a developer host.
export function authRedirect(path: '/auth-callback' | '/reset-password') {
  const native = productionNativeEmailCallback(env.supabaseUrl, path);
  if (!native) return Linking.createURL(path);
  if (Platform.OS !== 'web') return native;
  const webPath = path === '/reset-password' ? '/auth/callback?tipo=recuperar' : '/auth/callback';
  return emailWebCallbackUrl(env.supabaseUrl, window.location.origin, webPath);
}
