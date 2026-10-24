import { Linking } from 'react-native';
import { productExhibitionPhoto } from '@/lib/catalog-exhibition';
import { Text } from '@/components/ui/Text';

/** Attribution travels with the cleared photographs in the preview app. */
export function ExhibitionPhotoCredit({ productId, path, variantId, isDemo }: { productId: string; path?: string; variantId?: string; isDemo?: boolean }) {
  const photo = productExhibitionPhoto(productId, path, variantId, isDemo);
  const attributed = !!photo?.author && !!photo.originUrl && !!photo.licenseUrl;
  if (photo?.kind === 'generated-demo') return (
    <Text testID="exhibition-generated-credit" variant="caption" color="textSecondary">
      {photo.disclosure ?? `Imagen generada de exhibición${photo.referenceOnly ? ' · Representación de referencia; no acredita la composición del set.' : ' · Producto de demostración.'}`}
      {attributed ? <Text testID="exhibition-photo-credit" variant="caption" color="textSecondary">
        {' · Original: '}<Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.originUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.author}</Text>
        {photo.additionalSources?.map((source) => <Text key={source.url} variant="caption" color="textSecondary">
          {' · '}<Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(source.url)} style={{ textDecorationLine: 'underline' }}>{source.label}</Text>
        </Text>)}
        {' · '}<Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.licenseUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.license}</Text>
      </Text> : null}
    </Text>
  );
  if (!photo?.author || !photo.originUrl || !photo.licenseUrl) return null;
  return (
    <Text testID="exhibition-photo-credit" variant="caption" color="textSecondary">
      Foto: <Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.originUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.author}</Text>
      {' · '}<Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.licenseUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.license}</Text>
      {' · tamaño adaptado'}
    </Text>
  );
}
