import type { ProductCard } from '@kora/api';
import { formatUSD } from '@kora/core';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { TrackedSection } from '@/lib/impressions';
import { useCardMetadata } from '@/lib/catalog-selection';
import { reviewedEditorialPreview } from '@/lib/editorial-selection';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { EditorialHeroSurface } from './EditorialHeroSurface';

/** Editorial product opening: the product is the real destination, not a synthetic promotion. */
export function ProductEditorialOpening({ product, width, onOpen }: { product: ProductCard; width: number; onOpen: (variantId: string) => void }) {
  const t = useTheme();
  const metadata = useCardMetadata(product.id);
  const preview = reviewedEditorialPreview(product, metadata.data);
  const availability = preview.availability;
  const priceLabel = preview.price == null ? metadata.isError ? 'Información no disponible' : metadata.isPending ? 'Cargando…' : 'Producto no disponible' : formatUSD(preview.price);
  return (
    <TrackedSection slot="home_editorial_product" ids={[product.id]} visible={1} testID="home-hero">
      <ScalePressable
        testID="home-product-opening"
        accessibilityRole={metadata.isError ? 'button' : 'link'}
        disabled={metadata.isPending || (!metadata.isError && !preview.variantId)}
        accessibilityLabel={`${product.title}, ${priceLabel}, ${availability.label}. ${metadata.isError ? 'Reintentar' : 'Ver producto'}`}
        onPress={() => { if (metadata.isError) { void metadata.refetch(); } else if (preview.variantId) onOpen(preview.variantId); }}
        scaleTo={0.99}
        style={{ paddingHorizontal: 12, paddingTop: 12 }}
      >
        <EditorialHeroSurface width={width} generalImage={preview.generalImage} renderPhoto={photoWidth=><ProductImage productId={product.id} productIsDemo={false} variantId={preview.variantId} path={preview.imagePath} tone={product.tone} alt={product.title} fit="contain" aspect={1} radius={12} priority="high" style={{ width: photoWidth }} />}>
            <Text variant="overline" color="editorial">Descubre Mayami</Text>
            <Text testID="home-editorial-name" variant="subtitle" style={{fontFamily:'PlusJakartaSans_700Bold'}}>{product.title}</Text>
            {preview.multipleVariants && preview.variantTitle ? <Text testID="home-editorial-variant" variant="caption" color="textSecondary">{preview.variantTitle}</Text> : null}
            <Text testID="home-editorial-price" variant="price" tabular style={{fontSize:24,lineHeight:30}}>{priceLabel}</Text>
            {preview.variantId && availability.label !== 'Disponible' ? <Text variant="caption" color="textSecondary">{availability.label}</Text> : null}
            <View style={{ minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: t.colors.brand }}>
              <Text variant="label" style={{ color: t.colors.onBrand, flexShrink: 1 }}>{metadata.isError ? 'Reintentar' : 'Ver producto'}</Text><Icon name="arrow-right" size={16} color={t.colors.onBrand} />
            </View>
        </EditorialHeroSurface>
      </ScalePressable>
    </TrackedSection>
  );
}
