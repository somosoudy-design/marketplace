import type { CartLine, DeliveryGroup } from '@kora/api';
import { D, formatUSD, presentAvailability, productConditionLabel, safePlanCode, withPlan, chooseOfferedPlan, paymentPlanTitle, paymentPlanDescription } from '@kora/core';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductImage } from '@/components/catalog/ProductImage';
import { PendingCartMerge } from '@/components/catalog/PendingCartMerge';
import { ExhibitionNotice } from '@/components/catalog/ExhibitionNotice';
import { MAX_CONTENT, ProductRail } from '@/components/catalog/ProductGrid';
import { Badge } from '@/components/ui/Badge';
import { BottomBar, ChangingText } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { Card, Divider, SectionHeader, Stepper } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { RadioRow } from '@/components/checkout/Rows';
import { useAuth } from '@/lib/auth';
import type { GuestLine } from '@/lib/guest-cart';
import { useCart, useGuestCartState, useHome, useSetCartQuantity } from '@/lib/hooks';
import { ImpressionScope, TrackedSection, useViewportTracking } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { authTarget } from '@/lib/auth-navigation';

const ISSUE_TEXT: Record<string, string> = {
  sold_out: 'Se agotó. Quítalo para continuar.',
  unavailable: 'Ya no está disponible. Quítalo para continuar.',
  insufficient_stock: 'Quedan menos unidades. Ajusta la cantidad.',
  over_limit: 'Supera el máximo por pedido. Ajusta la cantidad.',
};

export default function CartScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const requestedPlan = safePlanCode(params.plan);
  const header = <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12 }}><Text variant="displayL">Carrito</Text><ExhibitionNotice explain />{user?<PendingCartMerge/>:null}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {user ? <AccountCart key={user.id} header={header} requestedPlan={requestedPlan} /> : <GuestCartView header={header} requestedPlan={requestedPlan} />}
    </View>
  );
}

function AccountCart({ header, requestedPlan }: { header: React.ReactNode; requestedPlan?: string }) {
  const {cartSyncError,cartSyncing}=useAuth();
  const t = useTheme();
  const cart = useCart();
  const setQty = useSetCartQuantity();
  const [removing, setRemoving] = useState<CartLine | null>(null);
  const [barHeight, setBarHeight] = useState(180);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await cart.refetch(); } finally { setRefreshing(false); } };
  const s = cart.data;
  const selectedPlan = chooseOfferedPlan(requestedPlan, s?.plans ?? []);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const plansFresh = cart.isSuccess && !cart.isFetching && !cart.isError && !setQty.isPending && !cartSyncing && !cartSyncError;
  const nextPlanNotice = plansFresh && requestedPlan && selectedPlan.notice ? `${requestedPlan}:${selectedPlan.code ?? ''}` : '';
  const [seenPlanNotice, setSeenPlanNotice] = useState('');
  if (seenPlanNotice !== nextPlanNotice) {
    setSeenPlanNotice(nextPlanNotice);
    if (nextPlanNotice) setPlanNotice(selectedPlan.notice!);
  }
  useEffect(() => {
    if (plansFresh && requestedPlan && selectedPlan.notice && selectedPlan.code) router.setParams({ plan: selectedPlan.code });
  }, [plansFresh, requestedPlan, selectedPlan.code, selectedPlan.notice]);

  if (waitingForNetwork(cart)) return <View>{header}<OfflineState /></View>;
  if (cart.isPending) {
    return (
      <View>
        {header}
        <View style={{ padding: 16, gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} height={110} radius={t.radii.lg} />)}</View>
      </View>
    );
  }
  if (cart.isError && !s) return <View>{header}<ErrorState error={cart.error} onRetry={() => cart.refetch()} /></View>;
  if (!s || s.line_count === 0) {
    return (
      <EmptyCart header={header} body="Explora el catálogo y agrega lo que necesites." />
    );
  }
  const groups = s.groups;
  const lines = groups.flatMap((group) => group.lines);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <>
      <ScrollView
        testID="cart-scroll"
        contentContainerStyle={{ paddingBottom: barHeight + 24, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.brand} />}
      >
        {header}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {setQty.isError && setQty.variables?.quantity !== 0 ? <Banner tone="danger" icon="circle-alert" body="No pudimos actualizar la cantidad. Intenta de nuevo." /> : null}
          <Text variant="bodySmall" color="textSecondary" testID="cart-deliveries">{lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {units} {units === 1 ? 'unidad' : 'unidades'}{groups.length > 1 ? ` · ${groups.length} entregas` : ''}</Text>
          {s.issues > 0 ? <Banner tone="warning" icon="circle-alert" title="Revisa tu carrito" body="Algunos productos cambiaron. Ajusta las cantidades marcadas para continuar." /> : null}
          <View testID="cart-products" style={{ backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, borderRadius: 12, overflow: 'hidden' }}>
          {groups.map((g, i) => (
            <GroupCard key={g.key} group={g} index={i} total={groups.length} disabled={setQty.isPending} onRemove={setRemoving} onQty={(variantId, quantity) => setQty.mutate({ variantId, quantity })} />
          ))}
          </View>
          <View testID="cart-payment-options" style={{ gap: 10 }}>
            <Text variant="subtitle">Plan de pago</Text>
            {planNotice || (plansFresh && selectedPlan.notice) ? <Banner tone="info" body={planNotice ?? selectedPlan.notice!} /> : null}
            <Card padded={false}>
              {s.plans.map((option, index) => <View key={option.code}>
                {index > 0 ? <Divider inset={16} /> : null}
                <RadioRow testID={`cart-plan-${option.code}`} selected={selectedPlan.code === option.code}
                  title={paymentPlanTitle(option)} subtitle={paymentPlanDescription(option)} disabled={!plansFresh || s.issues > 0}
                  onPress={() => { setPlanNotice(null); router.setParams({ plan: option.code }); }} />
              </View>)}
            </Card>
            <Text variant="caption" color="textMuted">El envío y los importes finales se confirman al continuar.</Text>
          </View>
        </View>
      </ScrollView>
      <CartFooter
        items={s.items_usd}
        note="Envío y total final con tu dirección, en el siguiente paso."
        cta="Continuar"
        disabled={s.issues > 0 || setQty.isPending || cart.isFetching || cart.isError || !!cartSyncError || cartSyncing || !selectedPlan.code}
        onPress={() => router.push(withPlan('/checkout', selectedPlan.code) as Href)}
        onHeightChange={setBarHeight}
      />
      <ConfirmSheet visible={!!removing} testID="cart-remove-sheet" title="¿Quitar este producto?" body={removing?.title} confirm="Quitar producto" cancel="Conservar producto" loading={setQty.isPending} error={setQty.error && setQty.variables?.quantity === 0 && setQty.variables?.variantId === removing?.variant_id ? 'No pudimos quitarlo. Sigue en tu carrito; intenta de nuevo.' : null} onClose={() => { setRemoving(null); setQty.reset(); }} onConfirm={() => removing && setQty.mutate({ variantId: removing.variant_id, quantity: 0 }, { onSuccess: () => setRemoving(null) })} />
    </>
  );
}

function GroupCard({ group: g, index, total, onQty, onRemove, disabled }: { group: DeliveryGroup; index: number; total: number; onQty: (variantId: string, q: number) => void; onRemove: (line: CartLine) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <View testID={`cart-group-${g.key}`} style={{ borderTopWidth: index > 0 ? 1 : 0, borderColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.colors.border }}>
        <Icon name={g.flow === 'import_order' ? 'plane' : g.flow === 'seller_shipping' ? 'store' : 'package'} size={18} color={t.colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{g.store.name}</Text>
          <Text variant="caption" color="textSecondary">{total > 1 ? `Entrega ${index + 1} · ` : ''}{g.label}{g.ready_max_days > 1 ? ` · ${g.ready_min_days}–${g.ready_max_days} días` : ''}</Text>
        </View>
      </View>
      {g.lines.map((l, i) => (
        <View key={l.variant_id}>
          {i > 0 ? <Divider inset={14} /> : null}
          <LineRow line={l} onQty={onQty} onRemove={() => onRemove(l)} disabled={disabled} />
        </View>
      ))}
    </View>
  );
}

function LineRow({ line: l, onQty, onRemove, disabled }: { line: CartLine; onQty: (variantId: string, q: number) => void; onRemove: () => void; disabled?: boolean }) {
  const { width } = useWindowDimensions();
  const a = presentAvailability(l.availability);
  return (
    <View style={{ gap: 8, padding: 12 }} testID={`cart-line-${l.variant_id}`}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <ScalePressable accessibilityRole="link" accessibilityLabel={l.title} onPress={() => router.push({ pathname: '/product/[id]', params: { id: l.product_id, variant:l.variant_id } })}>
          <ProductImage productId={l.product_id} variantId={l.variant_id} productIsDemo={false} path={l.image_path} aspect={1} fit="contain" style={{ width: width < 360 ? 64 : 72 }} radius={6} />
        </ScalePressable>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text variant="bodySmall" numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{l.title}</Text>
          {productConditionLabel(l.product_condition)?<Text variant="caption">{productConditionLabel(l.product_condition)}</Text>:null}
          {l.variant_title ? <Text variant="caption" color="textSecondary">{l.variant_title}</Text> : null}
          {l.quantity > 1 ? <Text variant="caption" color="textSecondary" tabular testID={`cart-unit-${l.variant_id}`}>{formatUSD(l.unit_price_usd)} por unidad</Text> : null}
          {l.availability !== 'available' ? <Badge label={a.label} tone={a.tone} /> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <ChangingText value={formatUSD(l.line_total_usd)}><Text variant="price" tabular testID={`cart-item-total-${l.variant_id}`}>{formatUSD(l.line_total_usd)}</Text></ChangingText>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Stepper value={l.quantity} min={0} max={Math.max(l.max_quantity, l.quantity)} disabled={disabled} onChange={(q) => q === 0 ? onRemove() : onQty(l.variant_id, q)} />
          <IconButton testID={`cart-remove-${l.variant_id}`} icon="trash" label={`Quitar ${l.title}`} disabled={disabled} onPress={onRemove} />
        </View>
      </View>
      {l.issue ? <Text variant="caption" color="danger">{ISSUE_TEXT[l.issue] ?? 'Revisa este producto.'}</Text> : null}
    </View>
  );
}

/** An empty cart still offers a way forward: a short shelf of picks, measured like any other recommendation. */
function EmptyCart({ header, body }: { header: React.ReactNode; body: string }) {
  const { user } = useAuth();
  const home = useHome();
  const tracking = useViewportTracking();
  const picks = (home.data?.recommended ?? []).slice(0, 10);
  return (
    <ImpressionScope tracking={tracking} enabled={!!user}>
      <ScrollView testID="cart-empty" onScroll={tracking.onScroll} onLayout={tracking.onLayout} scrollEventThrottle={100} contentContainerStyle={{ paddingBottom: 32, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>
        {header}
        <EmptyState icon="shopping-bag" title="Tu carrito está vacío" body={body} action="Explorar" onAction={() => router.navigate('/explore')} />
        {picks.length ? (
          <TrackedSection slot="cart_empty" ids={picks.map((p) => p.id)} visible={2} testID="cart-empty-picks">
            <SectionHeader overline={home.data?.personalized ? 'Para ti' : 'Para empezar'} title="Te puede gustar" />
            <ProductRail products={picks} slot="cart_empty" />
          </TrackedSection>
        ) : null}
      </ScrollView>
    </ImpressionScope>
  );
}

function GuestCartView({ header, requestedPlan }: { header: React.ReactNode; requestedPlan?: string }) {
  const t = useTheme();
  const guest = useGuestCartState();
  const lines = guest.data;
  const setQty = useSetCartQuantity();
  const [removing, setRemoving] = useState<GuestLine | null>(null);
  const [barHeight, setBarHeight] = useState(180);
  if (guest.isPending) return <View>{header}<View style={{ padding: 16, gap: 14 }}>{[0, 1].map(i => <Skeleton key={i} height={110} radius={t.radii.lg} />)}</View></View>;
  if (guest.error) return <View>{header}<ErrorState error={guest.error} onRetry={() => guest.refresh()} /></View>;
  if (!lines.length) {
    return (
      <EmptyCart header={header} body="Agrega productos y continúa cuando quieras. Al iniciar sesión los guardamos en tu cuenta." />
    );
  }
  const subtotal = lines.reduce((s, l) => s.plus(D(l.price_usd).times(l.quantity)), D(0));
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <>
      <ScrollView testID="cart-scroll" contentContainerStyle={{ paddingBottom: barHeight + 24, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>
        {header}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          <Text variant="bodySmall" color="textSecondary" testID="cart-deliveries">{lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {units} {units === 1 ? 'unidad' : 'unidades'}</Text>
          {requestedPlan ? <View testID="guest-plan-preference"><Banner tone="info" body="Conservamos el plan que solicitaste. Verás las opciones disponibles después de iniciar sesión y revisar tu carrito." /></View> : null}
          <Card padded={false}>
            {lines.map((l: GuestLine, i) => (
              <View key={l.variant_id}>
                {i > 0 ? <Divider inset={14} /> : null}
                <LineRow
                  line={{ issue: null, title: l.title, quantity: l.quantity, image_path: l.image_path, product_id: l.product_id, variant_id: l.variant_id, availability: l.availability as CartLine['availability'], max_quantity: 20, variant_title: l.variant_title, line_total_usd: Number(D(l.price_usd).times(l.quantity)), unit_price_usd: l.price_usd,product_condition:l.product_condition }}
                  onQty={(variantId, quantity) => setQty.mutate({ variantId, quantity })}
                  onRemove={() => setRemoving(l)}
                  disabled={setQty.isPending}
                />
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
      <CartFooter items={Number(subtotal)} note="Inicia sesión o crea tu cuenta para ver envío y pagar." cta="Iniciar sesión para continuar" onPress={() => router.push(authTarget('/sign-in', withPlan('/cart', requestedPlan)))} onHeightChange={setBarHeight} compact={false} />
      <ConfirmSheet visible={!!removing} testID="cart-remove-sheet" title="¿Quitar este producto?" body={removing?.title} confirm="Quitar producto" cancel="Conservar producto" loading={setQty.isPending} error={setQty.error && setQty.variables?.quantity === 0 && setQty.variables?.variantId === removing?.variant_id ? 'No pudimos quitarlo. Intenta de nuevo.' : null} onClose={() => { setRemoving(null); setQty.reset(); }} onConfirm={() => removing && setQty.mutate({ variantId: removing.variant_id, quantity: 0 }, { onSuccess: () => setRemoving(null) })} />
    </>
  );
}

function CartFooter({ items, note, cta, onPress, disabled, onHeightChange, compact = true }: { items: number; note: string; cta: string; onPress: () => void; disabled?: boolean; onHeightChange?: (height: number) => void; compact?: boolean }) {
  const { fontScale } = useWindowDimensions();
  const stacked = !compact || fontScale > 1;
  const subtotal = (
    <View style={{ flexGrow: 1, flexShrink: 0, minWidth: 120, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', columnGap: 8 }}>
      <Text variant="subtitle">Subtotal</Text>
      <ChangingText value={formatUSD(items)}>
        <Text variant="priceLarge" style={{ fontSize: 22 }} tabular testID="cart-subtotal">{formatUSD(items)}</Text>
      </ChangingText>
    </View>
  );
  const action = <Button testID="cart-continue" title={cta} size="lg" full={stacked} disabled={disabled} onPress={onPress} accessibilityHint={stacked ? undefined : note} style={{ flexGrow: 1, flexShrink: 0, minWidth: 128, maxWidth: '100%' }} />;
  return (
    <BottomBar testID="cart-footer" maxWidth={MAX_CONTENT} safeArea={false} onHeightChange={onHeightChange}>
      {stacked ? subtotal : <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>{subtotal}{action}</View>}
      <Text variant="caption" color="textMuted">{note}</Text>
      {stacked ? action : null}
    </BottomBar>
  );
}
