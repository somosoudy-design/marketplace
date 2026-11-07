import type { CollectionBlock, ProductCard } from '@kora/api';
import { formatUSD } from '@kora/core';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { useCardMetadata } from '@/lib/catalog-selection';
import { reviewedEditorialPreview } from '@/lib/editorial-selection';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { EditorialHeroSurface } from './EditorialHeroSurface';

/** The editorial image opens its existing collection; it does not imply a promotion. */
export function EditorialOpening({ block, product, width, onOpen }: {
  block: CollectionBlock; product: ProductCard; width: number; onOpen: () => void;
}) {
  const t = useTheme();
  const metadata = useCardMetadata(product.id);
  const preview = reviewedEditorialPreview(product, metadata.data);
  const availability = preview.availability;
  const priceLabel = preview.price == null ? metadata.isError ? 'Información no disponible' : metadata.isPending ? 'Cargando…' : 'Producto no disponible' : formatUSD(preview.price);
  return (
    <TrackedSection slot={`collection:${block.slug}`} ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID={`collection-${block.slug}-all`}
        accessibilityRole="link"
        accessibilityLabel={`Colección ${block.title}. Producto mostrado: ${product.title}, ${priceLabel}, ${availability.label}${product.is_demo && !isPrivateCatalogPresentation ? ', demostración' : ''}. Ver colección`}
        onPress={onOpen}
        scaleTo={0.99}
        style={{ paddingHorizontal: 12, paddingTop: 12 }}
      >
        <EditorialHeroSurface width={width} generalImage={preview.generalImage} renderPhoto={photoWidth=><ProductImage productId={product.id} productIsDemo={false} variantId={preview.variantId} aspect={1} fit="contain" path={preview.imagePath} tone={product.tone} radius={12} priority="high" style={{ width: photoWidth }} />}>
            <Text variant="overline" color="editorial">Colección Mayami</Text>
            <Text variant="subtitle">{block.title}</Text>
            <Text testID="home-editorial-name" variant="caption" color="textSecondary">{product.title}{product.is_demo && !isPrivateCatalogPresentation ? ' · Demo' : ''}</Text>
            {preview.multipleVariants && preview.variantTitle ? <Text testID="home-editorial-variant" variant="caption" color="textSecondary">{preview.variantTitle}</Text> : null}
            <Text testID="home-editorial-price" variant="price" tabular style={{fontSize:24,lineHeight:30}}>{priceLabel}</Text>
            {preview.variantId && availability.label !== 'Disponible' ? <Text variant="caption" color="textSecondary">{availability.label}</Text> : null}
            <View style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: t.colors.brand }}>
              <Text variant="label" style={{ color: t.colors.onBrand, flexShrink: 1 }}>Ver colección</Text><Icon name="arrow-right" size={16} color={t.colors.onBrand} />
            </View>
        </EditorialHeroSurface>
      </ScalePressable>
    </TrackedSection>
  );
}
