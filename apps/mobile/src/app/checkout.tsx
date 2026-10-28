import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { ApiError, type CheckoutSummary, type DeliveryGroup, type ShippingSelection } from '@kora/api';
import { describeEtaDates, formatUSD, OBLIGATION_KIND_LABEL } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ProductImage } from '@/components/catalog/ProductImage';
import { BottomBar, ChangingText } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Card, Divider } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { registerCheckoutWebBack } from '@/lib/checkout-navigation';
import { haptics } from '@/lib/haptics';
import { useAddresses } from '@/lib/hooks';
import { intentKey } from '@/lib/ids';
import { api } from '@/lib/supabase';
import { RadioRow, SummaryRow } from '@/components/checkout/Rows';
import { Sheet } from '@/components/ui/Sheet';
import { ScalePressable } from '@/components/ui/Pressable';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const MAX_W = 720;
const STEPS = [
  { title: 'Dirección de entrega', body: 'Elige dónde recibirás tu compra para consultar las opciones de envío.' },
  { title: 'Tus entregas', body: 'Revisa los productos y elige cómo recibir cada entrega.' },
  { title: 'Plan de pago', body: 'Elige cómo distribuir el pago. El método y la moneda se seleccionan después de crear el pedido.' },
  { title: 'Revisa tu pedido', body: 'Revisa los productos y confirma el pedido. El pago viene después.' },
] as const;

type OrderSelection = { addressId: string; shipping: ShippingSelection; plan: string };
type Preview = CheckoutSummary & { recoveredShipping: boolean };

export default function CheckoutScreen() {
  const t = useTheme();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const qc = useQueryClient();
  const navigation = useNavigation();
  const { user, cartSyncing } = useAuth();
  const addresses = useAddresses();
  const [step, setStep] = useState(0);
  const [deliveryIndex, setDeliveryIndex] = useState(0);
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const addressId = (addresses.data?.some((a) => a.id === chosenAddressId) ? chosenAddressId : null)
    ?? (addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0])?.id ?? null;
  const [pickAddress, setPickAddress] = useState(false);
  const [shipping, setShipping] = useState<ShippingSelection>({});
  const [shippingAddressId, setShippingAddressId] = useState<string | null>(null);
  const [shippingRecovered, setShippingRecovered] = useState(false);
  const [lastPreview, setLastPreview] = useState<{ userId: string; summary: Preview } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [plan, setPlan] = useState('full');
  const [barHeight, setBarHeight] = useState(150);
  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const submitting = useRef(false);
  const leaving = useRef(false);
  // One intent per checkout visit, including back, edits and retries after a lost response.
  const orderKey = useRef(intentKey('order')).current;

  // A deleted/default/edited address can change the effective destination outside the picker too.
  if (addressId !== shippingAddressId && !confirming) {
    setShippingAddressId(addressId);
    setShipping({});
    setDeliveryIndex(0);
    if (step > 0) setStep(0);
  }

  const preview = useQuery({
    queryKey: ['checkout', user?.id, addressId, shipping, plan],
    queryFn: async () => {
      let selection = shipping;
      let planCode: string | null = plan;
      let recoveredShipping = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return { ...await api.checkout.preview(addressId, selection, planCode), recoveredShipping }; }
        catch (e) {
          // Null returns eligible plans without a schedule. The next query uses an offered code.
          if (e instanceof ApiError && e.code === 'plan_invalid' && planCode !== null) { planCode = null; continue; }
          if (e instanceof ApiError && e.code === 'shipping_invalid' && Object.keys(selection).length) { selection = {}; recoveredShipping = true; continue; }
          throw e;
        }
      }
      throw new Error('No pudimos actualizar las opciones. Intenta de nuevo.');
    },
    enabled: !!user && !cartSyncing && addresses.isSuccess && !confirming,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  // A changed query key loses its placeholder on failure. Keep the last server snapshot legible,
  // scoped to this account, while the fresh/error guards prevent using it to advance or confirm.
  const s = preview.data ?? (lastPreview?.userId === user?.id ? lastPreview?.summary : undefined);
  if (preview.data && !preview.isPlaceholderData && user && preview.data !== lastPreview?.summary) setLastPreview({ userId: user.id, summary: preview.data });

  if (s && !preview.isPlaceholderData && !s.plans.some((p) => p.code === plan) && s.plans[0]) setPlan(s.plans[0].code);
  if (s?.recoveredShipping && !preview.isPlaceholderData && Object.keys(shipping).length) {
    setShipping({});
    setShippingRecovered(true);
    setDeliveryIndex(0);
    setStep(1);
  }

  const place = useMutation({
    mutationFn: (selection: OrderSelection) => api.checkout.placeOrder(selection.addressId, selection.shipping, selection.plan, orderKey),
    onSuccess: () => {
      haptics.success();
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => {
      submitting.current = false;
      setConfirming(false);
      haptics.warning();
      if (e instanceof ApiError) {
        if (e.code === 'plan_invalid') setStep(2);
        if (e.code === 'shipping_invalid') {
          setShipping({});
          setShippingRecovered(true);
          setDeliveryIndex(0);
          setStep(1);
        }
        if (['plan_invalid', 'shipping_invalid', 'insufficient_stock', 'sold_out', 'unavailable', 'cart_has_issues'].includes(e.code)) preview.refetch();
      }
    },
  });

  const resetOrderError = place.reset;
  const goTo = useCallback((next: number, groupIndex = 0) => {
    if (submitting.current) return;
    resetOrderError();
    setDeliveryIndex(groupIndex);
    setStep(next);
  }, [resetOrderError]);
  const deliveryCount = s?.groups.length ?? 1;
  const back = useCallback(() => {
    if (submitting.current) return;
    if (step === 1 && deliveryIndex > 0) goTo(1, deliveryIndex - 1);
    else if (step > 0) goTo(step - 1, step === 2 ? Math.max(0, deliveryCount - 1) : 0);
    else if (router.canGoBack()) router.back();
    else router.replace('/cart');
  }, [step, deliveryIndex, deliveryCount, goTo]);
  // Native/header/browser back follows the phases instead of discarding the checkout selection.
  usePreventRemove(!!user && (step > 0 || place.isPending) && !place.isSuccess, ({ data }) => {
    if (leaving.current && !submitting.current) navigation.dispatch(data.action);
    else back();
  });
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    return registerCheckoutWebBack({
      shouldHandle: () => !leaving.current && !place.isSuccess && (step > 0 || submitting.current),
      isSubmitting: () => submitting.current && !place.isSuccess,
      onBack: back,
    });
  }, [step, back, place.isSuccess]));
  useEffect(() => {
    if (place.isSuccess && place.data) router.replace({ pathname: '/pay/[orderId]', params: { orderId: place.data.order_id, fresh: '1' } });
  }, [place.isSuccess, place.data]);
  const hasSummary = !!s;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (Platform.OS === 'web') (headingRef.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
      else if (Platform.OS === 'android' && headingRef.current) {
        const tag = findNodeHandle(headingRef.current);
        if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step, deliveryIndex, hasSummary]);

  if (!user) return <EmptyState icon="lock" title="Inicia sesión para continuar" action="Iniciar sesión" onAction={() => router.replace('/sign-in')} />;
  if (addresses.isError) return <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />;
  if (preview.isError && !s) return <ErrorState error={preview.error} onRetry={() => preview.refetch()} />;
  if (!s) return <View style={{ padding: 16, gap: 14, backgroundColor: t.colors.background, flex: 1 }}><Skeleton height={65} /><Skeleton height={200} radius={t.radii.lg} /></View>;
  if (s.line_count === 0 && !place.isSuccess) return <EmptyState icon="shopping-bag" title="Tu carrito está vacío" action="Explorar" onAction={() => router.replace('/explore')} />;

  const address = s.address;
  const activeIndex = Math.min(deliveryIndex, Math.max(0, s.groups.length - 1));
  const group = s.groups[activeIndex];
  const fresh = !preview.isFetching && !preview.isError && !preview.isPlaceholderData && !addresses.isFetching && !cartSyncing;
  const busy = confirming || place.isPending || place.isSuccess;
  const editable = fresh && !busy;
  const addressEditable = !busy && !addresses.isFetching;
  const addressReady = !!address && !s.needs_address;
  const groupReady = !!group?.selected_shipping && !!group.shipping_options?.some((o) => o.method_id === group.selected_shipping?.method_id);
  const planReady = s.plans.some((p) => p.code === plan) && s.plan?.code === plan;
  const blocking = s.issues > 0 ? 'Algunos productos cambiaron. Vuelve al carrito para revisarlos.'
    : !addressReady ? 'Agrega o selecciona una dirección para continuar.'
    : step > 0 && (step === 1 ? !groupReady : s.needs_shipping) ? 'No hay envío disponible para esta entrega. Prueba con otra dirección.' : null;
  const canContinue = editable && !blocking && (step === 0 ? addressReady : step === 1 ? groupReady : !s.needs_shipping && planReady);
  const canPlace = editable && !blocking && s.can_place && planReady;
  const firstPayment = s.schedule.find((x) => x.due_in_days === 0)?.amount_usd ?? s.schedule[0]?.amount_usd;
  const compactReview = windowHeight < 720 || fontScale > 1.25;
  const nextTitle = step === 0 ? 'Continuar a entregas' : step === 1 ? activeIndex < s.groups.length - 1 ? 'Siguiente entrega' : 'Continuar al plan de pago' : 'Revisar pedido';
  const advance = () => {
    if (!canContinue || submitting.current) return;
    haptics.select();
    if (step === 1 && activeIndex < s.groups.length - 1) goTo(1, activeIndex + 1);
    else goTo(step + 1);
  };
  const confirm = () => {
    if (step !== 3 || !canPlace || !addressId || submitting.current) return;
    submitting.current = true;
    setConfirming(true);
    place.mutate({ addressId, shipping: currentSelection(s, shipping), plan });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen options={{ headerLeft: () => <IconButton testID="checkout-back" icon="chevron-left" label={step > 0 ? 'Volver al paso anterior' : 'Volver al carrito'} disabled={busy} onPress={back} /> }} />
      <ScrollView ref={scrollRef} testID="checkout-scroll" contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: barHeight + 24, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        <View style={{ gap: 14 }}>
          <View testID="checkout-progress" style={{ gap: 8 }}>
            <Text variant="caption" color="brand" accessibilityLiveRegion="polite">Paso {step + 1} de 4{step === 1 && s.groups.length > 1 ? ` · Entrega ${activeIndex + 1} de ${s.groups.length}` : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? t.colors.brand : t.colors.border }} />)}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <View ref={headingRef} focusable accessible accessibilityRole="header" accessibilityLabel={STEPS[step]!.title} testID="checkout-stage-heading"><Text variant="title" accessibilityRole="none">{STEPS[step]!.title}</Text></View>
            <Text variant="bodySmall" color="textSecondary">{STEPS[step]!.body}</Text>
          </View>
        </View>
        {preview.isError ? <View testID="checkout-refresh-error" style={{ gap: 8 }}><Banner tone="danger" body="No pudimos actualizar tu compra. Reintenta antes de continuar; tus selecciones siguen aquí." /><Button title="Reintentar actualización" variant="secondary" onPress={() => preview.refetch()} loading={preview.isFetching} /></View> : null}
        {place.error ? <Banner tone="danger" icon="circle-alert" body={place.error instanceof ApiError && place.error.code === 'plan_invalid' ? 'El plan cambió y no pudimos crear el pedido. Revisa las opciones disponibles.' : (place.error as Error).message} /> : null}

        {step === 0 ? <View testID="checkout-stage-address" style={{ gap: 12 }}>
          {address && !pickAddress ? <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Icon name="map-pin" size={20} color={t.colors.brand} />
              <View testID="checkout-address" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text variant="label">{address.label} · {address.recipient}</Text>
                <Text variant="bodySmall" color="textSecondary">{address.line1}</Text>
                <Text variant="bodySmall" color="textSecondary">{[address.municipality, address.city].filter(Boolean).join(', ')}</Text>
                <Text variant="bodySmall" color="textSecondary">{address.phone}</Text>
              </View>
            </View>
            <Button testID="checkout-change-address" title="Cambiar dirección" variant="secondary" disabled={!addressEditable} onPress={() => setPickAddress(true)} />
          </Card> : <Card padded={false}>
            {(addresses.data ?? []).map((a, i) => <View key={a.id}>
              {i > 0 ? <Divider inset={16} /> : null}
              <RadioRow testID={`checkout-address-${a.id}`} selected={a.id === addressId} title={`${a.label} · ${a.recipient}`} subtitle={`${a.line1}, ${a.city}`} disabled={!addressEditable} onPress={() => { setAddressId(a.id); setShipping({}); setDeliveryIndex(0); setPickAddress(false); }} />
            </View>)}
            {addresses.data?.length ? <Divider /> : null}
            <Pressable testID="checkout-add-address" disabled={!addressEditable} accessibilityRole="button" onPress={() => router.push({ pathname: '/addresses/edit', params: { from: 'checkout' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, minHeight: 48, opacity: addressEditable ? 1 : 0.4 }}>
              <Icon name="plus" size={20} color={t.colors.brand} /><Text variant="label" color="brand" style={{ flex: 1 }}>Agregar dirección</Text>
            </Pressable>
          </Card>}
        </View> : null}

        {step === 1 && group ? <View testID="checkout-stage-delivery" style={{ gap: 12 }}>
          {shippingRecovered ? <Banner tone="info" body="Las opciones de envío cambiaron. Revisa cada entrega antes de continuar." /> : null}
          <Text variant="bodySmall" color="textSecondary">{s.groups.length > 1 ? `Tu compra se divide en ${s.groups.length} entregas, cada una con su propio seguimiento.` : 'Estos productos se envían juntos y tienen un mismo seguimiento.'}</Text>
          <DeliveryCard key={group.key} group={group} index={activeIndex} total={s.groups.length} disabled={!editable} onSelect={(methodId) => setShipping((x) => ({ ...currentSelection(s, x), [group.key]: methodId }))} />
          {!groupReady && addressReady ? <Button title="Cambiar dirección de entrega" variant="secondary" onPress={() => goTo(0)} disabled={busy} /> : null}
        </View> : null}

        {step === 2 ? <View testID="checkout-stage-plan" style={{ gap: 16 }}>
          <Card padded={false}>
            {s.plans.map((p, i) => <View key={p.code}>
              {i > 0 ? <Divider inset={16} /> : null}
              <RadioRow testID={`plan-${p.code}`} selected={plan === p.code} title={p.name} subtitle={p.description ?? undefined} disabled={!editable} onPress={() => setPlan(p.code)} />
            </View>)}
          </Card>
          <PaymentSchedule summary={s} />
        </View> : null}

        {step === 3 ? <View testID="checkout-stage-review" style={{ gap: 16 }}>
          {s.groups.map((g, i) => <ReviewSection key={g.key} title={`Entrega ${i + 1} de ${s.groups.length} · ${g.store.name}`} testID={`checkout-edit-delivery-${i}`} disabled={busy} onEdit={() => goTo(1, i)}>
            <Text variant="caption" color="textSecondary">{g.label}</Text>
            {g.lines.map((l) => <View key={l.variant_id} testID={`checkout-review-line-${l.variant_id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 }}>
              <ProductImage productId={l.product_id} variantId={l.variant_id} path={l.image_path} aspect={1} fit="contain" radius={8} style={{ width: 56 }} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text variant="label">{l.title}</Text>
                <Text variant="caption" color="textSecondary">{l.variant_title ? `${l.variant_title} · ` : ''}Cantidad: {l.quantity}</Text>
                <Text variant="label" tabular>{formatUSD(l.line_total_usd)}</Text>
              </View>
            </View>)}
            {g.selected_shipping ? <View style={{ gap: 3 }}><Text variant="label">{g.selected_shipping.name} · {Number(g.selected_shipping.cost_usd) === 0 ? 'Gratis' : formatUSD(g.selected_shipping.cost_usd)}</Text><Text variant="caption" color="textSecondary">{describeEtaDates(g.selected_shipping.eta_min_date, g.selected_shipping.eta_max_date)}{g.selected_shipping.kind !== 'home_delivery' ? ' · retiras tú' : ''}{g.selected_shipping.is_demo && !isPrivateCatalogPresentation ? ' · tarifa de ejemplo' : ''}</Text></View> : null}
          </ReviewSection>)}
          <ReviewSection title="Dirección de entrega" testID="checkout-edit-address" disabled={busy} onEdit={() => goTo(0)}>
            {address ? <View testID="checkout-review-address" style={{ gap: 3 }}><Text variant="label">{address.recipient}</Text><Text variant="bodySmall" color="textSecondary">{address.line1}</Text><Text variant="bodySmall" color="textSecondary">{[address.municipality, address.city].filter(Boolean).join(', ')} · {address.phone}</Text></View> : null}
          </ReviewSection>
          <ReviewSection title="Plan de pago" testID="checkout-edit-plan" disabled={busy} onEdit={() => goTo(2)}>
            <Text variant="label">{s.plan?.name}</Text>
            <PaymentSchedule summary={s} />
          </ReviewSection>
          {compactReview ? <View testID="checkout-summary-detail" style={{ gap: 8 }}>
            <SummaryRow label="Productos" value={formatUSD(s.items_usd)} />
            <SummaryRow label="Envío" value={s.needs_shipping ? 'Por definir' : Number(s.shipping_usd) === 0 ? 'Gratis' : formatUSD(s.shipping_usd)} />
            {Number(s.financing_usd) > 0 ? <SummaryRow label="Recargo por cuotas" value={formatUSD(s.financing_usd)} /> : null}
            <Text variant="caption" color="textSecondary">Al confirmar se crea el pedido y se reservan tus productos. El pago viene después.</Text>
          </View> : null}
        </View> : null}
        {s.issues > 0 ? <Button title="Revisar carrito" variant="secondary" disabled={busy} onPress={() => { leaving.current = true; router.replace('/cart'); }} /> : null}
      </ScrollView>
      <BottomBar testID="checkout-bottom-bar" maxWidth={MAX_W} onHeightChange={setBarHeight} tone={step === 3 ? 'brand' : 'default'}>
        {blocking ? <Text variant="caption" color="danger" style={step === 3 ? { color: palette.coral[100] } : undefined}>{blocking}</Text> : null}
        {preview.isFetching ? <Text variant="caption" color="textSecondary" style={step === 3 ? { color: palette.violet[100] } : undefined} accessibilityLiveRegion="polite">Actualizando opciones…</Text> : null}
        {step === 3 ? <>
          {!compactReview ? <>
            <SummaryRow label="Productos" value={formatUSD(s.items_usd)} inverse />
            <SummaryRow label="Envío" value={s.needs_shipping ? 'Por definir' : Number(s.shipping_usd) === 0 ? 'Gratis' : formatUSD(s.shipping_usd)} inverse />
            {Number(s.financing_usd) > 0 ? <SummaryRow label="Recargo por cuotas" value={formatUSD(s.financing_usd)} inverse /> : null}
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 2 }} />
          </> : null}
          <SummaryRow label="Total del pedido" value={formatUSD(s.total_usd)} strong inverse testID="checkout-total" />
          {s.schedule.length > 1 ? <SummaryRow label="Pagas hoy" value={formatUSD(firstPayment ?? s.total_usd)} inverse /> : null}
          <Button testID="checkout-place" title="Confirmar pedido" variant="inverse" size="lg" full loading={place.isPending} disabled={!canPlace} onPress={confirm} />
          {!compactReview ? <Text variant="caption" align="center" style={{ color: palette.violet[100] }}>Al confirmar se crea el pedido y se reservan tus productos. El pago viene después.</Text> : null}
        </> : <>
          {step >= 2 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Text variant="subtitle">{s.schedule.length > 1 ? 'Pagas hoy' : 'Total'}</Text>
            <ChangingText value={formatUSD(firstPayment ?? s.total_usd)}><Text variant="priceLarge" style={{ fontSize: 22 }} tabular>{formatUSD(firstPayment ?? s.total_usd)}</Text></ChangingText>
          </View> : null}
          <Button testID="checkout-next" title={nextTitle} size="lg" full disabled={!canContinue} onPress={advance} />
          <Text variant="caption" color="textMuted" align="center">Todavía no se crea el pedido ni se realiza ningún cobro.</Text>
        </>}
      </BottomBar>
    </View>
  );
}

function ReviewSection({ title, testID, disabled, onEdit, children }: { title: string; testID: string; disabled: boolean; onEdit: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ gap: 8, borderTopWidth: 1, borderColor: t.colors.border, paddingTop: 8 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <Text variant="subtitle" style={{ flex: 1, minWidth: 0 }}>{title}</Text>
      <ScalePressable testID={testID} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Cambiar ${title}`} onPress={onEdit} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}><Text variant="label" color="brand">Cambiar</Text></ScalePressable>
    </View>
    {children}
  </View>;
}

function PaymentSchedule({ summary: s }: { summary: CheckoutSummary }) {
  if (s.schedule.length <= 1) return null;
  return <View style={{ gap: 10 }}>
    <Text variant="label">Calendario de pagos (en USD)</Text>
    {s.schedule.map((x) => <View key={x.seq} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
      <Text variant="bodySmall" color="textSecondary" style={{ flexShrink: 1 }}>{OBLIGATION_KIND_LABEL[x.kind] ?? 'Pago'} {x.kind === 'installment' ? x.seq : ''} · {x.due_in_days === 0 ? 'hoy' : `en ${x.due_in_days} días`}</Text>
      <Text variant="label" tabular>{formatUSD(x.amount_usd)}</Text>
    </View>)}
    <Text variant="caption" color="textMuted">Tu saldo pendiente queda en dólares. Si pagas en bolívares, el monto se calcula con la tasa del día de cada pago.</Text>
  </View>;
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

function DeliveryCard({ group: g, index, total, onSelect, disabled }: { group: DeliveryGroup; index: number; total: number; onSelect: (methodId: string) => void; disabled?: boolean }) {
  const t = useTheme();
  const sel = g.selected_shipping;
  const [choosing, setChoosing] = useState(false);
  const [allProducts, setAllProducts] = useState(false);
  const label = `${total > 1 ? `Entrega ${index + 1} · ` : ''}${g.store.name}`;
  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface }}>
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ gap: 2 }}><Text variant="label">{label}</Text><Text variant="caption" color="textSecondary">{g.label}</Text></View>
        {(allProducts ? g.lines : g.lines.slice(0, 2)).map((l) => (
          <View key={l.variant_id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ProductImage productId={l.product_id} variantId={l.variant_id} path={l.image_path} aspect={1} style={{ width: 44 }} radius={4} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text variant="bodySmall" numberOfLines={2}>{l.title}</Text><Text variant="caption" color="textSecondary">{l.variant_title ? `${l.variant_title} · ` : ''}Cantidad: {l.quantity}</Text></View>
          </View>
        ))}
        {g.lines.length > 2 ? <Button title={allProducts ? 'Ver menos productos' : `Ver los ${g.lines.length} productos`} variant="ghost" onPress={() => setAllProducts((x) => !x)} /> : null}
      </View>
      <Divider />
      {g.shipping_options == null ? (
        <View style={{ padding: 14 }}><Text variant="bodySmall" color="textMuted">Agrega una dirección para ver las opciones y el costo del envío.</Text></View>
      ) : g.shipping_options.length === 0 ? (
        <View style={{ padding: 14 }}><Text variant="bodySmall" color="danger">No hay envío disponible a esta dirección para esta entrega.</Text></View>
      ) : <>
        <ScalePressable testID={`delivery-choice-${index}`} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Cambiar envío de ${label}${sel ? `. ${sel.name}, ${Number(sel.cost_usd) === 0 ? 'gratis' : formatUSD(sel.cost_usd)}${sel.is_demo && !isPrivateCatalogPresentation ? ', tarifa de ejemplo' : ''}` : ''}`} onPress={() => setChoosing(true)} style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 68, gap: 4, opacity: disabled ? 0.4 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="truck" size={18} color={t.colors.brand} />
            <Text variant="label" style={{ flex: 1 }}>{sel?.name ?? 'Elegir envío'}</Text>
            <Icon name="chevron-right" size={18} color={t.colors.brand} />
          </View>
          {sel ? <Text variant="caption" color="textSecondary">{Number(sel.cost_usd) === 0 ? 'Gratis' : formatUSD(sel.cost_usd)} · {describeEtaDates(sel.eta_min_date, sel.eta_max_date)}{sel.kind !== 'home_delivery' ? ' · retiras tú' : ''}</Text> : null}
          {sel?.is_demo && !isPrivateCatalogPresentation ? <Text variant="caption" color="textSecondary">Tarifa de ejemplo</Text> : null}
          <Text variant="caption" color="brand">Cambiar opciones de envío</Text>
        </ScalePressable>
        <Sheet visible={choosing} title={`Envío · ${g.store.name}`} testID={`delivery-options-${index}`} dismissible={!disabled} onClose={() => setChoosing(false)}>
          {g.shipping_options.map((o, i) => (
          <View key={o.method_id}>
            {i > 0 ? <Divider inset={16} /> : null}
            <RadioRow
              testID={`shipping-${o.code}`}
              selected={sel?.method_id === o.method_id}
              disabled={disabled}
              title={o.name}
              subtitle={`${describeEtaDates(o.eta_min_date, o.eta_max_date)}${o.kind !== 'home_delivery' ? ' · retiras tú' : ''}`}
              trailing={Number(o.cost_usd) === 0 ? 'Gratis' : formatUSD(o.cost_usd)}
              badge={o.is_demo && !isPrivateCatalogPresentation ? 'Tarifa de ejemplo' : undefined}
              onPress={() => { onSelect(o.method_id); setChoosing(false); }}
            />
          </View>
          ))}
        </Sheet>
      </>}
    </View>
  );
}
