import type { ProductCard as Card } from '@kora/api';
import { formatOfferPrice, variantDisplayTitle } from '@kora/core';
import { router } from 'expo-router';
import { memo } from 'react';
import { Platform, View, type TextStyle } from 'react-native';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { recordClick } from '@/lib/impressions';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { ProductFavorite } from './ProductFavorite';
import { splitCardBrand } from './card-brand';
import { useCardMetadata } from '@/lib/catalog-selection';
import { reviewedEditorialPreview } from '@/lib/editorial-selection';

/** Compact horizontal card for "keep browsing" shelves: thumbnail, title and price on one surface. */
export const MiniProductCard = memo(function MiniProductCard({ product: p, width, slot }: { product: Card; width: number; slot?: string }) {
  const t = useTheme();
  const { name, brand } = splitCardBrand(p.title, p.brand_name);
  const metadata = useCardMetadata(p.id);
  const preview = reviewedEditorialPreview(p, metadata.data);
  const amount = preview.price == null
    ? metadata.isError ? 'Reintentar información' : metadata.isPending ? 'Cargando…' : 'Producto no disponible'
    : `${p.is_demo && !isPrivateCatalogPresentation ? 'Demo · ' : ''}${formatOfferPrice(preview.price)}`;
  const open = () => {
    if (metadata.isError) { void metadata.refetch(); return; }
    if (!preview.variantId) return;
    if (slot) recordClick(slot, p.id);
    router.push({ pathname: '/product/[id]', params: { id: p.id, variant: preview.variantId } });
  };
  return (
    <View style={{ width, padding: 6, borderRadius: 10, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
      <ScalePressable
        testID={`mini-card-${p.slug}`}
        scaleTo={0.97}
        accessibilityRole={metadata.isError ? 'button' : 'link'}
        disabled={metadata.isPending || (!metadata.isError && !preview.variantId)}
        accessibilityLabel={`${p.title}, ${amount}${p.is_demo && !isPrivateCatalogPresentation ? ', producto de demostración' : ''}`}
        onPress={open}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <ProductImage productId={p.id} productIsDemo={false} variantId={preview.variantId} path={preview.imagePath} tone={p.tone} style={{ width: 60 }} aspect={1} radius={6} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ minHeight: 44, justifyContent: 'center', paddingRight: 44 }}>
            <Text testID="mini-title" variant="bodySmall" numberOfLines={1} style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{name}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4, minWidth: 0 }}>
            <Text testID="mini-price" variant="bodySmall" tabular style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, flexShrink: 1, minWidth: 0, maxWidth: '100%', ...(Platform.OS === 'web' ? { overflowWrap: 'anywhere' } as TextStyle : {}) }}>{amount}</Text>
            {preview.multipleVariants && variantDisplayTitle(preview.variantTitle) ? <Text variant="caption" color="textSecondary">{variantDisplayTitle(preview.variantTitle)}</Text> : null}
            {brand ? <Text testID="mini-brand" variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>{brand}</Text> : null}
          </View>
        </View>
      </ScalePressable>
      <View style={{ position: 'absolute', right: 6, top: 6 }}><ProductFavorite id={p.id} slug={p.slug} /></View>
    </View>
  );
});
