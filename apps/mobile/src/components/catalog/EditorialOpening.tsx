import type { CollectionBlock, ProductCard } from '@kora/api';
import { formatUSD, presentAvailability } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { ProductImage } from './ProductImage';

/** One collection destination, illustrated by one of its actual products. Text grows with accessibility settings. */
export function EditorialOpening({ block, product, width, onOpen }: {
  block: CollectionBlock; product: ProductCard; width: number; onOpen: () => void;
}) {
  const availability = presentAvailability(product.availability);
  const photoWidth = Math.min(120, Math.round((width - 64) * 0.34));
  return (
    <TrackedSection slot={`collection:${block.slug}`} ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        accessibilityRole="link"
        accessibilityLabel={`Colección ${block.title}. Producto mostrado: ${product.title}, ${formatUSD(product.price_usd)}, ${availability.label}${product.is_demo ? ', demostración' : ''}. Ver colección`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 14, minHeight: 180, backgroundColor: palette.violet[900], padding: 16, gap: 10 }}
      >
        <View style={{ gap: 7 }}>
          <Text variant="overline" style={{ color: palette.violet[200] }}>Colección</Text>
          <Text variant="displayM" style={{ color: palette.ink[0], lineHeight: 24 }}>{block.title}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="caption" style={{ color: palette.violet[200] }}>Producto mostrado{product.is_demo ? ' · Demo' : ''}</Text>
            <Text variant="caption" style={{ color: palette.ink[0] }}>{product.title.replace(/\s+W\b/g, '\u00a0W')}</Text>
            <Text testID="home-editorial-price" variant="price" tabular style={{ color: palette.ink[0] }}>{formatUSD(product.price_usd)}</Text>
            {product.availability !== 'available' ? <Badge label={availability.label} tone={availability.purchasable ? 'brand' : 'muted'} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 7 }}>
              <Text variant="label" style={{ color: palette.ink[0] }}>Ver colección</Text>
              <Icon name="arrow-right" size={16} color={palette.ink[0]} />
            </View>
          </View>
          <ProductImage aspect={1} fit="contain" path={product.image_path} tone={product.tone} radius={8} priority="high" style={{ width: photoWidth }} />
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}
