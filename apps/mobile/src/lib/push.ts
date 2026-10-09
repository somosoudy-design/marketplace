import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/**
 * Registers this device for push (Expo push service). Requires a development/production build with an EAS project id;
 * returns a human-readable status instead of throwing so settings can explain what happened.
 */
export async function registerForPush(): Promise<string> {
  if (Platform.OS === 'web') return 'Los avisos push están disponibles en la app instalada.';
  if (!Device.isDevice) return 'Los avisos push requieren un teléfono físico.';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return 'Avisos push pendientes de configurar: esta compilación no está vinculada al proyecto de Expo.';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', { name: 'Pedidos y pagos', importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'No diste permiso para avisos. Puedes activarlo en los ajustes del teléfono.';
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Android needs Firebase Cloud Messaging credentials in the build; iOS needs an APNs key in EAS.
    return Platform.OS === 'android'
      ? 'Avisos push pendientes de configurar: falta Firebase Cloud Messaging en esta compilación.'
      : 'Avisos push pendientes de configurar: falta la clave de notificaciones de Apple.';
  }
  try {
    await api.account.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    return 'No pudimos registrar este dispositivo. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'Avisos activados en este dispositivo.';
}
