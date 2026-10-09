import type { CartLine, DeliveryGroup } from '@kora/api';
import { D, formatUSD, presentAvailability } from '@kora/core';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductImage } from '@/components/catalog/ProductImage';
import { MAX_CONTENT } from '@/components/catalog/ProductGrid';
import { Badge } from '@/components/ui/Badge';
import { BottomBar, ChangingText } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider, Stepper } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import type { GuestLine } from '@/lib/guest-cart';
import { useCart, useGuestCart, useSetCartQuantity } from '@/lib/hooks';
import { useTheme } from '@/theme';

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
  const header = <Text variant="displayL" style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12 }}>Carrito</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {user ? <AccountCart header={header} /> : <GuestCartView header={header} />}
    </View>
  );
}

function AccountCart({ header }: { header: React.ReactNode }) {
  const t = useTheme();
  const cart = useCart();
  const setQty = useSetCartQuantity();
  const s = cart.data;

  if (cart.isPending) {
    return (
      <View>
        {header}
        <View style={{ padding: 16, gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} height={110} radius={t.radii.lg} />)}</View>
      </View>
    );
  }
  if (cart.isError) return <View>{header}<ErrorState onRetry={() => cart.refetch()} /></View>;
  if (!s || s.line_count === 0) {
    return (
      <View>
        {header}
        <EmptyState icon="shopping-bag" title="Tu carrito está vacío" body="Explora el catálogo y agrega lo que necesites." action="Explorar" onAction={() => router.navigate('/explore')} />
      </View>
    );
  }
  const groups = s.groups;
  return (
    <>
      <ScrollView
        testID="cart-scroll"
        contentContainerStyle={{ paddingBottom: 200, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => cart.refetch()} tintColor={t.colors.brand} />}
      >
        {header}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {groups.length > 1 ? (
            <Banner tone="brand" icon="package" title={`Tu compra llega en ${groups.length} entregas`} body="Los productos salen de lugares o tiempos distintos. Cada entrega tiene su propio seguimiento." />
          ) : null}
          {s.issues > 0 ? <Banner tone="warning" icon="circle-alert" title="Revisa tu carrito" body="Algunos productos cambiaron. Ajusta las cantidades marcadas para continuar." /> : null}
          {groups.map((g, i) => (
            <GroupCard key={g.key} group={g} index={i} total={groups.length} onQty={(variantId, quantity) => setQty.mutate({ variantId, quantity })} />
          ))}
        </View>
      </ScrollView>
      <CartFooter
        items={s.items_usd}
        note="El envío y el total final se calculan con tu dirección en el siguiente paso."
        cta="Continuar"
        disabled={s.issues > 0}
        onPress={() => router.push('/checkout')}
      />
    </>
  );
}

function GroupCard({ group: g, index, total, onQty }: { group: DeliveryGroup; index: number; total: number; onQty: (variantId: string, q: number) => void }) {
  const t = useTheme();
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: t.colors.surfaceSunken }}>
        <Icon name={g.flow === 'import_order' ? 'plane' : g.flow === 'seller_shipping' ? 'store' : 'package'} size={18} color={t.colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{total > 1 ? `Entrega ${index + 1} de ${total} · ` : ''}{g.label}</Text>
          <Text variant="caption" color="textMuted">{g.store.name}{g.ready_max_days > 1 ? ` · listo en ${g.ready_min_days}–${g.ready_max_days} días` : ''}</Text>
        </View>
      </View>
      {g.lines.map((l, i) => (
        <View key={l.variant_id}>
          {i > 0 ? <Divider inset={14} /> : null}
          <LineRow line={l} onQty={onQty} />
        </View>
      ))}
    </Card>
  );
}

function LineRow({ line: l, onQty }: { line: CartLine; onQty: (variantId: string, q: number) => void }) {
  const t = useTheme();
  const a = presentAvailability(l.availability);
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14 }} testID={`cart-line-${l.variant_id}`}>
      <ScalePressable accessibilityRole="link" accessibilityLabel={l.title} onPress={() => router.push({ pathname: '/product/[id]', params: { id: l.product_id } })}>
        <ProductImage path={l.image_path} style={{ width: 76 }} radius={t.radii.md} />
      </ScalePressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodySmall" numberOfLines={2} style={{ fontFamily: 'Manrope_600SemiBold' }}>{l.title}</Text>
        {l.variant_title ? <Text variant="caption" color="textMuted">{l.variant_title}</Text> : null}
        {l.availability !== 'available' ? <Badge label={a.label} tone={a.tone} /> : null}
        {l.issue ? <Text variant="caption" color="danger">{ISSUE_TEXT[l.issue] ?? 'Revisa este producto.'}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Stepper value={l.quantity} min={0} max={Math.max(l.max_quantity, l.quantity)} onChange={(q) => onQty(l.variant_id, q)} />
          <Text variant="price" tabular>{formatUSD(l.line_total_usd)}</Text>
        </View>
      </View>
    </View>
  );
}

function GuestCartView({ header }: { header: React.ReactNode }) {
  const lines = useGuestCart();
  const setQty = useSetCartQuantity();
  if (!lines.length) {
    return (
      <View>
        {header}
        <EmptyState icon="shopping-bag" title="Tu carrito está vacío" body="Agrega productos y continúa cuando quieras. Al iniciar sesión los guardamos en tu cuenta." action="Explorar" onAction={() => router.navigate('/explore')} />
      </View>
    );
  }
  const subtotal = lines.reduce((s, l) => s.plus(D(l.price_usd).times(l.quantity)), D(0));
  return (
    <>
      <ScrollView contentContainerStyle={{ paddingBottom: 200, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>
        {header}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          <Card padded={false}>
            {lines.map((l: GuestLine, i) => (
              <View key={l.variant_id}>
                {i > 0 ? <Divider inset={14} /> : null}
                <LineRow
                  line={{ issue: null, title: l.title, quantity: l.quantity, image_path: l.image_path, product_id: l.product_id, variant_id: l.variant_id, availability: l.availability as CartLine['availability'], max_quantity: 20, variant_title: l.variant_title, line_total_usd: Number(D(l.price_usd).times(l.quantity)), unit_price_usd: l.price_usd }}
                  onQty={(variantId, quantity) => setQty.mutate({ variantId, quantity })}
                />
              </View>
            ))}
          </Card>
          <Text variant="caption" color="textMuted" style={{ paddingHorizontal: 4 }}>
            Precios referenciales. Al iniciar sesión confirmamos precio, disponibilidad y envío.
          </Text>
        </View>
      </ScrollView>
      <CartFooter items={Number(subtotal)} note="Inicia sesión o crea tu cuenta para ver envío y pagar." cta="Iniciar sesión para continuar" onPress={() => router.push('/sign-in')} />
    </>
  );
}

function CartFooter({ items, note, cta, onPress, disabled }: { items: number; note: string; cta: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <BottomBar maxWidth={MAX_CONTENT} safeArea={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="subtitle">Productos</Text>
        <ChangingText value={formatUSD(items)}>
          <Text variant="priceLarge" style={{ fontSize: 22 }} tabular testID="cart-subtotal">{formatUSD(items)}</Text>
        </ChangingText>
      </View>
      <Text variant="caption" color="textMuted">{note}</Text>
      <Button testID="cart-continue" title={cta} size="lg" full disabled={disabled} onPress={onPress} />
    </BottomBar>
  );
}
