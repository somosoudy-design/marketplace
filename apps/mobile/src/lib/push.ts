import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

// The token this device registered for the signed-in user, so signing out can remove it and the next person who uses
// the phone does not receive that account's notices.
let registered: string | null = null;

/** Whether the system already lets the app show notifications (no prompt). */
export async function pushAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

/**
 * Registers this device for push (Expo push service) for the signed-in user. Requires a build with an EAS project id
 * (and, on Android, Firebase Cloud Messaging); returns a human-readable status instead of throwing so settings can
 * explain what happened. With `ask: false` it never shows the permission prompt.
 */
export async function registerForPush({ ask = true }: { ask?: boolean } = {}): Promise<string> {
  if (Platform.OS === 'web') return 'Los avisos push están disponibles en la app instalada.';
  if (Platform.OS === 'ios' && !Device.isDevice) return 'Los avisos push requieren un teléfono físico.';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return 'Avisos push pendientes de configurar: esta compilación no está vinculada al proyecto de Expo.';
  if (Platform.OS === 'android') {
    // Expo's push service delivers to the channel "default" when a message names none.
    await Notifications.setNotificationChannelAsync('default', { name: 'Pedidos y pagos', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'No diste permiso para avisos. Puedes activarlo en los ajustes del teléfono.';
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Android needs Firebase Cloud Messaging in the build and Google Play services; iOS needs an APNs key in EAS.
    if (Platform.OS === 'ios') return 'Avisos push pendientes de configurar: falta la clave de notificaciones de Apple.';
    return Device.isDevice
      ? 'No pudimos activar los avisos en este teléfono. Revisa tu conexión y que tenga los servicios de Google Play.'
      : 'Este emulador no pudo activar los avisos: necesita los servicios de Google Play.';
  }
  try {
    await api.account.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    return 'No pudimos registrar este dispositivo. Revisa tu conexión e inténtalo de nuevo.';
  }
  registered = token;
  return 'Avisos activados en este dispositivo.';
}

/** Removes this device's token from the signed-in account (call before signing out). Never throws. */
export async function unregisterPush(): Promise<void> {
  let token = registered;
  registered = null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!token && projectId && (await pushAllowed().catch(() => false))) {
    // registered in an earlier session: ask for the token again, without holding up the sign-out for long
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
    token = await Promise.race([Notifications.getExpoPushTokenAsync({ projectId }).then((t) => t.data).catch(() => null), timeout]);
  }
  if (token) await api.account.unregisterPushToken(token).catch(() => undefined);
}
