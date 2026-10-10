import type { ProductCard as Card } from '@kora/api';
import { presentAvailability, stockHint } from '@kora/core';
import { router } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Price } from '@/components/ui/Price';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/hooks';
import { recordClick } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';

interface Props {
  product: Card;
  width: number;
  priority?: 'low' | 'normal' | 'high';
  /** Recommendation slot this card was shown in; opening it counts as a click for that slot. */
  slot?: string;
}

export const ProductCard = memo(function ProductCard({ product: p, width, priority, slot }: Props) {
  const { colors, radii } = useTheme();
  const { user } = useAuth();
  const fav = useFavorites();
  const availability = presentAvailability(p.availability);
  const hint = stockHint(p.stock_total, p.availability);
  const isFav = fav.isFavorite(p.id);
  const discount = p.compare_at_usd && Number(p.compare_at_usd) > Number(p.price_usd) ? Math.round((1 - Number(p.price_usd) / Number(p.compare_at_usd)) * 100) : 0;
  return (
    <ScalePressable
      testID={`product-card-${p.slug}`}
      scaleTo={0.98}
      accessibilityRole="link"
      accessibilityLabel={`${p.title}, ${availability.label}`}
      onPress={() => {
        if (slot) recordClick(slot, p.id);
        router.push({ pathname: '/product/[id]', params: { id: p.id } });
      }}
      style={{ width }}
    >
      <View>
        <ProductImage path={p.image_path} tone={p.tone} alt={p.title} priority={priority} radius={radii.lg} />
        {/* only the labels that apply, kept small on the photo; availability, delivery and the store are on the product page */}
        {/* top left, so the "imagen demo" mark at the bottom of demo photos stays visible */}
        <View style={{ position: 'absolute', left: 8, top: 8, gap: 4 }}>
          {discount && p.availability === 'available' ? <Badge onPhoto label={`−${discount} %`} tone="danger" /> : null}
          {hint ? <Badge onPhoto label={hint} tone="warning" /> : null}
        </View>
        <IconButton
          icon="heart"
          label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          size={32}
          tone="glass"
          color={isFav ? colors.danger : colors.text}
          filled={isFav}
          style={{ position: 'absolute', right: 8, top: 8 }}
          onPress={() => (user ? fav.toggle({ productId: p.id, on: !isFav }) : router.push('/sign-in'))}
        />
      </View>
      <View style={{ paddingTop: 8, paddingHorizontal: 2, gap: 2 }}>
        <Text variant="bodySmall" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: -0.1 }}>
          {p.title}
        </Text>
        <Price usd={p.price_usd} size="sm" muted={!availability.purchasable} />
      </View>
    </ScalePressable>
  );
});
