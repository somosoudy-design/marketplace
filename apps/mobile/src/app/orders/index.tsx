import { formatUSD, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@kora/core';
import { router } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { ProductImage } from '@/components/catalog/ProductImage';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { paymentTone, shortDate } from '@/lib/format';
import { useOrders } from '@/lib/hooks';
import { useTheme } from '@/theme';

export default function OrdersScreen() {
  const t = useTheme();
  const orders = useOrders();
  if (orders.isError) return <ErrorState onRetry={() => orders.refetch()} />;
  return (
    <FlatList
      testID="orders-list"
      data={orders.data ?? []}
      keyExtractor={(o) => o.id}
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => orders.refetch()} tintColor={t.colors.brand} />}
      ListEmptyComponent={
        orders.isLoading ? (
          <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={t.radii.lg} />)}</View>
        ) : (
          <EmptyState icon="receipt" title="Aún no tienes pedidos" body="Cuando compres, aquí verás el estado de cada entrega." action="Explorar" onAction={() => router.navigate('/explore')} />
        )
      }
      renderItem={({ item: o }) => (
        <ScalePressable
          testID={`order-${o.number}`}
          scaleTo={0.99}
          accessibilityRole="link"
          accessibilityLabel={`Pedido ${o.number}, ${ORDER_STATUS_LABEL[o.status]}`}
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } })}
          style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: t.radii.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}
        >
          <View style={{ flexDirection: 'row' }}>
            {o.order_items.slice(0, 2).map((i, idx) => (
              <ProductImage key={idx} path={i.image_path} style={{ width: 52, marginLeft: idx ? -18 : 0, borderWidth: 2, borderColor: t.colors.surface }} radius={t.radii.sm} />
            ))}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{o.number}</Text>
              <Text variant="label" tabular>{formatUSD(o.total_usd)}</Text>
            </View>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {shortDate(o.placed_at)} · {o.order_items.map((i) => i.title).join(', ')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={ORDER_STATUS_LABEL[o.status] ?? o.status} tone={o.status === 'cancelled' ? 'muted' : o.status === 'completed' ? 'success' : 'brand'} />
              <Badge label={PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status} tone={paymentTone(o.payment_status)} />
            </View>
          </View>
          <Icon name="chevron-right" size={18} color={t.colors.textMuted} />
        </ScalePressable>
      )}
    />
  );
}
