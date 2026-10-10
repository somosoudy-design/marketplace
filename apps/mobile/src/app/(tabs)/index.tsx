import type { CollectionBlock, ProductCard as Card } from '@kora/api';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CategoryTiles } from '@/components/catalog/CategoryTiles';
import { MiniProductCard } from '@/components/catalog/MiniProductCard';
import { MAX_CONTENT, ProductCard, ProductRail, useGridColumns } from '@/components/catalog/ProductGrid';
import { ProductImage } from '@/components/catalog/ProductImage';
import { StoreChip } from '@/components/catalog/StoreCard';
import { useScrollY } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { CountBadge } from '@/components/ui/CountBadge';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { ProductCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { useCartCount, useHome, useProfile, useSearch, useUnreadCount } from '@/lib/hooks';
import { ImpressionScope, recordImpressions, TrackedSection, useViewportTracking } from '@/lib/impressions';
import { qk } from '@/lib/query';
import { useTheme } from '@/theme';

type Row =
  | { kind: 'title'; key: string; overline: string; title: string }
  | { kind: 'products'; key: string; slot: string; items: Card[] }
  | { kind: 'loading'; key: string }
  | { kind: 'empty'; key: string };

const SEARCH_BOTTOM = 112; // scroll offset at which the inline search has left the screen

// The store front: a compact masthead, search one tap away, categories, then merchandise. Nothing institutional
// (rates, payment methods, guarantees) competes with the products here; those live where they decide something.
export default function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const home = useHome();
  const grid = useGridColumns();
  const data = home.data;

  // the feed under the shelves: everything published, by recent popularity (the ranked picks have their own rail)
  const more = useSearch({ sort: 'popular' });
  const rows = useMemo<Row[]>(() => {
    if (!data) return [{ kind: 'loading', key: 'loading' }];
    const out: Row[] = [];
    const push = (slot: string, items: Card[]) => {
      for (let i = 0; i < items.length; i += grid.columns) out.push({ kind: 'products', key: `${slot}-${i}`, slot, items: items.slice(i, i + grid.columns) });
    };
    const first = data.recommended;
    const rest = (more.data?.pages.flat() ?? []).filter((p) => !first.some((f) => f.id === p.id) && p.availability !== 'unavailable');
    // a marketplace that has published nothing yet says so instead of showing empty shelves
    if (!first.length && !rest.length && !more.isLoading && !more.isError) return [{ kind: 'empty', key: 'empty' }];
    if (rest.length) {
      out.push({ kind: 'title', key: 'popular', overline: 'Más del catálogo', title: 'Sigue descubriendo' });
      push('home_popular', rest);
    }
    if (more.isFetchingNextPage || (more.isLoading && !rest.length)) out.push({ kind: 'loading', key: 'more' });
    return out;
  }, [data, more.data, more.isFetchingNextPage, more.isLoading, more.isError, grid.columns]);
  const empty = rows.length === 1 && rows[0]!.kind === 'empty';

  // impressions: shelves count when their section enters the viewport, the feed per visible row
  const tracking = useViewportTracking();
  const scroll = useScrollY(tracking.onWindow);
  const enabled = !!user;
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    if (!enabledRef.current) return;
    viewableItems.forEach(({ item }) => item?.kind === 'products' && recordImpressions(item.slot, item.items.map((p) => p.id)));
  }, []);

  const refresh = useCallback(() => {
    void home.refetch();
    void more.refetch();
    void qc.invalidateQueries({ queryKey: qk.rate });
  }, [home, more, qc]);

  return (
    <ImpressionScope tracking={tracking} enabled={enabled}>
      <View style={{ flex: 1, backgroundColor: t.colors.background }}>
        <Animated.FlatList
          testID="home-scroll"
          data={rows}
          key={grid.columns}
          keyExtractor={(r) => r.key}
          onScroll={scroll.onScroll}
          scrollEventThrottle={16}
          onLayout={tracking.onLayout}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 400 }}
          contentContainerStyle={{ paddingBottom: 32, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={refresh} tintColor={t.colors.brand} progressViewOffset={insets.top} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => more.hasNextPage && !more.isFetchingNextPage && void more.fetchNextPage()}
          ListHeaderComponent={<Header home={home} />}
          ListFooterComponent={data && !empty && !more.hasNextPage && !more.isLoading ? <FeedEnd /> : null}
          renderItem={({ item }) => {
            if (item.kind === 'empty') return <CatalogOpening signedIn={!!user} />;
            if (item.kind === 'title') return <View style={{ marginTop: 24 }}><SectionHeader overline={item.overline} title={item.title} /></View>;
            if (item.kind === 'loading') {
              return (
                <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16, marginTop: 8 }}>
                  {Array.from({ length: grid.columns }, (_, i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16, marginBottom: 14 }}>
                {item.items.map((p) => <ProductCard key={p.id} product={p} width={grid.cardWidth} slot={item.slot} />)}
              </View>
            );
          }}
        />
        <StickySearch y={scroll.y} />
      </View>
    </ImpressionScope>
  );
}

/** Everything above the feed. Each TrackedSection must stay a direct child of the root view (see impressions). */
function Header({ home }: { home: ReturnType<typeof useHome> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const profile = useProfile();
  const unread = useUnreadCount();
  const cartCount = useCartCount();
  const data = home.data;
  const contentWidth = Math.min(width, MAX_CONTENT);
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const collections = (data?.collections ?? []).filter((c) => c.products.length);
  // "feature" collections lead as the hero; the rest are shelves further down
  const hero = collections.filter((c) => c.layout === 'feature');
  const shelves = collections.filter((c) => c.layout !== 'feature');
  const head = shelves.slice(0, 2);
  const tail = shelves.slice(2);
  const personalized = !!data?.personalized;
  const picksSlot = personalized ? 'home_for_you' : 'home_featured';

  return (
    <View>
      <View style={{ height: insets.top + 6 }} />

      {/* Identity and real status; saved products live in Account and on each product. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 14, minHeight: 48 }}>
        <View style={{ flex: 1 }}>
          <Wordmark />
          <Text variant="caption" color="textMuted" numberOfLines={1}>{firstName ? `Hola, ${firstName}` : brand.tagline}</Text>
        </View>
        <View>
          <IconButton testID="home-bell" icon="bell" label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} tone="surface" size={44} onPress={() => router.push(user ? '/notifications' : '/sign-in')} />
          {unread ? <View testID="home-unread-indicator" pointerEvents="none" style={{ position: 'absolute', right: 9, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.accent, borderWidth: 1.5, borderColor: t.colors.surface }} /> : null}
        </View>
        <View>
          <IconButton testID="home-cart" icon="shopping-bag" label={cartCount ? `Carrito, ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}` : 'Carrito'} tone="surface" size={44} onPress={() => router.navigate('/cart')} />
          <CountBadge count={cartCount} testID="home-cart-count" />
        </View>
      </View>

      <SearchEntry />

      {home.isError && !data ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : waitingForNetwork(home) ? <OfflineState /> : null}

      <View style={{ marginTop: 16 }}>
        {data ? (
          <CategoryTiles categories={data.categories} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={56} height={56} radius={28} />)}
          </View>
        )}
      </View>

      {!data && home.isLoading ? <View style={{ paddingHorizontal: 16, marginTop: 22 }}><Skeleton height={172} radius={t.radii.xl} /></View> : null}
      {hero.length ? <HeroCollections blocks={hero} width={contentWidth} /> : null}

      {data?.recently_viewed.length ? (
        <TrackedSection slot="home_recent" ids={data.recently_viewed.map((p) => p.id)} visible={2} testID="home-recent">
          <View style={{ marginTop: 24 }}>
            <SectionHeader title="Retoma donde quedaste" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {data.recently_viewed.slice(0, 10).map((p) => <MiniProductCard key={p.id} product={p} width={Math.min(250, contentWidth * 0.66)} slot="home_recent" />)}
            </ScrollView>
          </View>
        </TrackedSection>
      ) : null}

      {data?.recommended.length ? (
        <TrackedSection slot={picksSlot} ids={data.recommended.map((p) => p.id)} visible={2} testID="home-recommended">
          <View style={{ marginTop: 24 }}>
            <SectionHeader
              overline={personalized ? 'Según lo que te gusta' : 'Para empezar'}
              title={personalized ? 'Elegidos para ti' : 'Recomendados'}
              action="Ver todo"
              onAction={() => router.navigate('/explore')}
            />
            <ProductRail products={data.recommended} slot={picksSlot} />
          </View>
        </TrackedSection>
      ) : null}

      {head.map((c) => <Collection key={c.id} block={c} />)}

      {data?.stores.length ? (
        <View style={{ marginTop: 24 }} testID="home-stores">
          <SectionHeader overline="Conoce quién vende" title="Tiendas destacadas" action="Ver todas" onAction={() => router.navigate('/explore')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {data.stores.map((s) => <StoreChip key={s.id} store={s} width={Math.min(236, contentWidth * 0.62)} />)}
          </ScrollView>
        </View>
      ) : null}

      {tail.map((c) => <Collection key={c.id} block={c} />)}
    </View>
  );
}

/** The name in the brand color with a coral spark: the one flourish in the interface. */
function Wordmark() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }} accessible accessibilityRole="header" accessibilityLabel={brand.name}>
      <Text variant="displayL" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -1, color: t.colors.brand }}>{brand.name.toLowerCase()}</Text>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.accent, marginBottom: 6 }} />
    </View>
  );
}

function SearchEntry() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16 }}>
      <ScalePressable
        testID="home-search"
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel="Buscar productos, marcas o tiendas"
        onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
        style={{ flex: 1, height: 48, borderRadius: t.radii.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
      >
        <Icon name="search" size={20} color={t.colors.textSecondary} />
        <Text color="textMuted" numberOfLines={1} style={{ flex: 1 }}>Buscar productos, marcas o tiendas</Text>
      </ScalePressable>
    </View>
  );
}

/** Once the inline search scrolls away, an opaque bar with a compact search slides in so it is always one tap away. */
function StickySearch({ y }: { y: SharedValue<number> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  useAnimatedReaction(
    () => y.value >= SEARCH_BOTTOM - 20,
    (shown, before) => { if (shown !== before) scheduleOnRN(setVisible, shown); },
  );
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [SEARCH_BOTTOM - 20, SEARCH_BOTTOM + 10], [0, 1], Extrapolation.CLAMP),
    // parked above the screen while hidden so it never intercepts touches
    transform: [{ translateY: y.value < SEARCH_BOTTOM - 20 ? -200 : interpolate(y.value, [SEARCH_BOTTOM - 20, SEARCH_BOTTOM + 10], [-10, 0], Extrapolation.CLAMP) }],
  }));
  const status = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));
  return (
    <>
      {/* status bar backing: content never shows through the clock and battery */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: t.colors.chrome }, status]} />
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!visible}
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: t.colors.chrome, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.borderStrong },
          style,
        ]}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT - 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Wordmark />
          <ScalePressable
            testID="home-search-sticky"
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityLabel="Buscar productos, marcas o tiendas"
            onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
            style={{ flex: 1, height: 44, borderRadius: t.radii.sm, backgroundColor: t.colors.surfaceSunken, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}
          >
            <Icon name="search" size={18} color={t.colors.textMuted} />
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>Buscar en {brand.name}</Text>
          </ScalePressable>
        </View>
      </Animated.View>
    </>
  );
}

function openCollection(block: CollectionBlock) {
  router.push({ pathname: '/catalog', params: { collection: block.slug, title: block.title } });
}

/** Shelves below the hero: rails, or a grid of whole rows when the collection asks for one. */
function Collection({ block }: { block: CollectionBlock }) {
  const grid = useGridColumns();
  const slot = `collection:${block.slug}`;
  const ids = block.products.map((p) => p.id);
  if (block.layout === 'grid' && block.products.length >= grid.columns) {
    // whole rows only: a lone card at the end reads as a mistake
    const n = Math.min(block.products.length, grid.columns * 2);
    const shown = block.products.slice(0, n - (n % grid.columns));
    return (
      <TrackedSection slot={slot} ids={shown.map((p) => p.id)} visible={shown.length} testID={`collection-${block.slug}`}>
        <View style={{ marginTop: 24 }}>
          <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" onAction={() => openCollection(block)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grid.gap, rowGap: 14, paddingHorizontal: 16 }}>
            {shown.map((p) => <ProductCard key={p.id} product={p} width={grid.cardWidth} slot={slot} />)}
          </View>
        </View>
      </TrackedSection>
    );
  }
  return (
    <TrackedSection slot={slot} ids={ids} visible={2} testID={`collection-${block.slug}`}>
      <View style={{ marginTop: 24 }}>
        <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" onAction={() => openCollection(block)} />
        <ProductRail products={block.products} slot={slot} />
      </View>
    </TrackedSection>
  );
}

/**
 * The featured collections as a swipeable hero. Each slide shows the collection's own products on its tone, so the
 * top of the store is merchandise, not a promotional poster.
 */
function HeroCollections({ blocks, width }: { blocks: CollectionBlock[]; width: number }) {
  const [index, setIndex] = useState(0);
  const slide = width - 44;
  const gap = 10;
  return (
    <View style={{ marginTop: 20 }} testID="home-hero">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slide + gap}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 16, gap }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const i = Math.max(0, Math.min(blocks.length - 1, Math.round(e.nativeEvent.contentOffset.x / (slide + gap))));
          if (i !== index) setIndex(i);
        }}
      >
        {blocks.map((b) => <HeroSlide key={b.id} block={b} width={slide} />)}
      </ScrollView>
      {blocks.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 }} accessible={false}>
          {blocks.map((b, i) => <PageDot key={b.id} active={i === index} />)}
        </View>
      ) : null}
    </View>
  );
}

function PageDot({ active }: { active: boolean }) {
  const t = useTheme();
  return <View style={{ width: active ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: active ? t.colors.brand : t.colors.borderStrong }} />;
}

function HeroSlide({ block, width }: { block: CollectionBlock; width: number }) {
  const t = useTheme();
  const tone = t.tone(block.tone);
  const slot = `collection:${block.slug}`;
  const [a, b] = block.products;
  const { fontScale } = useWindowDimensions();
  const height = Math.round(Math.min(184, Math.max(172, width * 0.48)) * Math.max(1, fontScale));
  const art = Math.min(width * 0.38, 160);
  return (
    <TrackedSection slot={slot} ids={block.products.map((p) => p.id)} visible={2} testID={`collection-${block.slug}`}>
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        scaleTo={0.985}
        accessibilityRole="link"
        accessibilityLabel={`Colección ${block.title}${block.products.every((p) => p.is_demo) ? ', demostración' : ''}`}
        onPress={() => openCollection(block)}
        style={{ width, height, borderRadius: t.radii.xl, backgroundColor: t.scheme === 'dark' ? tone.dark : tone.bgDeep, overflow: 'hidden', flexDirection: 'row' }}
      >
        <View style={{ flex: 1, padding: 16, paddingRight: 6, justifyContent: 'space-between' }}>
          <View style={{ gap: 6 }}>
            <Text variant="overline" color="brand">{block.products.every((p) => p.is_demo) ? 'COLECCIÓN DEMO' : 'COLECCIÓN'}</Text>
            <Text variant="title" numberOfLines={2}>{block.title}</Text>
            {block.subtitle ? <Text variant="caption" color="textSecondary" numberOfLines={2}>{block.subtitle}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 32 }}>
            <Text variant="label" color="brand">Ver colección</Text>
            <Icon name="arrow-right" size={15} color={t.colors.brand} />
          </View>
        </View>
        <View style={{ width: art }}>
          {b ? <ProductImage path={b.image_path} tone={b.tone} radius={t.radii.md} style={{ position: 'absolute', width: art * 0.52, right: 12, top: 14 }} /> : null}
          {a ? (
            <ProductImage path={a.image_path} tone={a.tone} alt={a.title} radius={t.radii.lg} style={{ position: 'absolute', width: art * 0.64, left: 0, bottom: 12, borderWidth: 3, borderColor: t.colors.surface }} />
          ) : null}
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}

/** Nothing is published yet (a new marketplace, or every product paused): honest, calm, and one useful next step. */
function CatalogOpening({ signedIn }: { signedIn: boolean }) {
  return (
    <View testID="home-catalog-empty" style={{ marginTop: 12 }}>
      <EmptyState
        icon="store"
        title="Las tiendas están preparando su catálogo"
        body={signedIn
          ? 'Todavía no hay productos publicados. Aquí aparecerán apenas una tienda publique el primero.'
          : 'Todavía no hay productos publicados. Crea tu cuenta y tendrás tus datos de envío listos cuando abran.'}
        action={signedIn ? undefined : 'Crear cuenta'}
        onAction={signedIn ? undefined : () => router.push('/sign-up')}
      />
    </View>
  );
}

function FeedEnd() {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 12, paddingBottom: 8 }} testID="home-feed-end">
      <Text variant="bodySmall" color="textMuted" align="center">Ya viste todo lo que hay por ahora. Usa los filtros para encontrar algo puntual.</Text>
      <Button title="Buscar con filtros" variant="secondary" icon="sliders-horizontal" onPress={() => router.navigate('/explore')} />
    </View>
  );
}
