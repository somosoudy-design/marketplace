import type { ProductCard as Card } from '@kora/api';
import { formatUSD, presentAvailability, stockHint } from '@kora/core';
import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Price } from '@/components/ui/Price';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { recordClick } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { ProductFavorite } from './ProductFavorite';

interface Props {
  product: Card;
  width: number;
  priority?: 'low' | 'normal' | 'high';
  /** Recommendation slot this card was shown in; opening it counts as a click for that slot. */
  slot?: string;
}

export const ProductCard = memo(function ProductCard({ product: p, width, priority, slot }: Props) {
  const { colors, radii } = useTheme();
  const availability = presentAvailability(p.availability);
  const hint = stockHint(p.stock_total, p.availability);
  const discount = p.compare_at_usd && Number(p.compare_at_usd) > Number(p.price_usd) ? Math.round((1 - Number(p.price_usd) / Number(p.compare_at_usd)) * 100) : 0;
  return (
    <View testID={`product-surface-${p.slug}`} style={{ width, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <ScalePressable
        testID={`product-card-${p.slug}`}
        scaleTo={0.985}
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${formatUSD(p.price_usd)}, ${availability.label}${p.is_demo ? ', producto de demostración' : ''}`}
        onPress={() => {
          if (slot) recordClick(slot, p.id);
          router.push({ pathname: '/product/[id]', params: { id: p.id } });
        }}
      >
        <View>
          <ProductImage path={p.image_path} tone={p.tone} priority={priority} radius={0} />
          {/* Demo prices and stock never masquerade as a real promotion or scarcity claim. */}
          <View style={{ position: 'absolute', left: 8, top: 8, gap: 4 }}>
            {p.is_demo ? <Badge onPhoto label="Demo" /> : <>
              {discount && p.availability === 'available' ? <Badge onPhoto label={`−${discount} %`} tone="danger" /> : null}
              {hint ? <Badge onPhoto label={hint} tone="warning" /> : null}
            </>}
          </View>
        </View>
        <View style={{ padding: 10, gap: 4 }}>
          <Text testID="card-title" variant="bodySmall" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: -0.1 }}>
            {p.title}
          </Text>
          <Price usd={p.price_usd} size="sm" muted={!availability.purchasable} />
        </View>
      </ScalePressable>
      <View style={{ position: 'absolute', right: 6, top: 6 }}>
        <ProductFavorite id={p.id} slug={p.slug} />
      </View>
    </View>
  );
});
