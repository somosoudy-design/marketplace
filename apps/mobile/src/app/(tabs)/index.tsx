import type { CollectionBlock } from '@kora/api';
import { formatRate } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryTiles } from '@/components/catalog/CategoryTiles';
import { MAX_CONTENT, ProductCard, ProductRail, useGridColumns } from '@/components/catalog/ProductGrid';
import { StoreCard } from '@/components/catalog/StoreCard';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { ProductCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { SOURCE_LABEL, timeAgo } from '@/lib/format';
import { useHome, useUnreadCount } from '@/lib/hooks';
import { qk } from '@/lib/query';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { brand } from '@/lib/brand';

export default function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const home = useHome();
  const rate = useQuery({ queryKey: qk.rate, queryFn: () => api.catalog.rate('USD/VES'), staleTime: 5 * 60_000 });
  const unread = useUnreadCount();
  const grid = useGridColumns();
  const data = home.data;
  const [feature, ...rails] = data?.collections ?? [];
  const contentWidth = Math.min(width, MAX_CONTENT);

  return (
    <ScrollView
      testID="home-scroll"
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => { home.refetch(); rate.refetch(); }} tintColor={t.colors.brand} />}
    >
      {/* masthead */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text variant="displayL" style={{ fontSize: 30, color: t.colors.brand }} accessibilityRole="header">{brand.name}</Text>
          <Text variant="caption" color="textMuted">{brand.tagline}</Text>
        </View>
        <View>
          <IconButton icon="bell" label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} tone="surface" onPress={() => router.push(user ? '/notifications' : '/sign-in')} />
          {unread ? <View style={{ position: 'absolute', right: 8, top: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.danger, borderWidth: 1.5, borderColor: t.colors.surface }} /> : null}
        </View>
      </View>

      {/* search entry */}
      <ScalePressable
        testID="home-search"
        scaleTo={0.99}
        accessibilityRole="search"
        accessibilityLabel="Buscar productos, marcas o tiendas"
        onPress={() => router.navigate({ pathname: '/explore', params: { focus: String(Date.now()) } })}
        style={{ marginHorizontal: 16, height: 50, borderRadius: t.radii.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 }}
      >
        <Icon name="search" size={20} color={t.colors.textMuted} />
        <Text color="textMuted">Buscar productos, marcas o tiendas</Text>
      </ScalePressable>

      {/* rate transparency */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginTop: 10, marginBottom: 22 }}>
        <Icon name="landmark" size={14} color={t.colors.textMuted} />
        <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flex: 1 }} testID="home-rate">
          {rate.data?.available
            ? `Precios en USD · Tasa ${formatRate(rate.data.rate)} · ${SOURCE_LABEL[rate.data.source] ?? rate.data.source} · ${timeAgo(rate.data.observed_at)}`
            : rate.data
              ? 'Precios en USD · Tasa del día no disponible: puedes pagar en USD o USDT'
              : 'Precios en USD'}
        </Text>
      </View>

      {home.isError ? <ErrorState onRetry={() => home.refetch()} /> : null}

      {/* categories */}
      {data ? <CategoryTiles categories={data.categories} /> : (
        <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={64} height={64} radius={22} />)}
        </View>
      )}

      {/* featured collection */}
      {feature ? <FeatureCollection block={feature} /> : home.isLoading ? <View style={{ padding: 16 }}><Skeleton height={360} radius={t.radii.xl} /></View> : null}

      {/* rails */}
      {rails.slice(0, 2).map((c) => <CollectionRail key={c.id} block={c} />)}

      {/* stores */}
      {data?.stores.length ? (
        <View style={{ marginTop: 34 }}>
          <SectionHeader overline="Tiendas" title="Quién vende aquí" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {data.stores.map((s) => <StoreCard key={s.id} store={s} width={Math.min(260, contentWidth * 0.68)} />)}
          </ScrollView>
        </View>
      ) : null}

      {rails.slice(2).map((c) => <CollectionRail key={c.id} block={c} />)}

      {/* recently viewed */}
      {data?.recently_viewed.length ? (
        <View style={{ marginTop: 34 }}>
          <SectionHeader overline="Seguir viendo" title="Vistos recientemente" />
          <ProductRail products={data.recently_viewed} />
        </View>
      ) : null}

      {/* recommendations */}
      <View style={{ marginTop: 34 }}>
        <SectionHeader overline={data?.personalized ? 'Para ti' : 'Populares'} title={data?.personalized ? 'Elegidos según tus gustos' : 'Lo más elegido esta semana'} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grid.gap, paddingHorizontal: 16, rowGap: 22 }}>
          {data
            ? data.recommended.map((p) => <ProductCard key={p.id} product={p} width={grid.cardWidth} />)
            : [0, 1, 2, 3].map((i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}
        </View>
      </View>

      <TrustRow />
    </ScrollView>
  );
}

function FeatureCollection({ block }: { block: CollectionBlock }) {
  const t = useTheme();
  const tone = t.tone(block.tone);
  return (
    <View style={{ marginTop: 28, marginHorizontal: 12, borderRadius: t.radii.xl, backgroundColor: tone.bg, paddingTop: 24, paddingBottom: 20 }} testID={`collection-${block.slug}`}>
      <View style={{ paddingHorizontal: 20, marginBottom: 18, gap: 6 }}>
        <Text variant="overline" style={{ color: t.scheme === 'dark' ? t.colors.textSecondary : tone.shadow }}>COLECCIÓN</Text>
        <Text variant="displayXL" style={{ color: t.scheme === 'dark' ? t.colors.text : tone.dark }}>{block.title}</Text>
        {block.subtitle ? <Text color="textSecondary">{block.subtitle}</Text> : null}
        <ScalePressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/catalog', params: { collection: block.slug, title: block.title } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' }}
        >
          <Text variant="label" color="brand">Ver colección</Text>
          <Icon name="arrow-right" size={16} color={t.colors.brand} />
        </ScalePressable>
      </View>
      <ProductRail products={block.products} />
    </View>
  );
}

function CollectionRail({ block }: { block: CollectionBlock }) {
  if (!block.products.length) return null;
  return (
    <View style={{ marginTop: 34 }} testID={`collection-${block.slug}`}>
      <SectionHeader
        overline={block.subtitle ?? undefined}
        title={block.title}
        action="Ver todo"
        onAction={() => router.push({ pathname: '/catalog', params: { collection: block.slug, title: block.title } })}
      />
      <ProductRail products={block.products} />
    </View>
  );
}

function TrustRow() {
  const { colors, radii } = useTheme();
  const items = [
    { icon: 'shield-check' as const, title: 'Pagos verificados', body: 'Confirmamos cada pago antes de despachar.' },
    { icon: 'truck' as const, title: 'Entrega con seguimiento', body: 'Cada paquete con su estado y fecha estimada.' },
    { icon: 'banknote' as const, title: 'Precio en USD', body: 'Pagas en bolívares a la tasa del momento del pago.' },
  ];
  return (
    <View style={{ marginTop: 40, marginHorizontal: 16, padding: 18, gap: 16, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      {items.map((i) => (
        <View key={i.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={i.icon} size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{i.title}</Text>
            <Text variant="caption" color="textMuted">{i.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
