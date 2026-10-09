import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { timeAgo } from '@/lib/format';
import { useNotifications } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

const KIND_ICON: Record<string, IconName> = {
  order_placed: 'receipt', payment_received: 'hourglass', payment_confirmed: 'circle-check', payment_rejected: 'circle-alert',
  fulfillment_update: 'truck', order_dispatched: 'truck', order_delivered: 'package', installment_due: 'calendar',
  claim_update: 'message-circle', back_in_stock: 'bell', seller_new_order: 'store', product_moderation: 'shield-check', system: 'info',
};

export default function NotificationsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const q = useNotifications();
  const markAll = useMutation({ mutationFn: () => api.account.markNotificationsRead(), onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }) });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  useEffect(() => {
    // opening the center marks everything as read after a short moment, keeping the dots visible on arrival
    if (unread) {
      const id = setTimeout(() => markAll.mutate(), 2500);
      return () => clearTimeout(id);
    }
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <FlatList
      testID="notifications-list"
      data={q.data ?? []}
      keyExtractor={(n) => n.id}
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      ListEmptyComponent={q.isLoading ? <View style={{ gap: 10 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} radius={t.radii.lg} />)}</View> : <EmptyState icon="bell" title="Sin notificaciones" body="Te avisaremos de pagos, envíos y reclamos." />}
      renderItem={({ item: n }) => {
        const data = (n.data ?? {}) as Record<string, string>;
        const target = data.order_id ? { pathname: '/orders/[id]' as const, params: { id: data.order_id } } : data.product_id ? { pathname: '/product/[id]' as const, params: { id: data.product_id } } : null;
        return (
          <ScalePressable
            scaleTo={0.99}
            accessibilityRole={target ? 'link' : undefined}
            disabled={!target}
            onPress={() => target && router.push(target)}
            style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: t.radii.lg, backgroundColor: n.read_at ? t.colors.surface : t.colors.brandSoft, borderWidth: 1, borderColor: t.colors.border }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={KIND_ICON[n.kind] ?? 'bell'} size={19} color={t.colors.brand} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text variant="label" style={{ flex: 1 }}>{n.title}</Text>
                <Text variant="caption" color="textMuted">{timeAgo(n.created_at)}</Text>
              </View>
              <Text variant="bodySmall" color="textSecondary">{n.body}</Text>
              {n.is_test ? <Text variant="caption" color="textMuted">Notificación de prueba (datos de demostración)</Text> : null}
            </View>
          </ScalePressable>
        );
      }}
    />
  );
}
