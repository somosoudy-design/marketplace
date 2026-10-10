import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/hooks';
import { noticeTarget } from '@/lib/notice-target';
import { registerForPush } from '@/lib/push';

/**
 * Keeps push working without asking again: when someone signs in on a phone that already allows notifications (and
 * they did not turn them off), the device is registered for that account. Tapping a push opens its order, claim or
 * product, also when the tap is what launched the app.
 */
export function PushBridge() {
  const { user } = useAuth();
  const profile = useProfile();
  const userId = user?.id;
  const loaded = !!profile.data;
  const wanted = ((profile.data?.preferences as Record<string, any> | undefined)?.notifications?.push ?? true) !== false;

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !loaded || !wanted) return;
    registerForPush({ ask: false }).catch(() => undefined);
  }, [userId, loaded, wanted]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const data = r.notification.request.content.data as Record<string, unknown> | undefined;
      const to = noticeTarget(String(data?.kind ?? ''), data);
      Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      if (to) router.push(to);
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return null;
}
