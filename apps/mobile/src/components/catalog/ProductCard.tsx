import type { ProductCard as Card } from '@kora/api';
import { formatUSD, presentAvailability, stockHint } from '@kora/core';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Platform, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Price } from '@/components/ui/Price';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { recordClick } from '@/lib/impressions';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { ProductFavorite } from './ProductFavorite';
import { splitCardBrand } from './card-brand';

interface Props {
  product: Card;
  width: number;
  priority?: 'low' | 'normal' | 'high';
  /** Recommendation slot this card was shown in; opening it counts as a click for that slot. */
  slot?: string;
}

export const ProductCard = memo(function ProductCard({ product: p, width, priority, slot }: Props) {
  const { colors } = useTheme();
  const availability = presentAvailability(p.availability);
  const hint = stockHint(p.stock_total, p.availability);
  const discount = p.compare_at_usd && Number(p.compare_at_usd) > Number(p.price_usd) ? Math.round((1 - Number(p.price_usd) / Number(p.compare_at_usd)) * 100) : 0;
  const { name, brand } = splitCardBrand(p.title, p.brand_name);
  const [focusVisible, setFocusVisible] = useState(false);
  return (
    <View testID={`product-surface-${p.slug}`} style={{ width, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <ScalePressable
        testID={`product-card-${p.slug}`}
        scaleTo={0.985}
        focusOutline={false}
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${formatUSD(p.price_usd)}, ${availability.label}${p.is_demo && !isPrivateCatalogPresentation ? ', producto de demostración' : ''}`}
        onFocus={(event) => {
          if (Platform.OS === 'web') {
            const target = event.target as unknown as { matches?: (selector: string) => boolean };
            setFocusVisible(target.matches?.(':focus-visible') ?? false);
          }
        }}
        onBlur={() => setFocusVisible(false)}
        onPress={() => {
          if (slot) recordClick(slot, p.id);
          router.push({ pathname: '/product/[id]', params: { id: p.id } });
        }}
      >
        <View>
          <ProductImage productId={p.id} productIsDemo={p.is_demo} path={p.image_path} tone={p.tone} priority={priority} radius={0} />
          {/* Demo prices and stock never masquerade as a real promotion or scarcity claim. */}
          <View style={{ position: 'absolute', left: 8, top: 8, gap: 4, maxWidth: width - 58 }}>
            {p.is_demo ? (!isPrivateCatalogPresentation ? <Badge onPhoto label="Demo" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null) : <>
              {discount && p.availability === 'available' ? <Badge onPhoto label={`−${discount} %`} tone="danger" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
              {hint ? <Badge onPhoto label={hint} tone="warning" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
            </>}
          </View>
          {p.availability !== 'available' ? <Badge onPhoto label={availability.label} tone={!availability.purchasable ? 'muted' : 'brand'} style={{ position: 'absolute', bottom: 8, left: 8, maxWidth: width - 18, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
        </View>
        <View style={{ padding: 10, gap: 4 }}>
          <Text testID="card-title" variant="bodySmall" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: -0.1 }}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, rowGap: 2 }}>
            <Price usd={p.price_usd} muted={!availability.purchasable} />
            {brand ? <Text testID="card-brand" variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>{brand}</Text> : null}
          </View>
        </View>
      </ScalePressable>
      <View style={{ position: 'absolute', right: 0, top: 0 }}>
        <ProductFavorite id={p.id} slug={p.slug} onPhoto />
      </View>
      {focusVisible ? (
        <View testID="card-focus-ring" pointerEvents="none" accessible={false} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <View testID="card-focus-backing" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 4, borderColor: colors.surface, borderRadius: 10 }} />
          <View testID="card-focus-color" style={{ position: 'absolute', top: 1, bottom: 1, left: 1, right: 1, borderWidth: 2, borderColor: colors.brand, borderRadius: 9 }} />
        </View>
      ) : null}
    </View>
  );
});
