import type { ProductCard } from '@kora/api';
import { formatUSD, presentAvailability } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';

/** Editorial product opening: the product is the real destination, not a synthetic promotion. */
export function ProductEditorialOpening({ product, width, onOpen }: { product: ProductCard; width: number; onOpen: () => void }) {
  const t = useTheme();
  const availability = presentAvailability(product.availability);
  const photoWidth = Math.min(150, Math.max(96, Math.floor((width - 56) * 0.4)));
  return (
    <TrackedSection slot="home_editorial_product" ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID="home-product-opening"
        accessibilityRole="link"
        accessibilityLabel={`${product.title}, ${formatUSD(product.price_usd)}, ${availability.label}. Ver producto`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ backgroundColor: palette.violet[600], paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}
      >
        <View style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ProductImage productId={product.id} productIsDemo={product.is_demo} path={product.image_path} tone={product.tone} alt={product.title} fit="contain" aspect={1} radius={10} priority="high" style={{ width: photoWidth }} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text variant="caption" color="textSecondary">Del catálogo</Text>
            <Text testID="home-editorial-name" variant="subtitle" numberOfLines={3}>{product.title}</Text>
            <Text testID="home-editorial-price" variant="price" tabular>{formatUSD(product.price_usd)}</Text>
            {product.availability !== 'available' ? <Text variant="caption" color="textSecondary">{availability.label}</Text> : null}
            <View style={{ minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: t.colors.text }}>
              <Text variant="label" style={{ color: t.colors.surface, flexShrink: 1 }}>Ver producto</Text><Icon name="arrow-right" size={16} color={t.colors.surface} />
            </View>
          </View>
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}
