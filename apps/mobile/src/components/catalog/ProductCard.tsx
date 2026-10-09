import type { ProductCard as Card } from '@kora/api';
import { describeLeadTimeShort, presentAvailability, stockHint } from '@kora/core';
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
  showStore?: boolean;
  priority?: 'low' | 'normal' | 'high';
  /** Recommendation slot this card was shown in; opening it counts as a click for that slot. */
  slot?: string;
}

export const ProductCard = memo(function ProductCard({ product: p, width, showStore = true, priority, slot }: Props) {
  const { colors, radii } = useTheme();
  const { user } = useAuth();
  const fav = useFavorites();
  const availability = presentAvailability(p.availability);
  const lead = describeLeadTimeShort(p.lead_min_days, p.lead_max_days, p.availability);
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
        {discount && p.availability === 'available' ? (
          <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.xs, backgroundColor: colors.accent }}>
            <Text variant="caption" style={{ color: colors.onAccent, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>-{discount}%</Text>
          </View>
        ) : null}
        {p.availability !== 'available' ? (
          <View style={{ position: 'absolute', left: 8, top: 8 }}>
            <Badge label={availability.label} tone={availability.tone} solid={p.availability === 'sold_out' || p.availability === 'unavailable'} />
          </View>
        ) : null}
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
      <View style={{ paddingTop: 9, paddingHorizontal: 2, gap: 3 }}>
        {showStore ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {p.brand_name && !p.title.toLowerCase().startsWith(p.brand_name.toLowerCase()) ? `${p.brand_name} · ` : ''}{p.store_name}
          </Text>
        ) : null}
        <Text variant="bodySmall" numberOfLines={2} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', minHeight: 36, letterSpacing: -0.1 }}>
          {p.title}
        </Text>
        <Price usd={p.price_usd} compareAt={p.compare_at_usd} size="sm" muted={!availability.purchasable} />
        {hint ? <Text variant="caption" color="warning">{hint}</Text> : lead ? <Text variant="caption" color="textMuted" numberOfLines={1}>{lead}</Text> : null}
      </View>
    </ScalePressable>
  );
});
