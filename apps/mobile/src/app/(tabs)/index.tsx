import type { CollectionBlock, ProductCard as Card } from '@kora/api';
import { router, useFocusEffect } from 'expo-router';
import { palette } from '@kora/design-tokens';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CategoryTiles } from '@/components/catalog/CategoryTiles';
import { MiniProductCard } from '@/components/catalog/MiniProductCard';
import { MAX_CONTENT, ProductCard, ProductRail, useGridColumns } from '@/components/catalog/ProductGrid';
import { EditorialOpening } from '@/components/catalog/EditorialOpening';
import { ExhibitionNotice } from '@/components/catalog/ExhibitionNotice';
import { StoreChip } from '@/components/catalog/StoreCard';
import { useScrollY } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { CountBadge } from '@/components/ui/CountBadge';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { ProductCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, StaleNotice, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { useCartCount, useHome, useProfile, useSearch, useUnreadCount } from '@/lib/hooks';
import { ImpressionScope, recordImpressions, TrackedSection, useViewportTracking } from '@/lib/impressions';
import { qk } from '@/lib/query';
import { useTheme } from '@/theme';

type Row =
  | { kind: 'title'; key: string; overline: string; title: string }
  | { kind: 'products'; key: string; slot: string; items: Card[] }
  | { kind: 'loading'; key: string }
  | { kind: 'empty'; key: string };

const SEARCH_BOTTOM = 112; // initial estimate; the inline search reports its actual bottom after layout/reflow

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
  const [searchBottom, setSearchBottom] = useState(SEARCH_BOTTOM);
  // The editorial masthead is dark in both themes. Restore the shared status appearance when leaving Home.
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' });
    return () => StatusBar.popStackEntry(entry);
  }, []));

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
    if (!first.length && !rest.length && !data.collections.some((c) => c.products.length) && !more.isLoading && !more.isError) return [{ kind: 'empty', key: 'empty' }];
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
  const profile = useProfile();
  const enabled = !!user && profile.isSuccess && profile.data?.personalization_enabled === true;
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
          ListHeaderComponent={<Header home={home} onSearchBottom={setSearchBottom} />}
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
        <StickySearch y={scroll.y} searchBottom={searchBottom} />
      </View>
    </ImpressionScope>
  );
}

/** Everything above the feed. Each TrackedSection must stay a direct child of the root view (see impressions). */
function Header({ home, onSearchBottom }: { home: ReturnType<typeof useHome>; onSearchBottom: (bottom: number) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { user } = useAuth();
  const profile = useProfile();
  const unread = useUnreadCount();
  const cartCount = useCartCount();
  const data = home.data;
  const contentWidth = Math.min(width, MAX_CONTENT);
  const comparisonGrid = useGridColumns();
  const comparisonColumns = fontScale > 1.3 && contentWidth < 600 ? 1 : comparisonGrid.columns;
  const comparisonWidth = Math.floor((contentWidth - 32 - comparisonGrid.gap * (comparisonColumns - 1)) / comparisonColumns);
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const collections = (data?.collections ?? []).filter((c) => c.products.length);
  // "feature" collections lead as the hero; the rest are shelves further down
  const hero = collections.find((c) => c.layout === 'feature' && c.products.some((p) => p.image_path && p.availability !== 'unavailable'));
  const heroProduct = hero?.products.find((p) => p.image_path && p.availability !== 'unavailable');
  const shelves = collections.filter((c) => c.id !== hero?.id);
  const head = shelves.slice(0, 2);
  const tail = shelves.slice(2);
  const personalized = !!user && profile.data?.personalization_enabled === true && !!data?.personalized;
  const comparison = (data?.recommended ?? []).filter((p) => p.id !== heroProduct?.id).slice(0, 4);
  const remainingPicks = (data?.recommended ?? []).filter((p) => !comparison.some((shown) => shown.id === p.id) && p.id !== heroProduct?.id);
  const picksSlot = personalized ? 'home_for_you' : 'home_featured';
  const picksTrackingSlot = user && profile.isSuccess && profile.data?.personalization_enabled === true ? picksSlot : undefined;

  return (
    <View>
      {/* Adjacent surfaces stay visually continuous; the tracked hero remains a direct scroll-content child. */}
      <View testID="home-masthead" style={{ paddingTop: insets.top + 6, paddingBottom: 12, backgroundColor: palette.violet[900] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 8, minHeight: 44 }}>
        <View style={{ flex: 1 }}>
          <Wordmark inverse />
          {isPrivateCatalogPresentation ? <ExhibitionNotice style={{ color: palette.violet[200] }} /> : firstName ? <Text variant="caption" style={{ color: palette.violet[200] }} numberOfLines={1}>Hola, {firstName}</Text> : null}
        </View>
        <View>
          <IconButton testID="home-bell" icon="bell" label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} color={palette.ink[0]} size={44} onPress={() => router.push(user ? '/notifications' : '/sign-in')} />
          {unread ? <View testID="home-unread-indicator" pointerEvents="none" style={{ position: 'absolute', right: 9, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.accent, borderWidth: 1.5, borderColor: palette.violet[900] }} /> : null}
        </View>
        <View>
          <IconButton testID="home-cart" icon="shopping-bag" label={cartCount ? `Carrito, ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}` : 'Carrito'} color={palette.ink[0]} size={44} onPress={() => router.navigate('/cart')} />
          <CountBadge count={cartCount} testID="home-cart-count" />
        </View>
      </View>

      <SearchEntry editorial onBottom={onSearchBottom} />
      </View>

      {!data && home.isLoading ? <View style={{ paddingHorizontal: 16, paddingBottom: 16, backgroundColor: palette.violet[900] }}><Skeleton height={170} radius={6} /></View> : null}
      {hero && heroProduct ? <EditorialOpening block={hero} product={heroProduct} width={contentWidth} onOpen={() => openCollection(hero)} /> : null}

      {home.isError && !data ? <ErrorState error={home.error} onRetry={() => home.refetch()} /> : waitingForNetwork(home) ? <OfflineState /> : null}

      <View testID="home-category-bridge" style={{ paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border }}>
        {data ? (
          <CategoryTiles categories={data.categories} compact />
        ) : (
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, minHeight: 44, alignItems: 'center' }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={64} height={28} radius={6} />)}
          </View>
        )}
      </View>

      <View style={{ marginHorizontal: 16 }}><StaleNotice q={home} /></View>

      {comparison.length ? <View style={{ marginTop: 12 }}><SectionHeader title={personalized ? 'Elegidos para ti' : 'Para empezar'} /></View> : null}
      {Array.from({ length: Math.ceil(comparison.length / comparisonColumns) }, (_, i) => {
        const row = comparison.slice(i * comparisonColumns, (i + 1) * comparisonColumns);
        return (
          <Fragment key={`${picksSlot}-${i}`}>
            {i ? <View style={{ height: 12 }} /> : null}
            <TrackedSection slot={picksSlot} ids={row.map((p) => p.id)} visible={row.length} testID={i === 0 ? 'home-recommended' : `home-recommended-row-${i + 1}`}>
              <View style={{ flexDirection: 'row', gap: comparisonGrid.gap, paddingHorizontal: 16 }}>
                {row.map((p) => <ProductCard key={p.id} product={p} width={comparisonWidth} slot={picksTrackingSlot} priority="high" />)}
              </View>
            </TrackedSection>
          </Fragment>
        );
      })}

      {data?.recently_viewed.length ? (
        <TrackedSection slot="home_recent" ids={data.recently_viewed.slice(0, 10).map((p) => p.id)} visible={2} testID="home-recent">
          <View style={{ marginTop: 24 }}>
            <SectionHeader title="Retoma donde quedaste" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {data.recently_viewed.slice(0, 10).map((p) => <MiniProductCard key={p.id} product={p} width={Math.min(250, contentWidth * 0.66)} slot="home_recent" />)}
            </ScrollView>
          </View>
        </TrackedSection>
      ) : null}

      {remainingPicks.length ? (
        <TrackedSection slot={picksSlot} ids={remainingPicks.map((p) => p.id)} visible={2} testID="home-more-recommended">
          <View style={{ marginTop: 24 }}>
            <SectionHeader title="Más para descubrir" action="Explorar catálogo" stackAction={fontScale > 1.3 || contentWidth < 360} onAction={() => router.navigate('/explore')} />
            <ProductRail products={remainingPicks} slot={picksTrackingSlot} />
          </View>
        </TrackedSection>
      ) : null}

      {head.map((c) => <Collection key={c.id} block={c} />)}

      {data?.stores.length ? (
        <View style={{ marginTop: 24 }} testID="home-stores">
          <SectionHeader overline="Conoce quién vende" title="Tiendas destacadas"  />
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
function Wordmark({ inverse = false }: { inverse?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }} accessible accessibilityRole="header" accessibilityLabel={brand.name}>
      <Text variant="displayL" style={{ fontSize: 24, lineHeight: 28, letterSpacing: -1, color: inverse ? palette.ink[0] : t.colors.brand }}>{brand.name.toLowerCase()}</Text>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.accent, marginBottom: 6 }} />
    </View>
  );
}

function SearchEntry({ editorial = false, onBottom }: { editorial?: boolean; onBottom?: (bottom: number) => void }) {
  const t = useTheme();
  return (
    <View onLayout={onBottom ? (e) => onBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height) : undefined} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16 }}>
      <ScalePressable
        testID="home-search"
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel="Buscar productos o marcas"
        onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
        style={{ flex: 1, minHeight: 48, borderRadius: t.radii.sm, backgroundColor: editorial ? palette.violet[50] : t.colors.surface, borderWidth: 1, borderColor: editorial ? palette.violet[200] : t.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}
      >
        <Icon name="search" size={20} color={editorial ? palette.ink[700] : t.colors.textSecondary} />
        <Text style={{ flex: 1, color: editorial ? palette.ink[700] : t.colors.textMuted }}>Buscar productos o marcas</Text>
      </ScalePressable>
    </View>
  );
}

/** Once the inline search scrolls away, an opaque bar with a compact search slides in so it is always one tap away. */
function StickySearch({ y, searchBottom }: { y: SharedValue<number>; searchBottom: number }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  useAnimatedReaction(
    () => y.value >= searchBottom - 20,
    (shown, before) => { if (shown !== before) scheduleOnRN(setVisible, shown); },
  );
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [searchBottom - 20, searchBottom + 10], [0, 1], Extrapolation.CLAMP),
    // parked above the screen while hidden so it never intercepts touches
    transform: [{ translateY: y.value < searchBottom - 20 ? -200 : interpolate(y.value, [searchBottom - 20, searchBottom + 10], [-10, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <>
      {/* status bar backing: content never shows through the clock and battery */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: palette.violet[900] }} />
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!visible}
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: palette.violet[900] },
          style,
        ]}
      >
        <View style={{ width: '100%', maxWidth: MAX_CONTENT - 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Wordmark inverse />
          <ScalePressable
            testID="home-search-sticky"
            scaleTo={0.99}
            accessibilityRole="button"
            accessibilityLabel="Buscar productos o marcas"
            focusable={visible}
            tabIndex={visible ? 0 : -1}
            onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
            style={{ flex: 1, height: 44, borderRadius: t.radii.sm, backgroundColor: palette.violet[50], flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}
          >
            <Icon name="search" size={18} color={palette.ink[700]} />
            <Text variant="bodySmall" style={{ color: palette.ink[700] }} numberOfLines={1}>Buscar</Text>
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
  const { width, fontScale } = useWindowDimensions();
  const stackAction = fontScale > 1.3 || width < 360;
  const slot = `collection:${block.slug}`;
  const ids = block.products.map((p) => p.id);
  if (block.layout === 'grid' && block.products.length >= grid.columns) {
    // whole rows only: a lone card at the end reads as a mistake
    const n = Math.min(block.products.length, grid.columns * 2);
    const shown = block.products.slice(0, n - (n % grid.columns));
    return (
      <TrackedSection slot={slot} ids={shown.map((p) => p.id)} visible={shown.length} testID={`collection-${block.slug}`}>
        <View style={{ marginTop: 24 }}>
          <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" stackAction={stackAction} onAction={() => openCollection(block)} />
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
        <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" stackAction={stackAction} onAction={() => openCollection(block)} />
        <ProductRail products={block.products} slot={slot} />
      </View>
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
