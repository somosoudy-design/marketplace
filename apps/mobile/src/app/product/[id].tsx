import type { OrderItem, ProductDetail, ProductVariant } from '@kora/api';
import { describeLeadTime, describeLeadTimeShort, etaFromToday, formatUSD, presentAvailability, stockHint } from '@kora/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Share, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductRail } from '@/components/catalog/ProductGrid';
import { ProductImage } from '@/components/catalog/ProductImage';
import { StoreChip } from '@/components/catalog/StoreCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Card, Divider, SectionHeader, Stepper } from '@/components/ui/Layout';
import { Price } from '@/components/ui/Price';
import { ScalePressable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { BottomBar, CollapsingHeader, useScrollY } from '@/components/ui/Bars';
import { RatingInline, RatingSummary, ReviewItem } from '@/components/reviews/Reviews';
import { ReviewSheet } from '@/components/reviews/ReviewSheet';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { ImpressionScope, TrackedSection, useViewportTracking } from '@/lib/impressions';
import { brand } from '@/lib/brand';
import { haptics } from '@/lib/haptics';
import { useAddToCart, useFavorites, usePaymentMethods, useProduct } from '@/lib/hooks';
import { api } from '@/lib/supabase';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

const MAX_W = 760;

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useProduct(id);
  const t = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (id) void api.catalog.track('view', { productId: id });
  }, [id]);

  if (q.isLoading) return <ProductSkeleton />;
  if (waitingForNetwork(q)) return <View style={{ flex: 1, paddingTop: insets.top + 60, backgroundColor: t.colors.background }}><BackButton /><OfflineState /></View>;
  if (q.isError) return <View style={{ flex: 1, paddingTop: insets.top + 60, backgroundColor: t.colors.background }}><BackButton /><ErrorState error={q.error} onRetry={() => q.refetch()} /></View>;
  if (!q.data) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 60, backgroundColor: t.colors.background }}>
        <BackButton />
        <EmptyState icon="package" title="Este producto ya no está publicado" body="Puede estar en revisión o haber sido retirado por la tienda." action="Ver catálogo" onAction={() => router.navigate('/explore')} />
      </View>
    );
  }
  return <ProductView product={q.data} />;
}

function BackButton({ inline }: { inline?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <IconButton
      testID="product-back"
      icon="chevron-left"
      label="Volver"
      tone="glass"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={inline ? undefined : { position: 'absolute', left: 16, top: insets.top + 8, zIndex: 10 }}
    />
  );
}

function ProductView({ product: p }: { product: ProductDetail }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fav = useFavorites();
  const methods = usePaymentMethods();
  const addToCart = useAddToCart();
  const purchasableVariants = p.variants.filter((v) => v.active && (v.stock == null || v.stock > 0));
  const [variant, setVariant] = useState<ProductVariant | undefined>(purchasableVariants[0] ?? p.variants[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // what this screen last put in the cart (variant and quantity), so "Comprar" after "Agregar" doesn't add it twice
  const [inCart, setInCart] = useState<string | null>(null);
  const [pending, setPending] = useState<'add' | 'buy' | null>(null);
  const [page, setPage] = useState(0);
  const availability = presentAvailability(p.availability);
  const imageWidth = Math.min(width, MAX_W);
  const maxQty = Math.max(1, Math.min(p.max_per_order ?? 10, variant?.stock ?? 99));
  const lead = describeLeadTime(p.lead_min_days, p.lead_max_days, p.availability);
  const leadShort = describeLeadTimeShort(p.lead_min_days, p.lead_max_days, p.availability);
  const eta = p.lead_min_days != null && p.lead_max_days != null && availability.purchasable ? etaFromToday(p.lead_min_days, p.lead_max_days) : null;
  const hint = stockHint(variant?.stock ?? p.stock_total, p.availability);
  const isFav = fav.isFavorite(p.id) || p.is_favorite;
  const images = p.images.length ? p.images : [{ path: p.image_path ?? '', alt: p.title, width: null, height: null }];
  const variantSoldOut = !!variant && variant.stock != null && variant.stock <= 0;
  // "Disponible" is the normal case and goes unsaid; anything else (agotado, por encargo, en camino) is shown
  const statusKey = variantSoldOut ? 'sold_out' : p.availability;
  const status = presentAvailability(statusKey);
  const optionLabel = useMemo(() => (p.option_names?.length ? p.option_names.join(' / ') : 'Opción'), [p.option_names]);
  // options with different prices say theirs, so nobody has to tap each one to compare
  const variantPrices = new Set(p.variants.map((v) => String(v.price_usd))).size > 1;
  const canBuy = availability.purchasable && !variantSoldOut;
  const [moreText, setMoreText] = useState(false);
  const longText = (p.description?.length ?? 0) > LONG_DESCRIPTION;
  // related products count as recommendations: impressions when the rail is on screen, clicks on its cards
  const tracking = useViewportTracking();
  const scroll = useScrollY(tracking.onWindow);
  const heroHeight = imageWidth / t.imagery.productAspect;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const reviewsY = useRef(0);

  // a different variant starts again from one unit
  const [qtyVariant, setQtyVariant] = useState(variant?.id);
  if (qtyVariant !== variant?.id) {
    setQtyVariant(variant?.id);
    setQty(1);
  }

  const toggleAlert = async () => {
    if (!user) return router.push('/sign-in');
    await api.account.setStockAlert(user.id, p.id, !p.alert_requested);
    haptics.success();
    qc.invalidateQueries({ queryKey: qk.product(p.id) });
  };

  // "Agregar" keeps the buyer here with a link to the cart; "Comprar" adds and opens the cart to pay
  const add = (buy: boolean) => {
    if (!variant) return;
    const key = `${variant.id}:${qty}`;
    if (buy && inCart === key) return router.navigate('/cart');
    setPending(buy ? 'buy' : 'add');
    addToCart.mutate(
      { product: p, variant, quantity: qty },
      {
        onSuccess: () => {
          haptics.success();
          setInCart(key);
          if (buy) return router.navigate('/cart');
          setAdded(true);
          setTimeout(() => setAdded(false), 4000);
        },
        onError: () => haptics.warning(),
        onSettled: () => setPending(null),
      },
    );
  };

  const share = () =>
    Share.share(
      Platform.OS === 'ios'
        ? { url: `https://${brand.webDomain}/p/${p.slug}`, message: p.title }
        : { message: `${p.title} en ${brand.name}: https://${brand.webDomain}/p/${p.slug}` },
    ).catch(() => undefined);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ImpressionScope tracking={tracking} enabled={!!user}>
        <Animated.ScrollView ref={scrollRef} testID="product-scroll" onScroll={scroll.onScroll} onLayout={tracking.onLayout} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
          {/* gallery */}
          <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
            <FlatList
              horizontal
              pagingEnabled
              data={images}
              keyExtractor={(img, i) => `${img.path}-${i}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / imageWidth))}
              renderItem={({ item, index }) => (
                <ProductImage path={item.path} tone={p.tone} alt={item.alt ?? p.title} radius={0} style={{ width: imageWidth }} priority={index === 0 ? 'high' : 'normal'} />
              )}
            />
            {images.length > 1 ? (
              <View accessibilityLabel={`Foto ${page + 1} de ${images.length}`} style={{ position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
                {images.map((_, i) => <View key={i} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? t.colors.text : t.colors.borderStrong }} />)}
              </View>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 20, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
            {/* name and one price right under the photo; what each payment method costs shows when the buyer picks it */}
            <View style={{ gap: 12 }}>
              <View style={{ gap: 4 }}>
                {p.brand_name ? <Text variant="overline" color="textMuted" testID="product-brand">{p.brand_name}</Text> : null}
                <Text variant="displayM" testID="product-title">{p.title}</Text>
                {p.subtitle ? <Text color="textSecondary">{p.subtitle}</Text> : null}
              </View>
              <RatingInline avg={p.rating_avg} count={p.rating_count} onPress={() => scrollRef.current?.scrollTo({ y: reviewsY.current - 80, animated: true })} />
              {/* re-keyed so a variant with another price fades in instead of snapping */}
              <Animated.View key={String(variant?.price_usd ?? p.price_usd)} entering={FadeIn.duration(200)}>
                <Price usd={variant?.price_usd ?? p.price_usd} compareAt={p.compare_at_usd} size="lg" muted={!canBuy} />
              </Animated.View>
              {statusKey !== 'available' || hint ? (
                <View testID="product-status" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* sold out reads at a glance: a solid badge over a greyed price */}
                  {statusKey !== 'available' ? <Badge label={status.label} tone={status.tone} solid={!status.purchasable} /> : null}
                  {status.purchasable && leadShort ? <Text variant="caption" color="textSecondary">{leadShort}</Text> : null}
                  {hint ? <Text variant="caption" color="warning">{hint}</Text> : null}
                </View>
              ) : null}
              {p.is_demo ? (
                <View testID="product-demo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: t.radii.sm, backgroundColor: t.colors.warningSoft }}>
                  <Icon name="info" size={14} color={t.colors.warning} />
                  <Text variant="caption" color="textSecondary" style={{ flexShrink: 1 }}>Producto de demostración: foto y precio de ejemplo, no es una oferta real.</Text>
                </View>
              ) : null}
            </View>

            {/* variants */}
            {p.variants.length > 1 ? (
              <View style={{ gap: 10 }}>
                <Text variant="label" color="textSecondary">{optionLabel}: <Text variant="label">{variant?.title}</Text></Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {p.variants.map((v) => {
                    const out = v.stock != null && v.stock <= 0;
                    const label = `${v.title}${variantPrices ? ` · ${formatUSD(v.price_usd)}` : ''}${out ? ' · agotado' : ''}`;
                    return <Chip key={v.id} testID={`variant-${v.title}`} label={label} selected={variant?.id === v.id} onPress={() => setVariant(v)} />;
                  })}
                </View>
              </View>
            ) : null}

            {canBuy ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label" color="textSecondary">Cantidad</Text>
                <Stepper value={qty} max={maxQty} onChange={setQty} />
              </View>
            ) : null}

            {/* delivery, protection and payment in one card, below what the buyer decides on */}
            <Card style={{ gap: 14 }}>
              <InfoRow icon="truck" title="Entrega" lead={lead ? `${lead}${eta ? ` · ${eta}` : ''}` : undefined} body={p.store.shipping_info ?? 'Verás las opciones y el costo exacto según tu dirección antes de pagar.'} />
              {p.availability === 'on_order' ? <InfoRow icon="wallet" title="Por encargo" body="Puedes pagar el 100 % o un anticipo del 50 % y el resto cuando llegue a Venezuela." /> : null}
              <InfoRow icon="shield-check" title="Compra protegida" body="Si algo no llega como esperabas, abre un reclamo desde tu pedido." />
              {methods.data?.length ? <InfoRow icon="banknote" title="Pagos" body={`${methods.data.map((m) => m.name).join(', ')}. Cada método muestra su monto exacto al pagar.`} /> : null}
            </Card>

            <View testID="product-store">
              <StoreChip store={{ ...p.store, tagline: null, cover_path: null }} overline="Vendido por" />
            </View>

            {p.highlights?.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="title">Características</Text>
                {p.highlights.map((h) => (
                  <View key={h} style={{ flexDirection: 'row', gap: 10 }}>
                    <Icon name="check" size={18} color={t.colors.brand} strokeWidth={2.2} />
                    <Text style={{ flex: 1 }}>{h}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {p.description ? (
              <View style={{ gap: 8 }}>
                <Text variant="title">Descripción</Text>
                <Text color="textSecondary" style={{ lineHeight: 24 }} numberOfLines={longText && !moreText ? 5 : undefined} testID="product-description">{p.description}</Text>
                {longText ? (
                  <ScalePressable accessibilityRole="button" hitSlop={8} onPress={() => setMoreText((v) => !v)} style={{ alignSelf: 'flex-start' }}>
                    <Text variant="label" color="brand">{moreText ? 'Ver menos' : 'Ver más'}</Text>
                  </ScalePressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View onLayout={(e) => (reviewsY.current = e.nativeEvent.layout.y)} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
            <ProductReviewsSection product={p} />
          </View>

          {p.related.length ? (
            <TrackedSection slot="related" ids={p.related.map((r) => r.id)} visible={2} testID="product-related">
              <View style={{ paddingTop: 10 }}>
                <SectionHeader overline="También te puede gustar" title="Relacionados" />
                <ProductRail products={p.related} slot="related" />
              </View>
            </TrackedSection>
          ) : null}
        </Animated.ScrollView>
      </ImpressionScope>

      <CollapsingHeader
        y={scroll.y}
        threshold={heroHeight}
        title={p.title}
        left={<BackButton inline />}
        right={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton icon="share-2" label="Compartir" tone="glass" onPress={share} />
            <IconButton
              testID="product-favorite"
              icon="heart"
              label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              tone="glass"
              filled={isFav}
              color={isFav ? t.colors.danger : t.colors.text}
              onPress={() => (user ? fav.toggle({ productId: p.id, on: !isFav }) : router.push('/sign-in'))}
            />
          </View>
        }
      />

      {/* sticky purchase bar */}
      <BottomBar maxWidth={MAX_W}>
          {added ? (
            <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(160)}>
              <ScalePressable testID="added-to-cart" accessibilityRole="link" onPress={() => router.navigate('/cart')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
                <View style={{ width: 36, height: 45, borderRadius: 8, overflow: 'hidden' }}>
                  <ProductImage path={p.image_path} tone={p.tone} radius={8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label" color="success">Agregado al carrito</Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>{qty > 1 ? `${qty} × ` : ''}{p.title}{variant && p.variants.length > 1 ? ` · ${variant.title}` : ''}</Text>
                </View>
                <Text variant="label" color="brand">Ver carrito</Text>
                <Icon name="chevron-right" size={16} color={t.colors.brand} />
              </ScalePressable>
            </Animated.View>
          ) : null}
          {addToCart.error ? <Text variant="caption" color="danger">{(addToCart.error as Error).message}</Text> : null}
          {canBuy ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button testID="product-add" size="lg" variant="secondary" icon="shopping-bag" title="Agregar" accessibilityLabel="Agregar al carrito" loading={pending === 'add'} disabled={pending === 'buy'} onPress={() => add(false)} style={{ flex: 1 }} />
              <Button testID="product-cta" size="lg" title={availability.action} loading={pending === 'buy'} disabled={pending === 'add'} onPress={() => add(true)} style={{ flex: 1.3 }} />
            </View>
          ) : (
            <Button testID="product-cta" size="lg" full variant="secondary" icon="bell" title={p.alert_requested ? 'Te avisaremos · Cancelar aviso' : 'Avisarme cuando vuelva'} onPress={toggleAlert} />
          )}
      </BottomBar>
    </View>
  );
}

const REVIEWS_PAGE = 5;
/** Longer descriptions start folded at five lines, behind "Ver más". */
const LONG_DESCRIPTION = 280;

/**
 * Verified reviews, always present so a buyer sees at a glance whether anyone has rated it yet. A buyer with a
 * delivered, unrated purchase of this product can rate it right here (the same sheet as the order screen).
 */
function ProductReviewsSection({ product: p }: { product: ProductDetail }) {
  const { user } = useAuth();
  const q = useInfiniteQuery({
    queryKey: qk.reviews(p.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.catalog.reviews(p.id, REVIEWS_PAGE, pageParam),
    getNextPageParam: (last, all) => (last.items.length < REVIEWS_PAGE ? undefined : all.length * REVIEWS_PAGE),
  });
  const mine = useQuery({
    queryKey: qk.reviewable(p.id),
    enabled: !!user,
    queryFn: async () => {
      const items = await api.reviews.deliveredItems(user!.id, p.id);
      return { items, reviews: await api.reviews.mine(items.map((i) => i.id)) };
    },
  });
  const [rating, setRating] = useState<OrderItem | null>(null);
  const toRate = mine.data?.items.find((i) => !mine.data!.reviews.some((r) => r.order_item_id === i.id));
  const summary = q.data?.pages[0]?.summary;
  const items = q.data?.pages.flatMap((pg) => pg.items) ?? [];
  if (q.isLoading) return <Skeleton height={120} />;
  return (
    <View style={{ gap: 16 }} testID="product-reviews">
      <View style={{ gap: 2 }}>
        <Text variant="title">Opiniones</Text>
        <Text variant="caption" color="textMuted">Solo opinan quienes compraron y recibieron este producto.</Text>
      </View>
      {summary?.count ? (
        <RatingSummary summary={summary} />
      ) : (
        <Text testID="product-reviews-empty" variant="bodySmall" color="textSecondary">Aún no hay opiniones de este producto.</Text>
      )}
      {toRate ? <Button testID="product-rate" title="Calificar tu compra" icon="star" variant="secondary" onPress={() => setRating(toRate)} /> : null}
      {items.map((r) => (
        <View key={r.id} style={{ gap: 16 }}>
          <Divider />
          <ReviewItem review={r} storeName={p.store.name} />
        </View>
      ))}
      {q.hasNextPage ? (
        <Button title="Ver más opiniones" variant="secondary" loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} />
      ) : null}
      <ReviewSheet key={rating?.id ?? 'none'} item={rating} orderId={rating?.order_id ?? ''} onClose={() => setRating(null)} />
    </View>
  );
}

function InfoRow({ icon, title, lead, body }: { icon: 'truck' | 'wallet' | 'shield-check' | 'banknote'; title: string; lead?: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Icon name={icon} size={20} color={colors.brand} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {lead ? <Text variant="bodySmall" testID="product-lead">{lead}</Text> : null}
        <Text variant="bodySmall" color="textSecondary">{body}</Text>
      </View>
    </View>
  );
}

function ProductSkeleton() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = Math.min(width, MAX_W);
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, alignItems: 'center' }}>
      <BackButton />
      <Skeleton width={w} height={w * 1.25} radius={0} />
      <View style={{ width: w, padding: 20, gap: 12 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="85%" height={24} />
        <Skeleton width="30%" height={28} />
      </View>
    </View>
  );
}
