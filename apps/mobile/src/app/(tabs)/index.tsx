import type { CollectionBlock, ProductCard as Card } from '@kora/api';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CategoryTiles } from '@/components/catalog/CategoryTiles';
import { MiniProductCard } from '@/components/catalog/MiniProductCard';
import { MAX_CONTENT, ProductCard, ProductRail, useGridColumns } from '@/components/catalog/ProductGrid';
import { StoreCard } from '@/components/catalog/StoreCard';
import { RatePill } from '@/components/RateSheet';
import { useScrollY } from '@/components/ui/Bars';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { ProductCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { useHome, useProfile, useSearch, useUnreadCount } from '@/lib/hooks';
import { ImpressionScope, recordImpressions, TrackedSection, useViewportTracking } from '@/lib/impressions';
import { qk } from '@/lib/query';
import { useTheme } from '@/theme';

type Row =
  | { kind: 'title'; key: string; overline: string; title: string }
  | { kind: 'products'; key: string; slot: string; items: Card[] }
  | { kind: 'loading'; key: string }
  | { kind: 'empty'; key: string };

const SEARCH_BOTTOM = 128; // scroll offset at which the inline search has left the screen

export default function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const home = useHome();
  const grid = useGridColumns();
  const data = home.data;
  const personalized = !!data?.personalized;

  // continuous feed: the ranked selection first, then everything else by recent popularity
  const more = useSearch({ sort: 'popular' });
  const rows = useMemo<Row[]>(() => {
    if (!data) return [{ kind: 'loading', key: 'loading' }];
    const out: Row[] = [];
    const push = (slot: string, items: Card[]) => {
      for (let i = 0; i < items.length; i += grid.columns) out.push({ kind: 'products', key: `${slot}-${i}`, slot, items: items.slice(i, i + grid.columns) });
    };
    const first = data.recommended;
    const rest = (more.data?.pages.flat() ?? []).filter((p) => !first.some((f) => f.id === p.id) && p.availability !== 'unavailable');
    // a marketplace that has published nothing yet says so instead of showing an empty "featured" heading
    if (!first.length && !rest.length && !more.isLoading && !more.isError) return [{ kind: 'empty', key: 'empty' }];
    out.push(personalized
      ? { kind: 'title', key: 't1', overline: 'Para ti', title: 'Elegidos según lo que te gusta' }
      : { kind: 'title', key: 't1', overline: 'Destacados', title: 'Una selección para empezar' });
    push(personalized ? 'home_for_you' : 'home_featured', first);
    if (rest.length) {
      out.push({ kind: 'title', key: 't2', overline: 'Más para descubrir', title: 'Lo más elegido últimamente' });
      push('home_popular', rest);
    }
    if (more.isFetchingNextPage || (more.isLoading && !rest.length)) out.push({ kind: 'loading', key: 'more' });
    return out;
  }, [data, personalized, more.data, more.isFetchingNextPage, more.isLoading, more.isError, grid.columns]);
  const empty = rows.length === 1 && rows[0]!.kind === 'empty';

  // impressions: rails count when their section enters the viewport, the feed per visible row
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
            if (item.kind === 'title') return <View style={{ marginTop: 36 }}><SectionHeader overline={item.overline} title={item.title} /></View>;
            if (item.kind === 'loading') {
              return (
                <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16, marginTop: 8 }}>
                  {Array.from({ length: grid.columns }, (_, i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}
                </View>
              );
            }
            return (
              <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16, marginBottom: 24 }}>
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
  const data = home.data;
  const contentWidth = Math.min(width, MAX_CONTENT);
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const collections = (data?.collections ?? []).filter((c) => c.products.length);
  const head = collections.slice(0, 3);
  const tail = collections.slice(3);

  return (
    <View>
      <View style={{ height: insets.top + 8 }} />

      {/* masthead */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="displayL" style={{ fontSize: 30, lineHeight: 34, color: t.colors.brand }} accessibilityRole="header">{brand.name}</Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>{firstName ? `Hola, ${firstName}` : brand.tagline}</Text>
        </View>
        <View>
          <IconButton testID="home-bell" icon="bell" label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} tone="surface" onPress={() => router.push(user ? '/notifications' : '/sign-in')} />
          {unread ? <View style={{ position: 'absolute', right: 8, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.danger, borderWidth: 1.5, borderColor: t.colors.surface }} /> : null}
        </View>
      </View>

      <SearchEntry />
      <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <RatePill />
      </View>

      {home.isError && !data ? <ErrorState onRetry={() => home.refetch()} /> : waitingForNetwork(home) ? <OfflineState /> : null}

      <View style={{ marginTop: 24 }}>
        {data ? (
          <CategoryTiles categories={data.categories} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 22, paddingHorizontal: 16 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={68} height={68} radius={34} />)}
          </View>
        )}
      </View>

      {data?.recently_viewed.length ? (
        <TrackedSection slot="home_recent" ids={data.recently_viewed.map((p) => p.id)} visible={2} testID="home-recent">
          <View style={{ marginTop: 30 }}>
            <SectionHeader overline="Seguir viendo" title="Retoma donde quedaste" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {data.recently_viewed.slice(0, 10).map((p) => <MiniProductCard key={p.id} product={p} width={Math.min(250, contentWidth * 0.66)} slot="home_recent" />)}
            </ScrollView>
          </View>
        </TrackedSection>
      ) : null}

      {!data && home.isLoading ? <View style={{ paddingHorizontal: 16, marginTop: 30 }}><Skeleton height={380} radius={t.radii.xl} /></View> : null}

      {head.map((c) => <Collection key={c.id} block={c} />)}

      {data?.stores.length ? (
        <View style={{ marginTop: 40 }} testID="home-stores">
          <SectionHeader overline="Tiendas" title="Quién vende aquí" action="Ver todas" onAction={() => router.navigate('/explore')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {data.stores.map((s) => <StoreCard key={s.id} store={s} width={Math.min(260, contentWidth * 0.68)} />)}
          </ScrollView>
        </View>
      ) : null}

      {tail.map((c) => <Collection key={c.id} block={c} />)}

      {data ? <TrustStrip /> : null}
    </View>
  );
}

function SearchEntry() {
  const t = useTheme();
  return (
    <ScalePressable
      testID="home-search"
      scaleTo={0.99}
      accessibilityRole="search"
      accessibilityLabel="Buscar productos, marcas o tiendas"
      onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
      style={{ marginHorizontal: 16, height: 50, borderRadius: t.radii.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}
    >
      <Icon name="search" size={20} color={t.colors.textMuted} />
      <Text color="textMuted" numberOfLines={1}>Buscar productos, marcas o tiendas</Text>
    </ScalePressable>
  );
}

/** Once the inline search scrolls away, an opaque bar with a compact search slides in so it is always one tap away. */
function StickySearch({ y }: { y: SharedValue<number> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: 16, backgroundColor: t.colors.chrome, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.borderStrong },
          style,
        ]}
      >
        <ScalePressable
          testID="home-search-sticky"
          scaleTo={0.99}
          accessibilityRole="search"
          accessibilityLabel="Buscar productos, marcas o tiendas"
          onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
          style={{ width: '100%', maxWidth: MAX_CONTENT - 32, alignSelf: 'center', height: 42, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceSunken, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}
        >
          <Icon name="search" size={18} color={t.colors.textMuted} />
          <Text variant="bodySmall" color="textMuted" numberOfLines={1}>Buscar en {brand.name}</Text>
        </ScalePressable>
      </Animated.View>
    </>
  );
}

function openCollection(block: CollectionBlock) {
  router.push({ pathname: '/catalog', params: { collection: block.slug, title: block.title } });
}

/** Collections choose their own presentation, so the page has rhythm instead of a stack of identical rails. */
function Collection({ block }: { block: CollectionBlock }) {
  const grid = useGridColumns();
  const slot = `collection:${block.slug}`;
  const ids = block.products.map((p) => p.id);
  if (block.layout === 'feature') {
    return (
      <TrackedSection slot={slot} ids={ids} visible={2} testID={`collection-${block.slug}`}>
        <FeatureBand block={block} slot={slot} />
      </TrackedSection>
    );
  }
  if (block.layout === 'grid' && block.products.length >= grid.columns) {
    // whole rows only: a lone card at the end reads as a mistake
    const n = Math.min(block.products.length, grid.columns * 2);
    const shown = block.products.slice(0, n - (n % grid.columns));
    return (
      <TrackedSection slot={slot} ids={shown.map((p) => p.id)} visible={shown.length} testID={`collection-${block.slug}`}>
        <View style={{ marginTop: 40 }}>
          <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" onAction={() => openCollection(block)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grid.gap, rowGap: 24, paddingHorizontal: 16 }}>
            {shown.map((p) => <ProductCard key={p.id} product={p} width={grid.cardWidth} slot={slot} />)}
          </View>
        </View>
      </TrackedSection>
    );
  }
  return (
    <TrackedSection slot={slot} ids={ids} visible={2} testID={`collection-${block.slug}`}>
      <View style={{ marginTop: 40 }}>
        <SectionHeader overline={block.subtitle ?? undefined} title={block.title} action="Ver todo" onAction={() => openCollection(block)} />
        <ProductRail products={block.products} slot={slot} />
      </View>
    </TrackedSection>
  );
}

/** Edge-to-edge band in the collection's tone: an editorial moment, not a card inside a card. */
function FeatureBand({ block, slot }: { block: CollectionBlock; slot: string }) {
  const t = useTheme();
  const tone = t.tone(block.tone);
  const dark = t.scheme === 'dark';
  return (
    <View style={{ marginTop: 36, backgroundColor: dark ? tone.bgDeep : tone.bg, paddingTop: 28, paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 20, gap: 6 }}>
        <Text variant="overline" style={{ color: dark ? t.colors.textSecondary : tone.shadow }}>Colección</Text>
        <Text variant="displayXL" style={{ color: dark ? t.colors.text : tone.dark }}>{block.title}</Text>
        {block.subtitle ? <Text color="textSecondary">{block.subtitle}</Text> : null}
      </View>
      <ProductRail products={block.products} slot={slot} />
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        accessibilityRole="link"
        accessibilityLabel={`Ver la colección ${block.title}`}
        onPress={() => openCollection(block)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: 16, marginTop: 4, height: 40, paddingHorizontal: 16, borderRadius: t.radii.pill, backgroundColor: t.colors.surface }}
      >
        <Text variant="label">Ver la colección</Text>
        <Icon name="arrow-right" size={16} color={t.colors.text} />
      </ScalePressable>
    </View>
  );
}

function TrustStrip() {
  const t = useTheme();
  const items: { icon: IconName; text: string }[] = [
    { icon: 'shield-check', text: 'Pagos verificados antes de despachar' },
    { icon: 'truck', text: 'Cada entrega con seguimiento' },
    { icon: 'banknote', text: 'Precios en USD, pagas en Bs., USD o USDT' },
  ];
  return (
    <View testID="home-trust" style={{ flexDirection: 'row', marginTop: 40, marginHorizontal: 16, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.colors.borderStrong }}>
      {items.map((i, idx) => (
        <View key={i.icon} style={{ flex: 1, gap: 8, paddingHorizontal: 8, borderLeftWidth: idx ? StyleSheet.hairlineWidth : 0, borderColor: t.colors.border }}>
          <Icon name={i.icon} size={20} color={t.colors.brand} />
          <Text variant="caption" color="textSecondary">{i.text}</Text>
        </View>
      ))}
    </View>
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
      <Button title="Explorar con filtros" variant="secondary" icon="sliders-horizontal" onPress={() => router.navigate('/explore')} />
    </View>
  );
}
