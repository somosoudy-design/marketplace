import { ApiError, type Address, type CheckoutSummary, type DeliveryGroup, type ShippingSelection } from '@kora/api';
import { describeEtaDates, formatUSD, OBLIGATION_KIND_LABEL } from '@kora/core';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ProductImage } from '@/components/catalog/ProductImage';
import { BottomBar, ChangingText } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useAddresses } from '@/lib/hooks';
import { intentKey } from '@/lib/ids';
import { api } from '@/lib/supabase';
import { RadioRow, SummaryRow } from '@/components/checkout/Rows';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const MAX_W = 720;

export default function CheckoutScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user, cartSyncing } = useAuth();
  const addresses = useAddresses();
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  // until the buyer picks one, the default (or first) saved address is used
  const addressId = chosenAddressId ?? (addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0])?.id ?? null;
  const [pickAddress, setPickAddress] = useState(false);
  const [shipping, setShipping] = useState<ShippingSelection>({});
  const [plan, setPlan] = useState('full');
  // one key per checkout visit: double taps and retries resolve to the same order
  const orderKey = useRef(intentKey('order')).current;

  const preview = useQuery({
    queryKey: ['checkout', addressId, shipping, plan],
    queryFn: () => api.checkout.preview(addressId, shipping, plan),
    enabled: !!user && !cartSyncing && addresses.isSuccess,
    placeholderData: keepPreviousData,
  });
  const s = preview.data;

  // if the selected plan is not offered for this cart (e.g. seller items), fall back to the first offered plan
  if (s && !s.plans.some((p) => p.code === plan) && s.plans[0]) setPlan(s.plans[0].code);

  const place = useMutation({
    mutationFn: () => api.checkout.placeOrder(addressId!, currentSelection(s, shipping), plan, orderKey),
    onSuccess: (r) => {
      haptics.success();
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      router.replace({ pathname: '/pay/[orderId]', params: { orderId: r.order_id, fresh: '1' } });
    },
    onError: (e) => {
      haptics.warning();
      if (e instanceof ApiError && ['shipping_invalid', 'insufficient_stock', 'sold_out', 'unavailable', 'cart_has_issues'].includes(e.code)) preview.refetch();
    },
  });

  if (!user) return <EmptyState icon="lock" title="Inicia sesión para continuar" action="Iniciar sesión" onAction={() => router.replace('/sign-in')} />;
  if (preview.isError && !s) return <ErrorState onRetry={() => preview.refetch()} />;
  if (!s) {
    return (
      <View style={{ padding: 16, gap: 14, backgroundColor: t.colors.background, flex: 1 }}>
        {[160, 220, 140].map((h, i) => <Skeleton key={i} height={h} radius={t.radii.lg} />)}
      </View>
    );
  }
  if (s.line_count === 0) {
    return <EmptyState icon="shopping-bag" title="Tu carrito está vacío" action="Explorar" onAction={() => router.replace('/explore')} />;
  }

  const address = s.address as Address | null;
  const firstPayment = s.schedule.find((x) => x.due_in_days === 0)?.amount_usd ?? s.schedule[0]?.amount_usd;
  const blocking = s.issues > 0 ? 'Algunos productos cambiaron. Vuelve al carrito para revisarlos.' : s.needs_address ? 'Agrega una dirección de entrega.' : s.needs_shipping ? 'Una de las entregas no tiene envío disponible a esa dirección.' : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView testID="checkout-scroll" contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 200, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        {/* 1. address */}
        <Section step={1} title="Entrega en">
          {address && !pickAddress ? (
            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="map-pin" size={20} color={t.colors.brand} />
              <View style={{ flex: 1, gap: 2 }} testID="checkout-address">
                <Text variant="label">{address.label} · {address.recipient}</Text>
                <Text variant="bodySmall" color="textSecondary">{address.line1}</Text>
                <Text variant="bodySmall" color="textSecondary">{[address.municipality, address.city].filter(Boolean).join(', ')} · {address.phone}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setPickAddress(true)} hitSlop={8}>
                <Text variant="label" color="brand">Cambiar</Text>
              </Pressable>
            </Card>
          ) : (
            <Card padded={false}>
              {(addresses.data ?? []).map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <RadioRow
                    selected={a.id === addressId}
                    title={`${a.label} · ${a.recipient}`}
                    subtitle={`${a.line1}, ${a.city}`}
                    onPress={() => { setAddressId(a.id); setShipping({}); setPickAddress(false); }}
                  />
                </View>
              ))}
              {addresses.data?.length ? <Divider /> : null}
              <Pressable testID="checkout-add-address" accessibilityRole="button" onPress={() => router.push({ pathname: '/addresses/edit', params: { from: 'checkout' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
                <Icon name="plus" size={20} color={t.colors.brand} />
                <Text variant="label" color="brand">Agregar dirección</Text>
              </Pressable>
            </Card>
          )}
        </Section>

        {/* 2. deliveries */}
        <Section step={2} title={s.groups.length > 1 ? `${s.groups.length} entregas` : 'Envío'}>
          {s.groups.length > 1 ? <Text variant="bodySmall" color="textSecondary">Tus productos salen de lugares distintos, así que llegan por separado. Cada entrega tiene su propio envío y seguimiento.</Text> : null}
          {s.groups.map((g, i) => (
            <DeliveryCard key={g.key} group={g} index={i} total={s.groups.length} onSelect={(methodId) => setShipping((x) => ({ ...currentSelection(s, x), [g.key]: methodId }))} />
          ))}
        </Section>

        {/* 3. plan */}
        <Section step={3} title="Cómo quieres pagar">
          <Card padded={false}>
            {s.plans.map((p, i) => (
              <View key={p.code}>
                {i > 0 ? <Divider inset={16} /> : null}
                <RadioRow testID={`plan-${p.code}`} selected={plan === p.code} title={p.name} subtitle={p.description ?? undefined} onPress={() => setPlan(p.code)} />
              </View>
            ))}
          </Card>
          {s.schedule.length > 1 ? (
            <Card style={{ gap: 10 }}>
              <Text variant="label">Calendario de pagos (en USD)</Text>
              {s.schedule.map((x) => (
                <View key={x.seq} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodySmall" color="textSecondary">
                    {OBLIGATION_KIND_LABEL[x.kind] ?? 'Pago'} {x.kind === 'installment' ? x.seq : ''} · {x.due_in_days === 0 ? 'hoy' : `en ${x.due_in_days} días`}
                  </Text>
                  <Text variant="label" tabular>{formatUSD(x.amount_usd)}</Text>
                </View>
              ))}
              <Text variant="caption" color="textMuted">Tu saldo pendiente queda en dólares. Si pagas en bolívares, el monto se calcula con la tasa del día de cada pago.</Text>
            </Card>
          ) : null}
        </Section>

        {/* 4. summary */}
        <Section step={4} title="Resumen">
          <Card style={{ gap: 10 }}>
            <SummaryRow label={`Productos (${s.line_count})`} value={formatUSD(s.items_usd)} />
            <SummaryRow label="Envío" value={s.needs_shipping ? 'Por definir' : Number(s.shipping_usd) === 0 ? 'Gratis' : formatUSD(s.shipping_usd)} />
            {Number(s.financing_usd) > 0 ? <SummaryRow label="Recargo por cuotas" value={formatUSD(s.financing_usd)} /> : null}
            <Divider />
            <SummaryRow label="Total" value={formatUSD(s.total_usd)} strong testID="checkout-total" />
          </Card>
        </Section>
        {place.error ? <Banner tone="danger" icon="circle-alert" body={(place.error as Error).message} /> : null}
      </ScrollView>

      <BottomBar maxWidth={MAX_W}>
          {blocking ? <Text variant="caption" color="danger">{blocking}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text variant="subtitle">{s.schedule.length > 1 ? 'Pagas hoy' : 'Total'}</Text>
            <ChangingText value={formatUSD(firstPayment ?? s.total_usd)}>
              <Text variant="priceLarge" style={{ fontSize: 22 }} tabular>{formatUSD(firstPayment ?? s.total_usd)}</Text>
            </ChangingText>
          </View>
          <Button
            testID="checkout-place"
            title="Confirmar pedido"
            size="lg"
            full
            loading={place.isPending}
            disabled={!s.can_place || !!blocking || preview.isFetching}
            onPress={() => place.mutate()}
          />
          <Text variant="caption" color="textMuted" align="center">En el siguiente paso eliges el método de pago y ves el monto exacto.</Text>
      </BottomBar>
    </View>
  );
}

/** Keeps the server's default choice for groups the buyer did not touch, so the order matches what was shown. */
function currentSelection(s: CheckoutSummary | undefined, picked: ShippingSelection): ShippingSelection {
  const out: ShippingSelection = {};
  s?.groups.forEach((g) => {
    const id = picked[g.key] ?? g.selected_shipping?.method_id;
    if (id) out[g.key] = id;
  });
  return out;
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.text, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="caption" style={{ color: t.colors.surface, fontFamily: 'Manrope_700Bold' }}>{step}</Text>
        </View>
        <Text variant="title">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function DeliveryCard({ group: g, index, total, onSelect }: { group: DeliveryGroup; index: number; total: number; onSelect: (methodId: string) => void }) {
  const t = useTheme();
  const sel = g.selected_shipping;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="label" style={{ flex: 1 }}>{total > 1 ? `Entrega ${index + 1} · ` : ''}{g.label}</Text>
          <Text variant="caption" color="textMuted">{g.store.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {g.lines.slice(0, 5).map((l) => <ProductImage key={l.variant_id} path={l.image_path} style={{ width: 44 }} radius={t.radii.sm} />)}
          {g.lines.length > 5 ? <Text variant="caption" color="textMuted">+{g.lines.length - 5}</Text> : null}
        </View>
      </View>
      <Divider />
      {g.shipping_options == null ? (
        <View style={{ padding: 14 }}><Text variant="bodySmall" color="textMuted">Agrega una dirección para ver las opciones y el costo del envío.</Text></View>
      ) : g.shipping_options.length === 0 ? (
        <View style={{ padding: 14 }}><Text variant="bodySmall" color="danger">No hay envío disponible a esta dirección para esta entrega.</Text></View>
      ) : (
        g.shipping_options.map((o, i) => (
          <View key={o.method_id}>
            {i > 0 ? <Divider inset={16} /> : null}
            <RadioRow
              testID={`shipping-${o.code}`}
              selected={sel?.method_id === o.method_id}
              title={o.name}
              subtitle={`${describeEtaDates(o.eta_min_date, o.eta_max_date)}${o.kind !== 'home_delivery' ? ' · retiras tú' : ''}`}
              trailing={Number(o.cost_usd) === 0 ? 'Gratis' : formatUSD(o.cost_usd)}
              badge={o.is_demo ? 'Tarifa de ejemplo' : undefined}
              onPress={() => onSelect(o.method_id)}
            />
          </View>
        ))
      )}
    </Card>
  );
}
