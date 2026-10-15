import { Linking } from 'react-native';
import { productExhibitionPhoto } from '@/lib/catalog-exhibition';
import { Text } from '@/components/ui/Text';

/** Attribution travels with the cleared photographs in the preview app. */
export function ExhibitionPhotoCredit({ productId, path }: { productId: string; path?: string }) {
  const photo = productExhibitionPhoto(productId, path);
  if (!photo?.author || !photo.originUrl || !photo.licenseUrl) return null;
  return (
    <Text testID="exhibition-photo-credit" variant="caption" color="textSecondary">
      Foto: <Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.originUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.author}</Text>
      {' · '}<Text variant="caption" color="textSecondary" accessibilityRole="link" onPress={() => void Linking.openURL(photo.licenseUrl!)} style={{ textDecorationLine: 'underline' }}>{photo.license}</Text>
      {' · tamaño adaptado'}
    </Text>
  );
}
