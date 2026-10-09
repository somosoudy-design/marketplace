import type { Fulfillment, FulfillmentEvent, FulfillmentStep, MyReview, OrderItem } from '@kora/api';
import { D, describeEtaDates, formatMoney, formatRate, formatUSD, OBLIGATION_KIND_LABEL, ORDER_STATUS_LABEL, PAYMENT_RECORD_LABEL, PAYMENT_STATUS_LABEL, type Currency } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { SummaryRow } from '@/components/checkout/Rows';
import { ProductImage } from '@/components/catalog/ProductImage';
import { ReviewSheet } from '@/components/reviews/ReviewSheet';
import { Stars } from '@/components/reviews/Reviews';
import { Badge } from '@/components/ui/Badge';
import { ScalePressable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { paymentRecordTone, paymentTone, shortDate, shortDateTime } from '@/lib/format';
import { useFulfillmentSteps, useOrder } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const qc = useQueryClient();
  const order = useOrder(id);
  const steps = useFulfillmentSteps();
  const itemIds = order.data?.order_items.map((i) => i.id) ?? [];
  const delivered = order.data?.fulfillments.some((f) => f.status === 'delivered') ?? false;
  const myReviews = useQuery({ queryKey: qk.myReviews(id), queryFn: () => api.reviews.mine(itemIds), enabled: delivered && itemIds.length > 0 });
  const [reviewing, setReviewing] = useState<OrderItem | null>(null);
  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(id, 'Cancelado por el comprador desde la app'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.order(id) });
      qc.invalidateQueries({ queryKey: qk.orders });
    },
  });

  if (order.isError) return <ErrorState onRetry={() => order.refetch()} />;
  const o = order.data;
  if (order.isLoading) return <View style={{ padding: 16, gap: 12, flex: 1, backgroundColor: t.colors.background }}>{[100, 180, 240].map((h, i) => <Skeleton key={i} height={h} radius={t.radii.lg} />)}</View>;
  if (!o) return <EmptyState icon="receipt" title="No encontramos este pedido" />;

  const outstanding = D(o.total_usd).minus(o.refunded_usd ?? 0).minus(o.paid_usd);
  const pendingPayment = o.payments.some((p) => p.status === 'pending_verification' || p.status === 'processing');
  const canPay = o.status !== 'cancelled' && o.payment_obligations.some((x) => x.status === 'pending' || x.status === 'partially_paid');
  const canCancel = o.status === 'placed' && D(o.paid_usd).isZero() && !pendingPayment;
  const ship = o.ship_to as Record<string, string> | null;

  const confirmCancel = () => {
    if (Platform.OS === 'web') return cancel.mutate();
    Alert.alert('¿Cancelar el pedido?', 'Liberamos los productos apartados. Esta acción no se puede deshacer.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar pedido', style: 'destructive', onPress: () => cancel.mutate() },
    ]);
  };

  return (
    <ScrollView
      testID="order-scroll"
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={order.isRefetching} onRefresh={() => order.refetch()} tintColor={t.colors.brand} />}
    >
      <Stack.Screen options={{ title: o.number }} />
      <View style={{ gap: 8 }}>
        <Text variant="displayM" testID="order-number">Pedido {o.number}</Text>
        <Text variant="bodySmall" color="textMuted">Realizado el {shortDateTime(o.placed_at)}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Badge label={ORDER_STATUS_LABEL[o.status] ?? o.status} tone={o.status === 'cancelled' ? 'muted' : o.status === 'completed' ? 'success' : 'brand'} />
          <Badge label={PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status} tone={paymentTone(o.payment_status)} />
        </View>
      </View>

      {o.status === 'cancelled' ? <Banner tone="danger" icon="x" title="Pedido cancelado" body={o.cancel_reason ?? undefined} /> : null}
      {o.payment_status === 'refund_due' ? <Banner tone="info" icon="wallet" title="Reembolso en proceso" body="Te contactaremos para enviarte el reembolso por el método acordado." /> : null}

      {/* payments */}
      <Card style={{ gap: 10 }}>
        <Text variant="title">Pagos</Text>
        <SummaryRow label="Total" value={formatUSD(o.total_usd)} />
        {Number(o.refunded_usd) > 0 ? <SummaryRow label="Reembolsado" value={`− ${formatUSD(o.refunded_usd)}`} /> : null}
        <SummaryRow label="Pagado y confirmado" value={formatUSD(o.paid_usd)} />
        <Divider />
        <SummaryRow label="Saldo pendiente" value={formatUSD(outstanding.isNegative() ? 0 : outstanding)} strong testID="order-outstanding" />
        {o.payment_obligations.length > 1 ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            {o.payment_obligations.map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={x.status === 'paid' ? 'circle-check' : 'clock'} size={16} color={x.status === 'paid' ? t.colors.success : t.colors.textMuted} />
                <Text variant="bodySmall" style={{ flex: 1 }}>
                  {OBLIGATION_KIND_LABEL[x.kind]}{x.kind === 'installment' ? ` ${x.seq}` : ''}{x.due_date ? ` · ${shortDate(x.due_date)}` : ''}
                </Text>
                <Text variant="label" tabular>{formatUSD(x.amount_usd)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {o.payments.length ? <Divider /> : null}
        {o.payments.map((p) => (
          <View key={p.id} style={{ gap: 2 }} testID={`payment-${p.number}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text variant="bodySmall" style={{ fontFamily: 'Manrope_600SemiBold' }}>{p.number} · {formatMoney(p.amount, p.currency as Currency)}</Text>
              <Badge label={PAYMENT_RECORD_LABEL[p.status] ?? p.status} tone={paymentRecordTone(p.status)} />
            </View>
            <Text variant="caption" color="textMuted">
              {shortDateTime(p.created_at)}{p.currency === 'VES' && p.rate_applied ? ` · ${formatRate(p.rate_applied)}` : ''}{p.usd_recognized ? ` · acreditado ${formatUSD(p.usd_recognized)}` : ''}
            </Text>
            {p.rejection_reason ? <Text variant="caption" color="danger">{p.rejection_reason}</Text> : null}
          </View>
        ))}
        {canPay ? (
          <Button testID="order-pay" title={pendingPayment ? 'Pago en verificación' : 'Pagar ahora'} disabled={pendingPayment} onPress={() => router.push({ pathname: '/pay/[orderId]', params: { orderId: o.id } })} style={{ marginTop: 6 }} />
        ) : null}
      </Card>

      {/* deliveries */}
      {o.fulfillments.map((f, i) => (
        <FulfillmentCard
          key={f.id}
          f={f}
          index={i}
          total={o.fulfillments.length}
          items={o.order_items.filter((it) => it.fulfillment_id === f.id)}
          steps={(steps.data ?? []).filter((s) => s.flow === f.flow)}
          reviews={myReviews.data ?? []}
          onReview={setReviewing}
        />
      ))}

      {ship ? (
        <Card style={{ gap: 4 }}>
          <Text variant="label">Entrega a</Text>
          <Text variant="bodySmall" color="textSecondary">{ship.recipient} · {ship.phone}</Text>
          <Text variant="bodySmall" color="textSecondary">{ship.line1}</Text>
          <Text variant="bodySmall" color="textSecondary">{[ship.municipality, ship.city, ship.region_name].filter(Boolean).join(', ')}</Text>
        </Card>
      ) : null}

      {canCancel ? <Button testID="order-cancel" title="Cancelar pedido" variant="danger" loading={cancel.isPending} onPress={confirmCancel} /> : null}
      {cancel.error ? <Banner tone="danger" icon="circle-alert" body={(cancel.error as Error).message} /> : null}
      <ReviewSheet
        key={reviewing?.id ?? 'none'}
        item={reviewing}
        existing={myReviews.data?.find((r) => r.order_item_id === reviewing?.id)}
        orderId={id}
        onClose={() => setReviewing(null)}
      />
    </ScrollView>
  );
}

function FulfillmentCard({ f, index, total, items, steps, reviews, onReview }: { f: Fulfillment & { fulfillment_events: FulfillmentEvent[] }; index: number; total: number; items: OrderItem[]; steps: FulfillmentStep[]; reviews: MyReview[]; onReview: (item: OrderItem) => void }) {
  const t = useTheme();
  const reached = new Map<string, string>();
  f.fulfillment_events.filter((e) => e.visible_to_buyer).forEach((e) => reached.set(e.step_code, e.created_at));
  const current = steps.find((s) => s.code === f.status);
  const visibleSteps = steps.filter((s) => !s.is_terminal || s.code === f.status || s.code === 'delivered');
  const canClaim = ['delivered', 'dispatched', 'in_transit', 'out_for_delivery', 'ready_for_pickup'].includes(f.status);
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 16, gap: 6, backgroundColor: t.colors.surfaceSunken }}>
        <Text variant="overline" color="textMuted">{total > 1 ? `ENTREGA ${index + 1} DE ${total}` : 'ENTREGA'}</Text>
        <Text variant="title" testID={`fulfillment-status-${index}`}>{current?.buyer_label ?? current?.label ?? f.status}</Text>
        {current?.buyer_description ? <Text variant="bodySmall" color="textSecondary">{current.buyer_description}</Text> : null}
        {f.eta_min_date && f.eta_max_date && f.status !== 'delivered' && f.status !== 'cancelled' ? (
          <Text variant="bodySmall" color="brand">{describeEtaDates(f.eta_min_date, f.eta_max_date)}</Text>
        ) : null}
        {f.tracking_number ? (
          <Text variant="bodySmall" selectable>Guía {f.carrier_name ? `${f.carrier_name} ` : ''}<Text variant="bodySmall" style={{ fontFamily: 'Manrope_700Bold' }}>{f.tracking_number}</Text></Text>
        ) : null}
        <Text variant="caption" color="textMuted">{f.shipping_method_name}</Text>
      </View>
      <View style={{ padding: 16, gap: 0 }}>
        {visibleSteps.map((s, i) => {
          const at = reached.get(s.code);
          const isCurrent = s.code === f.status;
          const done = !!at;
          return (
            <View key={s.code} style={{ flexDirection: 'row', gap: 12 }} accessibilityLabel={`${s.buyer_label ?? s.label}${done ? ', completado' : ''}`}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <View style={{ width: isCurrent ? 16 : 12, height: isCurrent ? 16 : 12, borderRadius: 8, marginTop: 3, backgroundColor: done ? t.colors.brand : t.colors.surface, borderWidth: 2, borderColor: done ? t.colors.brand : t.colors.borderStrong }} />
                {i < visibleSteps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: done && reached.has(visibleSteps[i + 1]!.code) ? t.colors.brand : t.colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text variant={isCurrent ? 'label' : 'bodySmall'} color={done ? 'text' : 'textMuted'}>{s.buyer_label ?? s.label}</Text>
                {at ? <Text variant="caption" color="textMuted">{shortDateTime(at)}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
      <Divider />
      {items.map((it) => {
        const review = reviews.find((r) => r.order_item_id === it.id);
        return (
          <View key={it.id} style={{ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' }}>
            <ScalePressable accessibilityRole="link" accessibilityLabel={`Ver ${it.title}`} onPress={() => router.push({ pathname: '/product/[id]', params: { id: it.product_id } })} style={{ flexDirection: 'row', gap: 12, flex: 1 }}>
              <ProductImage path={it.image_path} style={{ width: 48 }} radius={t.radii.sm} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySmall" numberOfLines={2}>{it.title}</Text>
                <Text variant="caption" color="textMuted">{it.variant_title ? `${it.variant_title} · ` : ''}{it.quantity} × {formatUSD(it.unit_price_usd)}</Text>
                {it.refunded_qty > 0 ? <Text variant="caption" color="info">Reembolsado: {it.refunded_qty} ({formatUSD(it.refunded_usd)})</Text> : null}
                {review ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Stars value={review.rating} size={12} />
                    <Text variant="caption" color="textMuted">{review.status === 'hidden' ? 'Oculta por moderación' : 'Tu opinión'}</Text>
                  </View>
                ) : null}
              </View>
            </ScalePressable>
            {f.status === 'delivered' ? (
              <Button testID={`review-${it.id}`} title={review ? 'Editar' : 'Calificar'} size="sm" variant={review ? 'ghost' : 'secondary'} icon={review ? undefined : 'star'} onPress={() => onReview(it)} />
            ) : null}
          </View>
        );
      })}
      {canClaim ? (
        <View style={{ padding: 14, paddingTop: 0 }}>
          <Button title="Reportar un problema" variant="secondary" size="sm" icon="message-circle" onPress={() => router.push({ pathname: '/claim/[fulfillmentId]', params: { fulfillmentId: f.id } })} />
        </View>
      ) : null}
    </Card>
  );
}
