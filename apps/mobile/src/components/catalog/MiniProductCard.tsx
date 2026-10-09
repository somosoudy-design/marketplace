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

/** Compact horizontal card for "keep browsing" shelves: thumbnail, title and price on one surface. */
export const MiniProductCard = memo(function MiniProductCard({ product: p, width, slot }: { product: Card; width: number; slot?: string }) {
  const t = useTheme();
  return (
    <ScalePressable
      testID={`mini-card-${p.slug}`}
      scaleTo={0.97}
      accessibilityRole="link"
      accessibilityLabel={`${p.title}, ${formatUSD(p.price_usd)}`}
      onPress={() => {
        if (slot) recordClick(slot, p.id);
        router.push({ pathname: '/product/[id]', params: { id: p.id } });
      }}
      style={{ width, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 8, paddingRight: 12, borderRadius: t.radii.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}
    >
      <ProductImage path={p.image_path} tone={p.tone} alt={p.title} style={{ width: 52 }} aspect={1} radius={t.radii.md} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySmall" numberOfLines={2} style={{ fontFamily: 'Manrope_600SemiBold' }}>{p.title}</Text>
        <Text variant="caption" color="textSecondary" tabular>{formatUSD(p.price_usd)}</Text>
      </View>
    </ScalePressable>
  );
});
