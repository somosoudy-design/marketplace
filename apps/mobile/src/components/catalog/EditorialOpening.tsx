import type { CollectionBlock, ProductCard } from '@kora/api';
import { formatUSD, presentAvailability } from '@kora/core';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';

/** The editorial image opens its existing collection; it does not imply a promotion. */
export function EditorialOpening({ block, product, width, onOpen }: {
  block: CollectionBlock; product: ProductCard; width: number; onOpen: () => void;
}) {
  const t = useTheme();
  const availability = presentAvailability(product.availability);
  const photoWidth = Math.min(150, Math.max(96, Math.floor((width - 56) * 0.4)));
  return (
    <TrackedSection slot={`collection:${block.slug}`} ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        accessibilityRole="link"
        accessibilityLabel={`Colección ${block.title}. Producto mostrado: ${product.title}, ${formatUSD(product.price_usd)}, ${availability.label}${product.is_demo && !isPrivateCatalogPresentation ? ', demostración' : ''}. Ver colección`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ backgroundColor: t.colors.background, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}
      >
        <View style={{ backgroundColor: t.scheme === 'dark' ? t.colors.surface : t.colors.editorialSoft, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ProductImage productId={product.id} productIsDemo={product.is_demo} aspect={1} fit="contain" path={product.image_path} tone={product.tone} radius={10} priority="high" style={{ width: photoWidth }} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text variant="overline" color="editorial">Colección Mayami</Text>
            <Text variant="subtitle">{block.title}</Text>
            <Text testID="home-editorial-name" variant="caption" color="textSecondary">{product.title}{product.is_demo && !isPrivateCatalogPresentation ? ' · Demo' : ''}</Text>
            <Text testID="home-editorial-price" variant="price" tabular>{formatUSD(product.price_usd)}</Text>
            {product.availability !== 'available' ? <Text variant="caption" color="textSecondary">{availability.label}</Text> : null}
            <View style={{ minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: t.colors.brand }}>
              <Text variant="label" style={{ color: t.colors.onBrand, flexShrink: 1 }}>Ver colección</Text><Icon name="arrow-right" size={16} color={t.colors.onBrand} />
            </View>
          </View>
        </View>
      </ScalePressable>
    </TrackedSection>
  );
}
