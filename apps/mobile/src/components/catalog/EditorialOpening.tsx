import type { CollectionBlock, ProductCard } from '@kora/api';
import { formatUSD, presentAvailability } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { View, useWindowDimensions } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { ProductImage } from './ProductImage';

/** Continuous editorial surface below the masthead; one collection destination, never a product purchase. */
export function EditorialOpening({ block, product, width, onOpen }: {
  block: CollectionBlock; product: ProductCard; width: number; onOpen: () => void;
}) {
  const availability = presentAvailability(product.availability);
  const { fontScale } = useWindowDimensions();
  const expandedText = fontScale > 1.3;
  const photoWidth = Math.min(124, Math.round((width - 32) * 0.32));
  const caption = (
    <View style={{ gap: 3 }}>
      <Text variant="caption" style={{ color: palette.violet[200] }}>Producto mostrado{product.is_demo && !isPrivateCatalogPresentation ? ' · Demo' : ''}</Text>
      <Text testID="home-editorial-name" variant="bodySmall" style={{ color: palette.ink[0] }}>{product.title.replace(/\s+W\b/g, '\u00a0W')}</Text>
    </View>
  );
  return (
    <TrackedSection slot={`collection:${block.slug}`} ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        accessibilityRole="link"
        accessibilityLabel={`Colección ${block.title}. Producto mostrado: ${product.title}, ${formatUSD(product.price_usd)}, ${availability.label}${product.is_demo && !isPrivateCatalogPresentation ? ', demostración' : ''}. Ver colección`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ backgroundColor: palette.violet[900], paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 }}
      >
        <View style={{ gap: 4 }}>
          <Text variant="overline" style={{ color: palette.violet[200] }}>Colección</Text>
          <Text variant="displayM" style={{ color: palette.ink[0], fontSize: 21, lineHeight: 26 }}>{block.title}</Text>
        </View>
        {expandedText ? caption : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            {!expandedText ? caption : null}
            <Text testID="home-editorial-price" variant="price" tabular style={{ color: palette.ink[0] }}>{formatUSD(product.price_usd)}</Text>
            {product.availability !== 'available' ? <Badge label={availability.label} tone={availability.purchasable ? 'brand' : 'muted'} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 7 }}>
              <Text variant="label" style={{ color: palette.ink[0] }}>Ver colección</Text>
              <Icon name="arrow-right" size={16} color={palette.ink[0]} />
            </View>
          </View>
          <ProductImage productId={product.id} productIsDemo={product.is_demo} aspect={1} fit="contain" path={product.image_path} tone={product.tone} radius={8} priority="high" style={{ width: photoWidth }} />
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}
