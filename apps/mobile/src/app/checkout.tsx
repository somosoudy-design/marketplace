import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { ApiError, type CheckoutSummary, type ReviewedCheckoutSummary, type DeliveryGroup, type PlaceOrderResult, type ShippingSelection } from '@kora/api';
import { describeEtaDates, formatUSD, OBLIGATION_KIND_LABEL, productConditionLabel } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
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
import { confirmCheckout, recoverCheckout, UnconfirmedCheckoutError } from '@/lib/checkout-confirmation';
import { haptics } from '@/lib/haptics';
import { useAddresses } from '@/lib/hooks';
import { captureActorApi, assertCurrentActor } from '@/lib/actor-api';
import { checkoutIntents, type StoredCheckoutAttempt } from '@/lib/checkout-intents';
import { RadioRow, SummaryRow } from '@/components/checkout/Rows';
import { Sheet } from '@/components/ui/Sheet';
import { ScalePressable } from '@/components/ui/Pressable';
import { useTheme } from '@/theme';
import { authTarget } from '@/lib/auth-navigation';
import { PendingCartMerge } from '@/components/catalog/PendingCartMerge';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const MAX_W = 720;
const STEPS = [
  { title: 'Dirección de entrega', body: 'Elige dónde recibirás tu compra para consultar las opciones de envío.' },
  { title: 'Tus entregas', body: 'Revisa los productos y elige cómo recibir cada entrega.' },
  { title: 'Plan de pago', body: 'Elige cómo distribuir el pago. El método y la moneda se seleccionan después de crear el pedido.' },
  { title: 'Revisa tu pedido', body: 'Revisa los productos y confirma el pedido. El pago viene después.' },
] as const;

type Preview = ReviewedCheckoutSummary & { recoveredShipping: boolean };
type AttemptState = { stored: StoredCheckoutAttempt; snapshot?: Preview; fresh: boolean };

export default function CheckoutScreen() {
  const { user } = useAuth();
  if (!user) return <EmptyState icon="lock" title="Inicia sesión para continuar" action="Iniciar sesión" onAction={() => router.replace(authTarget('/sign-in', '/checkout'))} />;
  // An in-flight attempt belongs to one buyer; switching account must never recover or open another buyer's order.
  return <CheckoutSession key={user.id} buyerId={user.id} />;
}

function CheckoutSession({ buyerId }: { buyerId: string }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const navigation = useNavigation();
  const { cartSyncing, cartSyncError } = useAuth();
  const addresses = useAddresses();
  const [step, setStep] = useState(0);
  const [deliveryIndex, setDeliveryIndex] = useState(0);
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const chosenAddress = addresses.data?.find((a) => a.id === chosenAddressId) ?? addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0];
  const addressId = chosenAddress?.id ?? null;
  const addressSignature = chosenAddress ? JSON.stringify(chosenAddress) : '';
  const [pickAddress, setPickAddress] = useState(false);
  const [shipping, setShipping] = useState<ShippingSelection>({});
  const [shippingDestination, setShippingDestination] = useState('');
  const [shippingRecovered, setShippingRecovered] = useState(false);
  const [lastPreview, setLastPreview] = useState<{ userId: string; summary: Preview } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recoveredOrder, setRecoveredOrder] = useState<PlaceOrderResult | null>(null);
  const [plan, setPlan] = useState('full');
  const [barHeight, setBarHeight] = useState(150);
  const scrollRef = useRef<ScrollView>(null);
  const headingRef = useRef<View>(null);
  const submitting = useRef(false);
  const leaving = useRef(false);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState<Error | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState<Error | null>(null);
  const [reviewedToken, setReviewedToken] = useState('');
  const [reviewNotice, setReviewNotice] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    let active = true; alive.current = true;
    checkoutIntents.load(buyerId).then((stored) => {
      if (!active) return;
      if (stored) { setAttempt({ stored, fresh: false }); setConfirming(true); }
      setRestored(true);
    }).catch((error: unknown) => { if (active) setRestoreError(new Error('No pudimos recuperar tu compra guardada. Conservamos sus datos; vuelve a intentar la lectura.', { cause: error })); });
    return () => { active = false; alive.current = false; };
  }, [buyerId, restoreNonce]);

  // A deleted/default/edited address can change the effective destination outside the picker too.
  if (addressSignature !== shippingDestination && !confirming && !preparing) {
    setShippingDestination(addressSignature);
    setReviewedToken('');
    setShipping({});
    setDeliveryIndex(0);
    if (step > 0) setStep(0);
  }

  const preview = useQuery({
    queryKey: ['checkout', buyerId, addressSignature, shipping, plan],
    queryFn: async () => {
      const bound = await captureActorApi(buyerId);
      let selection = shipping;
      let planCode: string | null = plan;
      let recoveredShipping = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const result = await bound.api.checkout.previewReviewed(addressId, selection, planCode); await bound.assertCurrent(); return { ...result, recoveredShipping }; }
        catch (e) {
          // Null returns eligible plans without a schedule. The next query uses an offered code.
          if (e instanceof ApiError && e.code === 'plan_invalid' && planCode !== null) { planCode = null; continue; }
          if (e instanceof ApiError && e.code === 'shipping_invalid' && Object.keys(selection).length) { selection = {}; recoveredShipping = true; continue; }
          throw e;
        }
      }
      throw new Error('No pudimos actualizar las opciones. Intenta de nuevo.');
    },
    enabled: restored && !restoreError && !preparing && !cartSyncing && !cartSyncError && addresses.isSuccess && !confirming,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  // A changed query key loses its placeholder on failure. Keep the last server snapshot legible,
  // scoped to this account, while the fresh/error guards prevent using it to advance or confirm.
  const s = confirming && attempt ? attempt.snapshot : preview.data ?? (lastPreview?.userId === buyerId ? lastPreview?.summary : undefined);
  if (preview.data && !preview.isPlaceholderData && preview.data !== lastPreview?.summary) {
    setLastPreview({ userId: buyerId, summary: preview.data });
    if (!confirming && !preparing && step === 3 && reviewedToken && reviewedToken !== preview.data.review_token) {
      setReviewedToken(''); setStep(2); setReviewNotice(true);
    }
  }

  if (s && !preview.isPlaceholderData && !s.plans.some((p) => p.code === plan) && s.plans[0]) setPlan(s.plans[0].code);
  if (s?.recoveredShipping && !preview.isPlaceholderData && Object.keys(shipping).length) {
    setShipping({});
    setShippingRecovered(true);
    setDeliveryIndex(0);
    setStep(1);
  }

  const complete = async (result: PlaceOrderResult, accepted: AttemptState) => {
    if (!alive.current) return;
    await assertCurrentActor(buyerId);
    if (!alive.current) return;
    try { await checkoutIntents.complete(accepted.stored); } catch { /* Retained identity safely recovers this confirmed order on the next visit. */ }
    await qc.invalidateQueries({ queryKey: ['cart'] });
    await qc.invalidateQueries({ queryKey: ['orders'] });
    await assertCurrentActor(buyerId);
    if (!alive.current) return;
    submitting.current = false;
    setRecoveredOrder(result); haptics.success();
  };
  const place = useMutation({
    mutationFn: async (accepted: AttemptState) => {
      const bound = await captureActorApi(buyerId), payload = accepted.stored.payload;
      await bound.assertCurrent();
      const result = await confirmCheckout(
        () => bound.api.checkout.placeOrderReviewed(payload.addressId, payload.shipping, payload.plan, accepted.stored.identity.key, payload.reviewToken),
        () => bound.api.checkout.placedOrder(buyerId, accepted.stored.identity.key),
      );
      await bound.assertCurrent(); return result;
    },
    onSuccess: (result, accepted) => complete(result, accepted),
    onError: async (error, accepted) => {
      if (!alive.current) return;
      try { await assertCurrentActor(buyerId); } catch { return; }
      if (!alive.current) return;
      submitting.current = false; haptics.warning();
      const code = (error as { code?: string }).code;
      const rejected = ['checkout_changed', 'plan_invalid', 'shipping_invalid', 'insufficient_stock', 'sold_out', 'unavailable', 'cart_has_issues', 'cart_empty', 'address_required', 'address_not_found', 'shipping_unavailable', 'invalid_input'].includes(code ?? '');
      // A retry rejection cannot prove an older unanswered request will not commit.
      if (error instanceof UnconfirmedCheckoutError || !rejected || !accepted.fresh) {
        setAttempt((current) => current?.stored.identity.key === accepted.stored.identity.key ? { ...current, fresh: false } : current);
        return;
      }
      try { await checkoutIntents.complete(accepted.stored); } catch { return; }
      if (!alive.current) return;
      setConfirming(false); setAttempt(null); setReviewedToken('');
      if (code === 'checkout_changed') { setStep(0); setDeliveryIndex(0); setReviewNotice(true); }
      if (['address_required', 'address_not_found', 'shipping_unavailable'].includes(code ?? '')) { setStep(0); setDeliveryIndex(0); }
      if (code === 'plan_invalid') setStep(2);
      if (code === 'shipping_invalid') { setShipping({}); setShippingRecovered(true); setDeliveryIndex(0); setStep(1); }
      void preview.refetch();
    },
  });

  const recovery = useMutation({
    mutationFn: async () => {
      if (!attempt) throw new Error('No encontramos la referencia de compra.');
      const accepted = attempt, bound = await captureActorApi(buyerId);
      const result = await recoverCheckout(() => bound.api.checkout.placedOrder(buyerId, accepted.stored.identity.key));
      await bound.assertCurrent(); return { result, accepted };
    },
    onSuccess: async ({ result, accepted }) => {
      if (!alive.current) return;
      submitting.current = false;
      if (result) await complete(result, accepted);
    },
    onError: () => { if (alive.current) { submitting.current = false; haptics.warning(); } },
  });
  const completed = recoveredOrder;

  const resetOrderError = place.reset;
  const goTo = useCallback((next: number, groupIndex = 0) => {
    if (submitting.current || confirming) return;
    resetOrderError();
    if (next === 3) {
      if (!preview.isSuccess || preview.isFetching || preview.isPlaceholderData) return;
      setReviewedToken(preview.data.review_token); setReviewNotice(false);
    } else setReviewedToken('');
    setDeliveryIndex(groupIndex);
    setStep(next);
  }, [resetOrderError, confirming, preview.isSuccess, preview.isFetching, preview.isPlaceholderData, preview.data]);
  const deliveryCount = s?.groups.length ?? 1;
  const back = useCallback(() => {
    if (submitting.current || confirming) return;
    if (step === 1 && deliveryIndex > 0) goTo(1, deliveryIndex - 1);
    else if (step > 0) goTo(step - 1, step === 2 ? Math.max(0, deliveryCount - 1) : 0);
    else if (router.canGoBack()) router.back();
    else router.replace('/cart');
  }, [step, deliveryIndex, deliveryCount, goTo, confirming]);
  // Native/header/browser back follows the phases instead of discarding the checkout selection.
  usePreventRemove((step > 0 || preparing || confirming || place.isPending) && !completed, ({ data }) => {
    if (leaving.current && !submitting.current) navigation.dispatch(data.action);
    else back();
  });
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    return registerCheckoutWebBack({
      shouldHandle: () => !leaving.current && !completed && (step > 0 || confirming || submitting.current),
      isSubmitting: () => (confirming || submitting.current) && !completed,
      onBack: back,
    });
  }, [step, back, confirming, completed]));
  useEffect(() => {
    if (!completed) return;
    let active = true;
    assertCurrentActor(buyerId).then(() => {
      if (!active || !alive.current) return;
      submitting.current = false; leaving.current = true;
      router.replace({ pathname: '/pay/[orderId]', params: { orderId: completed.order_id, fresh: '1' } });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [completed, buyerId]);
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

  const viewOrders = () => {
    if (submitting.current) return;
    leaving.current = true;
    router.replace('/orders');
  };
  const openConfirmed = (destination: 'payment' | 'order') => {
    if (!completed) return;
    void assertCurrentActor(buyerId).then(() => {
      if (!alive.current) return;
      if (destination === 'payment') router.replace({ pathname: '/pay/[orderId]', params: { orderId: completed.order_id, fresh: '1' } });
      else router.replace({ pathname: '/orders/[id]', params: { id: completed.order_id } });
    }).catch(() => undefined);
  };
  if (restoreError) return <ErrorState error={restoreError} onRetry={() => { setRestored(false); setRestoreError(null); setRestoreNonce((n) => n + 1); }} />;
  if (!restored) return <View testID="checkout-restoring" style={{ padding: 24, gap: 16 }}><ActivityIndicator /><Text align="center">Preparando tu compra…</Text></View>;
  if (completed) return <ScrollView testID="checkout-created" style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16, justifyContent: 'center', alignItems: 'center' }}>
    <Stack.Screen options={{ title: 'Pedido creado', headerBackVisible: false, headerLeft: () => null }} />
    <Icon name="circle-check" size={44} color={t.colors.success} />
    <Text variant="title" align="center">Pedido {completed.number} creado</Text>
    <Text color="textSecondary" align="center">Tu pedido está guardado. Continúa para elegir cómo pagar.</Text>
    <Button testID="checkout-open-payment" title="Continuar al pago" full onPress={() => openConfirmed('payment')} />
    <Button title="Ver mi pedido" variant="ghost" onPress={() => openConfirmed('order')} />
  </ScrollView>;
  if (confirming) {
    const checking = place.isPending || recovery.isPending;
    return <ScrollView testID={checking ? 'checkout-confirming' : 'checkout-recovery'} style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16, justifyContent: 'center', alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Confirmar pedido', headerLeft: () => <IconButton testID="checkout-back" icon="chevron-left" label="Ver mis pedidos" disabled={checking} onPress={viewOrders} /> }} />
      {checking ? <ActivityIndicator size="large" color={t.colors.brand} /> : <Icon name="wifi-off" size={40} color={t.colors.textSecondary} />}
      <Text testID="checkout-confirmation-status" variant="title" align="center" accessibilityLiveRegion="polite">{checking ? 'Estamos confirmando tu pedido' : 'No recibimos la confirmación'}</Text>
      <Text color="textSecondary" align="center">{checking ? 'Estamos comprobando que tu compra quede guardada.' : 'Tu pedido podría haberse creado. Compruébalo para continuar con la misma compra.'}</Text>
      {place.isError && !(place.error instanceof UnconfirmedCheckoutError) ? <Banner tone="danger" body={(place.error as Error).message + ' Conservamos la referencia mientras comprobamos el resultado.'} /> : null}
      {recovery.isError ? <Banner tone="danger" body="No pudimos consultar tu pedido. Revisa tu conexión e intenta de nuevo." /> : null}
      {recovery.isSuccess && !recovery.data.result ? <Text variant="bodySmall" color="textSecondary" align="center">La confirmación aún no aparece. Puedes volver a confirmar esta misma compra.</Text> : null}
      {!checking ? <>
        <Button testID="checkout-check-order" title="Comprobar pedido" full onPress={() => { if (submitting.current) return; submitting.current = true; recovery.mutate(); }} />
        {recovery.isSuccess && !recovery.data.result ? <Button testID="checkout-retry-confirmation" title="Reintentar confirmación" variant="secondary" full onPress={() => {
          if (submitting.current || !attempt) return;
          submitting.current = true;
          recovery.reset();
          place.mutate({ ...attempt, fresh: false });
        }} /> : null}
        <Button testID="checkout-view-orders" title="Ver mis pedidos" variant="ghost" onPress={viewOrders} />
      </> : null}
    </ScrollView>;
  }
  if (cartSyncError) return <View testID="checkout-cart-sync-pending" style={{ flex: 1, padding: 24, gap: 16, backgroundColor: t.colors.background }}>
    <PendingCartMerge />
    <Button title="Revisar carrito" variant="secondary" onPress={() => router.replace('/cart')} />
  </View>;
  if (addresses.isError) return <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />;
  if (preview.isError && !s) return <ErrorState error={preview.error} onRetry={() => preview.refetch()} />;
  if (!s) return <View style={{ padding: 16, gap: 14, backgroundColor: t.colors.background, flex: 1 }}><Skeleton height={65} /><Skeleton height={200} radius={t.radii.lg} /></View>;
  if (s.line_count === 0 && !place.isSuccess) return <EmptyState icon="shopping-bag" title="Tu carrito está vacío" action="Explorar" onAction={() => router.replace('/explore')} />;

  const address = s.address;
  const activeIndex = Math.min(deliveryIndex, Math.max(0, s.groups.length - 1));
  const group = s.groups[activeIndex];
  const fresh = restored && !restoreError && !preparing && preview.isSuccess && addresses.isSuccess && !preview.isFetching && !preview.isError && !preview.isPlaceholderData && !addresses.isFetching && !cartSyncing && !cartSyncError;
  const busy = preparing || confirming || place.isPending || place.isSuccess;
  const editable = fresh && !busy;
  const addressEditable = !busy && !addresses.isFetching;
  const addressReady = !!address && !s.needs_address;
  const groupReady = !!group?.selected_shipping && !!group.shipping_options?.some((o) => o.method_id === group.selected_shipping?.method_id);
  const planReady = s.plans.some((p) => p.code === plan) && s.plan?.code === plan;
  const blocking = s.issues > 0 ? 'Algunos productos cambiaron. Vuelve al carrito para revisarlos.'
    : !addressReady ? 'Agrega o selecciona una dirección para continuar.'
    : step > 0 && (step === 1 ? !groupReady : s.needs_shipping) ? 'No hay envío disponible para esta entrega. Prueba con otra dirección.' : null;
  const canContinue = editable && !blocking && (step === 0 ? addressReady : step === 1 ? groupReady : !s.needs_shipping && planReady);
  const canPlace = editable && !blocking && s.can_place && planReady && reviewedToken === s.review_token;
  const firstPayment = s.schedule.find((x) => x.due_in_days === 0)?.amount_usd ?? s.schedule[0]?.amount_usd;
  const productCount = s.groups.flatMap((g) => g.lines).length;
  const unitCount = s.groups.flatMap((g) => g.lines).reduce((sum, l) => sum + l.quantity, 0);
  const nextTitle = step === 0 ? 'Continuar a entregas' : step === 1 ? activeIndex < s.groups.length - 1 ? 'Siguiente entrega' : 'Continuar al plan de pago' : 'Revisar pedido';
  const advance = () => {
    if (!canContinue || submitting.current) return;
    haptics.select();
    if (step === 1 && activeIndex < s.groups.length - 1) goTo(1, activeIndex + 1);
    else goTo(step + 1);
  };
  const confirm = async () => {
    if (step !== 3 || !canPlace || !addressId || submitting.current) return;
    const payload = { addressId, shipping: currentSelection(s, shipping), plan, reviewToken: reviewedToken };
    const snapshot = s;
    submitting.current = true; setPreparing(true); setPreparationError(null);
    try {
      const prepared = await checkoutIntents.prepare(buyerId, payload);
      await assertCurrentActor(buyerId);
      if (!alive.current) return;
      const accepted = { ...prepared, snapshot };
      setAttempt(accepted); setConfirming(true); setPreparing(false);
      place.mutate(accepted);
    } catch (error) {
      if (!alive.current) return;
      try { await assertCurrentActor(buyerId); } catch { return; }
      if (!alive.current) return;
      submitting.current = false; setPreparing(false);
      setPreparationError((error as { code?: string }).code === 'pending_intent' ? error as Error : new Error('No pudimos guardar la compra. No enviamos el pedido; vuelve a intentarlo.', { cause: error }));
      // Another route may have persisted an older attempt. Never replace it with
      // a fresh summary; bring its recovery state back before any transmission.
      try {
        const stored = await checkoutIntents.load(buyerId);
        await assertCurrentActor(buyerId);
        if (stored && alive.current) { setAttempt({ stored, fresh: false }); setConfirming(true); }
      } catch { /* Keep the storage error visible and do not send a request. */ }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <Stack.Screen options={{ headerLeft: () => <IconButton testID="checkout-back" icon="chevron-left" label={step > 0 ? 'Volver al paso anterior' : 'Volver al carrito'} disabled={busy} onPress={back} /> }} />
      <ScrollView ref={scrollRef} testID="checkout-scroll" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: barHeight + 24, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        <View style={{ gap: 14 }}>
          <View testID="checkout-progress" style={{ gap: 8 }}>
            <Text variant="caption" color="brand" accessibilityLiveRegion="polite">Paso {step + 1} de 4{step === 1 && s.groups.length > 1 ? ` · Entrega ${activeIndex + 1} de ${s.groups.length}` : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? t.colors.brand : t.colors.border }} />)}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <View ref={headingRef} focusable accessible accessibilityRole="header" accessibilityLabel={STEPS[step]!.title} testID="checkout-stage-heading"><Text variant="title" accessibilityRole="none">{STEPS[step]!.title}</Text></View>
            {step !== 3 ? <Text variant="bodySmall" color="textSecondary">{STEPS[step]!.body}</Text> : null}
          </View>
        </View>
        {reviewNotice ? <Banner tone="warning" body="El pedido cambió. Revisa los productos, la entrega y el total antes de confirmar." /> : null}
        {preparationError ? <Banner tone="danger" body={preparationError.message} /> : null}
        {preview.isError ? <View testID="checkout-refresh-error" style={{ gap: 8 }}><Banner tone="danger" body="No pudimos actualizar tu compra. Reintenta antes de continuar; tus selecciones siguen aquí." /><Button title="Reintentar actualización" variant="secondary" onPress={() => preview.refetch()} loading={preview.isFetching} /></View> : null}
        {place.error ? <Banner tone="danger" icon="circle-alert" body={place.error instanceof ApiError && place.error.code === 'plan_invalid' ? 'El plan cambió y no pudimos crear el pedido. Revisa las opciones disponibles.' : (place.error as Error).message} /> : null}

        <Animated.View key={`${step}:${activeIndex}`} entering={reduced ? undefined : FadeIn.duration(160)} style={{ gap: 16 }}>
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
          <View testID="checkout-products" style={{ backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
              <Text variant="subtitle">{productCount} {productCount === 1 ? 'producto' : 'productos'} · {unitCount} {unitCount === 1 ? 'unidad' : 'unidades'}</Text>
            </View>
            {s.groups.map((g, i) => <View key={g.key} testID={`checkout-product-group-${i}`} style={{ paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: i > 0 ? 1 : 0, borderColor: t.colors.border, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }}>{s.groups.length > 1 ? `Entrega ${i + 1} · ` : ''}{g.store.name}</Text>
                <ScalePressable testID={`checkout-edit-delivery-${i}`} disabled={busy} accessibilityRole="button" accessibilityLabel={`Cambiar entrega ${i + 1} de ${g.store.name}`} onPress={() => goTo(1, i)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', opacity: busy ? 0.4 : 1 }}><Text variant="label" color="brand">Cambiar</Text></ScalePressable>
              </View>
              {g.lines.map((l) => <View key={l.variant_id} testID={`checkout-review-line-${l.variant_id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
                <ProductImage productId={l.product_id} variantId={l.variant_id} productIsDemo={false} path={l.image_path} aspect={1} fit="contain" radius={6} style={{ width: 48 }} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="bodySmall" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{l.title}</Text>
                  <Text variant="caption" color="textSecondary">{l.variant_title ? `${l.variant_title} · ` : ''}Cantidad: {l.quantity}</Text>
                  {productConditionLabel(l.product_condition)?<Text variant="caption">{productConditionLabel(l.product_condition)}</Text>:null}
                  <Text variant="label" tabular>{formatUSD(l.line_total_usd)}</Text>
                </View>
              </View>)}
              <View style={{ gap: 3, paddingTop: 4 }}>
                <Text variant="caption" color="textSecondary">{g.label}</Text>
                {g.selected_shipping ? <>
                  <Text variant="bodySmall">{g.selected_shipping.name} · {Number(g.selected_shipping.cost_usd) === 0 ? 'Gratis' : formatUSD(g.selected_shipping.cost_usd)}</Text>
                  <Text variant="caption" color="textSecondary">{describeEtaDates(g.selected_shipping.eta_min_date, g.selected_shipping.eta_max_date)}{g.selected_shipping.kind !== 'home_delivery' ? ' · retiras tú' : ''}{g.selected_shipping.is_demo && !isPrivateCatalogPresentation ? ' · tarifa de ejemplo' : ''}</Text>
                </> : null}
              </View>
            </View>)}
          </View>
          <ReviewSection title="Dirección de entrega" testID="checkout-edit-address" disabled={busy} onEdit={() => goTo(0)}>
            {address ? <View testID="checkout-review-address" style={{ gap: 3 }}><Text variant="label">{address.recipient}</Text><Text variant="bodySmall" color="textSecondary">{address.line1}</Text><Text variant="bodySmall" color="textSecondary">{[address.municipality, address.city].filter(Boolean).join(', ')} · {address.phone}</Text></View> : null}
          </ReviewSection>
          <ReviewSection title="Plan de pago" testID="checkout-edit-plan" disabled={busy} onEdit={() => goTo(2)}>
            <Text variant="label">{s.plan?.name}</Text>
            <PaymentSchedule summary={s} />
          </ReviewSection>
          <View testID="checkout-summary-detail" style={{ gap: 8 }}>
            <SummaryRow label="Productos" value={formatUSD(s.items_usd)} />
            <SummaryRow label="Envío" value={s.needs_shipping ? 'Por definir' : Number(s.shipping_usd) === 0 ? 'Gratis' : formatUSD(s.shipping_usd)} />
            {Number(s.financing_usd) > 0 ? <SummaryRow label="Recargo por cuotas" value={formatUSD(s.financing_usd)} /> : null}
            <Text variant="caption" color="textSecondary">Al confirmar se crea el pedido y se reservan tus productos. El pago viene después.</Text>
          </View>
        </View> : null}
        </Animated.View>
        {s.issues > 0 ? <Button title="Revisar carrito" variant="secondary" disabled={busy} onPress={() => { leaving.current = true; router.replace('/cart'); }} /> : null}
      </ScrollView>
      <BottomBar testID="checkout-bottom-bar" maxWidth={MAX_W} onHeightChange={setBarHeight} tone={step === 3 ? 'brand' : 'default'}>
        {blocking ? <Text variant="caption" color="danger" style={step === 3 ? { color: palette.coral[100] } : undefined}>{blocking}</Text> : null}
        {step === 3 ? <>
          <SummaryRow label="Total del pedido" value={formatUSD(s.total_usd)} strong inverse testID="checkout-total" />
          {s.schedule.length > 1 ? <SummaryRow label="Pagas hoy" value={formatUSD(firstPayment ?? s.total_usd)} inverse /> : null}
          <Button testID="checkout-place" title="Confirmar pedido" variant="inverse" size="lg" full loading={preparing || place.isPending || preview.isFetching} disabled={!canPlace} onPress={confirm} />
        </> : <>
          {step >= 2 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Text variant="subtitle">{s.schedule.length > 1 ? 'Pagas hoy' : 'Total'}</Text>
            <ChangingText value={formatUSD(firstPayment ?? s.total_usd)}><Text variant="priceLarge" style={{ fontSize: 22 }} tabular>{formatUSD(firstPayment ?? s.total_usd)}</Text></ChangingText>
          </View> : null}
          <Button testID="checkout-next" title={nextTitle} size="lg" full loading={preview.isFetching} disabled={!canContinue} onPress={advance} />
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
            <ProductImage productId={l.product_id} variantId={l.variant_id} productIsDemo={false} path={l.image_path} aspect={1} style={{ width: 44 }} radius={4} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text variant="bodySmall" numberOfLines={2}>{l.title}</Text>{productConditionLabel(l.product_condition)?<Text variant="caption">{productConditionLabel(l.product_condition)}</Text>:null}<Text variant="caption" color="textSecondary">{l.variant_title ? `${l.variant_title} · ` : ''}Cantidad: {l.quantity}</Text></View>
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
