import type { StoreSummary } from '@kora/api';
import { storeAccents } from '@kora/design-tokens';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { RatingInline } from '@/components/reviews/Reviews';
import { STORE_TIERS, StoreBadge, storeTier } from './StoreBadge';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { brand } from '@/lib/brand';
import { storeImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

const storeLabel = (store: StoreSummary) => {
  const tier = storeTier(store);
  return `Tienda ${store.name}${tier ? `, ${STORE_TIERS[tier].label.toLowerCase()}` : ''}`;
};

export function StoreCard({ store, width }: { store: StoreSummary; width: number }) {
  const t = useTheme();
  const accent = storeAccents[store.accent as keyof typeof storeAccents] ?? t.colors.brand;
  return (
    <ScalePressable
      testID={`store-${store.slug}`}
      accessibilityRole="link"
      accessibilityLabel={storeLabel(store)}
      onPress={() => router.push({ pathname: '/store/[slug]', params: { slug: store.slug } })}
      style={{ width, backgroundColor: t.colors.surface, borderRadius: t.radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border }}
    >
      <View style={{ aspectRatio: 16 / 9, backgroundColor: accent }}>
        {store.cover_path ? <Image source={{ uri: storeImage(store.cover_path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ padding: 12, paddingTop: 30, gap: 4 }}>
        <View style={{ position: 'absolute', top: -26, left: 12, width: 52, height: 52, borderRadius: 16, backgroundColor: t.colors.surface, padding: 3, ...t.elevation.low }}>
          {store.logo_path ? (
            <Image source={{ uri: storeImage(store.logo_path) ?? undefined }} style={{ flex: 1, borderRadius: 13 }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, borderRadius: 13, backgroundColor: accent }} />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>{store.name}</Text>
          <StoreBadge tier={storeTier(store)} />
        </View>
        <Text variant="caption" color="textMuted" numberOfLines={1}>{store.tagline ?? ' '}</Text>
        {/* fixed-height line so cards in a rail align whether or not the store has reviews yet */}
        <View style={{ height: 20, justifyContent: 'center' }}>
          {store.rating_count ? <RatingInline avg={store.rating_avg ?? null} count={store.rating_count} /> : <Text variant="caption" color="textMuted">Aún sin opiniones</Text>}
        </View>
      </View>
    </ScalePressable>
  );
}

/**
 * Compact store entry for shelves: logo, name, what it sells and its rating, without a cover photo. With `overline`
 * (the product page's "Vendido por") it fills its row and the tagline line is left out when there is none.
 */
export function StoreChip({ store, width, overline }: { store: StoreSummary; width?: number; overline?: string }) {
  const t = useTheme();
  const accent = storeAccents[store.accent as keyof typeof storeAccents] ?? t.colors.brand;
  return (
    <ScalePressable
      testID={`store-${store.slug}`}
      scaleTo={0.97}
      accessibilityRole="link"
      accessibilityLabel={storeLabel(store)}
      onPress={() => router.push({ pathname: '/store/[slug]', params: { slug: store.slug } })}
      style={{ width, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 12, backgroundColor: t.colors.surface, borderRadius: t.radii.lg, borderWidth: 1, borderColor: t.colors.border }}
    >
      <View style={{ width: 52, height: 52, borderRadius: t.radii.md, overflow: 'hidden', backgroundColor: accent }}>
        {store.logo_path ? <Image source={{ uri: storeImage(store.logo_path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? <Text variant="caption" color="textMuted">{overline}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>{store.name}</Text>
          <StoreBadge tier={storeTier(store)} />
        </View>
        {store.tagline || !overline ? <Text variant="caption" color="textMuted" numberOfLines={1}>{store.tagline ?? ' '}</Text> : null}
        <View style={{ height: 18, justifyContent: 'center' }}>
          {store.rating_count ? <RatingInline avg={store.rating_avg ?? null} count={store.rating_count} /> : <Text variant="caption" color="textMuted">{overline ? 'Aún sin opiniones' : `Nueva en ${brand.name}`}</Text>}
        </View>
      </View>
      {overline ? <Icon name="chevron-right" size={18} color={t.colors.textMuted} /> : null}
    </ScalePressable>
  );
}
