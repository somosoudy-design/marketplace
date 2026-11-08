import type { ProductCard as Card } from '@kora/api';
import { formatUSD, photoChoiceNotice, presentAvailability, stockHint, productConditionLabel, productColorSummaries, resolveProductSelection } from '@kora/core';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Price } from '@/components/ui/Price';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { recordClick } from '@/lib/impressions';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import { useCardMetadata } from '@/lib/catalog-selection';
import { reviewedGeneralProductImages } from '@/lib/selection-media';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { ColorDot } from '@/components/ui/ColorDot';
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
  const { colors: colorsTheme, scheme } = useTheme();
  const metadata = useCardMetadata(p.id);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const variants = metadata.data?.variants.map(v => ({ ...v, id: v.variant_id })) ?? [];
  const selection = resolveProductSelection({ availability: p.availability, max_per_order: 1, variants, images: metadata.data?.variants.flatMap(v => v.images) ?? [], variant_image_links: metadata.data?.variants.flatMap(v => v.images.map((image, sort) => ({ variant_id: v.variant_id, image_id: image.id, sort }))) ?? [], condition: metadata.data?.condition }, selectedVariantId);
  const chosen = selection.variant; const colors = productColorSummaries(variants);
  const unavailable = metadata.isSuccess && !chosen;
  const price = chosen?.price_usd ?? null;
  const generalCover = reviewedGeneralProductImages(metadata.data ?? {}, metadata.data?.variants.flatMap(v => v.images) ?? [])[0]?.path ?? null;
  const previewCover = !chosen ? null : selection.cover?.path ?? (selection.mediaState === 'unclassified' ? generalCover : null);
  const missingChoicePhoto = selectedVariantId !== null && !!photoChoiceNotice({ selectedVariantId: chosen?.id, variants, mediaState: selection.mediaState, imagePath: previewCover });
  const cover = missingChoicePhoto ? null : previewCover;
  const condition = productConditionLabel(metadata.data?.condition);
  const availability = presentAvailability(unavailable || !chosen?.active ? 'unavailable' : chosen.stock != null && chosen.stock <= 0 ? 'sold_out' : p.availability);
  const hint = stockHint(chosen ? chosen.stock : null, p.availability);
  const discount = price != null && p.compare_at_usd && Number(p.compare_at_usd) > Number(price) ? Math.round((1 - Number(price) / Number(p.compare_at_usd)) * 100) : 0;
  const { name, brand } = splitCardBrand(p.title, p.brand_name);
  const [focusVisible, setFocusVisible] = useState(false);
  return (
    <View testID={`product-surface-${p.slug}`} style={{ width, borderRadius: 10, backgroundColor: colorsTheme.surface, borderWidth: 1, borderColor: colorsTheme.border, overflow: 'hidden' }}>
      <ScalePressable
        testID={`product-card-${p.slug}`}
        scaleTo={0.985}
        focusOutline={false}
        accessibilityRole="link"
        accessibilityLabel={`${p.title}, ${price == null ? unavailable ? 'opción no disponible' : 'cargando opciones' : formatUSD(price)}, ${availability.label}${p.is_demo && !isPrivateCatalogPresentation ? ', producto de demostración' : ''}`}
        onFocus={(event) => {
          if (Platform.OS === 'web') {
            const target = event.target as unknown as { matches?: (selector: string) => boolean };
            setFocusVisible(target.matches?.(':focus-visible') ?? false);
          }
        }}
        onBlur={() => setFocusVisible(false)}
        onPress={() => {
          if (slot) recordClick(slot, p.id);
          router.push({ pathname: '/product/[id]', params: { id: p.id, ...(selection.selectedVariantId ? { variant: selection.selectedVariantId } : {}) } });
        }}
      >
        <View testID={`product-photo-stage-${p.slug}`} style={{ margin: 5 }}>
          <ProductImage productId={p.id} productIsDemo={false} variantId={chosen?.id} path={cover} tone={p.tone} priority={priority} aspect={1} fit="contain" radius={7} showUnavailableLabel={missingChoicePhoto} style={scheme === 'dark' && cover ? { backgroundColor: '#fff' } : undefined} />
          {scheme === 'dark' && cover ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(28,25,40,0.12)' }} /> : null}
          {/* Demo prices and stock never masquerade as a real promotion or scarcity claim. */}
          <View style={{ position: 'absolute', left: 8, top: 8, gap: 4, maxWidth: width - 58 }}>
            {p.is_demo ? (!isPrivateCatalogPresentation ? <Badge onPhoto label="Demo" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null) : <>
              {discount && p.availability === 'available' ? <Badge onPhoto label={`−${discount} %`} tone="danger" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
              {hint ? <Badge onPhoto label={hint} tone="warning" style={{ borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
            </>}
          </View>
          {unavailable || p.availability !== 'available' || (chosen && !selection.canBuy) ? <Badge onPhoto label={availability.label} tone={!availability.purchasable ? 'muted' : 'brand'} style={{ position: 'absolute', bottom: 8, left: 8, maxWidth: width - 18, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }} /> : null}
        </View>
        <View style={{ padding: 10, gap: 4 }}>
          <Text testID="card-title" variant="bodySmall" style={{ fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: -0.1 }}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6, rowGap: 2 }}>
            {price != null ? <Price usd={price} muted={!availability.purchasable} /> : <Text testID={`card-option-state-${p.slug}`} variant="caption" color="textSecondary">{unavailable ? 'Opción no disponible' : metadata.isError ? 'Opciones no disponibles' : 'Cargando opciones'}</Text>}
            {brand ? <Text testID="card-brand" variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>{brand}</Text> : null}
          </View>
        </View>
      </ScalePressable>
      {condition ? <View style={{ paddingHorizontal: 10, paddingBottom: 6 }}><Text testID={`card-condition-${p.slug}`} variant="caption" color="textSecondary">{condition}</Text></View> : null}
      {colors.length ? <ScrollView testID={`card-colors-${p.slug}`} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingBottom: 8 }}>{colors.map(color => <ScalePressable key={color.value} accessibilityRole="button" accessibilityLabel={`Color ${color.value}${!color.available_variant_ids.length ? ', agotado' : ''}`} accessibilityState={{ selected: color.variant_ids.includes(chosen?.id ?? '') }} onPress={() => setSelectedVariantId(color.available_variant_ids[0] ?? color.variant_ids[0]!)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: color.variant_ids.includes(chosen?.id ?? '') ? colorsTheme.brand : colorsTheme.border, backgroundColor: colorsTheme.surface }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ColorDot label={color.value} /><Text variant="caption" color="textSecondary">{color.value}</Text></View></ScalePressable>)}</ScrollView> : null}
      {chosen && selection.mediaState === 'none' ? <Text variant="caption" color="textSecondary" style={{ paddingHorizontal: 10, paddingBottom: 8 }}>Sin foto de esta opción</Text> : null}
      {metadata.isError ? <ScalePressable accessibilityRole="button" accessibilityLabel="Reintentar opciones del producto" onPress={() => void metadata.refetch()} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }}><Text variant="caption" color="danger">Reintentar opciones</Text></ScalePressable> : null}
      <View style={{ position: 'absolute', right: 5, top: 5 }}>
        <ProductFavorite id={p.id} slug={p.slug} onPhoto />
      </View>
      {focusVisible ? (
        <View testID="card-focus-ring" pointerEvents="none" accessible={false} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <View testID="card-focus-backing" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 4, borderColor: colorsTheme.surface, borderRadius: 10 }} />
          <View testID="card-focus-color" style={{ position: 'absolute', top: 1, bottom: 1, left: 1, right: 1, borderWidth: 2, borderColor: colorsTheme.brand, borderRadius: 9 }} />
        </View>
      ) : null}
    </View>
  );
});
