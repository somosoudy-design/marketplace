import type { ProductCard as Card } from '@kora/api';
import { formatUSD } from '@kora/core';
import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { recordClick } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { ProductFavorite } from './ProductFavorite';

/** Compact horizontal card for "keep browsing" shelves: thumbnail, title and price on one surface. */
export const MiniProductCard = memo(function MiniProductCard({ product: p, width, slot }: { product: Card; width: number; slot?: string }) {
  const t = useTheme();
  return (
    <View style={{ width, flexDirection: 'row', alignItems: 'center', padding: 6, gap: 2, borderRadius: t.radii.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
      <ScalePressable
        testID={`mini-card-${p.slug}`}
        scaleTo={0.97}
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${formatUSD(p.price_usd)}${p.is_demo ? ', producto de demostración' : ''}`}
        onPress={() => {
          if (slot) recordClick(slot, p.id);
          router.push({ pathname: '/product/[id]', params: { id: p.id } });
        }}
        style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center', minWidth: 0 }}
      >
        <ProductImage path={p.image_path} tone={p.tone} style={{ width: 52 }} aspect={1} radius={t.radii.md} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodySmall" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{p.title}</Text>
          <Text variant="caption" color="textSecondary" tabular>{p.is_demo ? 'Demo · ' : ''}{formatUSD(p.price_usd)}</Text>
        </View>
      </ScalePressable>
      <ProductFavorite id={p.id} slug={p.slug} />
    </View>
  );
});
