import type { ProductCard } from '@kora/api';
import { formatUSD, presentAvailability } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { ProductImage } from './ProductImage';

/** Same continuous C surface, with a product destination rather than a fabricated collection. */
export function ProductEditorialOpening({ product, width, onOpen }: { product: ProductCard; width: number; onOpen: () => void }) {
  const availability = presentAvailability(product.availability);
  const photoWidth = Math.min(112, Math.round((width - 32) * 0.34));
  return (
    <TrackedSection slot="home_editorial_product" ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID="home-product-opening"
        accessibilityRole="link"
        accessibilityLabel={`${product.title}, ${formatUSD(product.price_usd)}, ${availability.label}. Ver producto`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ backgroundColor: palette.violet[900], paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, gap: 8 }}
      >
        <View style={{ gap: 4 }}>
          <Text variant="overline" style={{ color: palette.violet[200] }}>Del catálogo</Text>
          <Text testID="home-editorial-name" variant="title" style={{ color: palette.ink[0], fontSize: 18, lineHeight: 23 }}>{product.title}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text testID="home-editorial-price" variant="price" tabular style={{ color: palette.ink[0] }}>{formatUSD(product.price_usd)}</Text>
            <Text variant="caption" style={{ color: palette.violet[200] }}>{availability.label}</Text>
            <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text variant="label" style={{ color: palette.ink[0], flexShrink: 1 }}>Ver producto</Text>
              <Icon name="arrow-right" size={16} color={palette.ink[0]} />
            </View>
          </View>
          <ProductImage productId={product.id} path={product.image_path} alt={product.title} fit="contain" aspect={1} radius={8} priority="high" style={{ width: photoWidth, backgroundColor: palette.ink[0] }} />
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}
