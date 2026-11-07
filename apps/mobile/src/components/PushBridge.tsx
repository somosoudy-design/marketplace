import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/hooks';
import { noticeTarget } from '@/lib/notice-target';
import { registerForPush } from '@/lib/push';
import { connectPushEvents } from '@/lib/push-events';
import { qk } from '@/lib/query';

/** Connects native push only to the signed-in account. SDK callbacks never confirm payments. */
export function PushBridge() {
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const profile = useProfile();
  const userId = user?.id;
  const loaded = !!profile.data;
  const wanted = ((profile.data?.preferences as Record<string, any> | undefined)?.notifications?.push ?? true) !== false;

  useEffect(() => {
    if (Platform.OS === 'web' || !ready || !userId || !loaded || !wanted) return;
    registerForPush({ ask: false }).catch(() => undefined);
  }, [ready, userId, loaded, wanted]);

  useEffect(() => {
    // Keep the SDK's last response pending while signed out. After login the owned API/RLS checks the destination.
    if (Platform.OS === 'web' || !ready || !userId) return;
    return connectPushEvents({
      defaultAction: Notifications.DEFAULT_ACTION_IDENTIFIER,
      lastResponse: () => Notifications.getLastNotificationResponseAsync(),
      clearResponse: () => Notifications.clearLastNotificationResponseAsync(),
      onResponse: (listener) => Notifications.addNotificationResponseReceivedListener(listener),
      onReceived: (listener) => Notifications.addNotificationReceivedListener(listener),
    }, () => {
      qc.invalidateQueries({ queryKey: [...qk.notifications, userId] });
      qc.invalidateQueries({ queryKey: qk.orders });
      qc.invalidateQueries({ queryKey: ['order'] });
    }, (data) => {
      const to = noticeTarget(String(data.kind ?? ''), data);
      if (to) router.push(to);
    });
  }, [ready, userId, qc]);

  return null;
}
