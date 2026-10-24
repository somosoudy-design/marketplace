import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';

/** One quiet environment identifier per screen, including deep links. */
export function ExhibitionNotice({ style, explain = false }: { style?: StyleProp<TextStyle>; explain?: boolean }) {
  if (!isPrivateCatalogPresentation) return null;
  return (
    <Text testID="catalog-exhibition-notice" variant="caption" color="textSecondary"
      accessibilityLabel="Entorno de pruebas. Incluye imágenes generadas de exhibición. Los productos de demostración y sus precios son ejemplos, no ofertas reales."
      style={style}>Entorno de pruebas · Incluye imágenes generadas{explain ? ' · Precios de ejemplo, no ofertas reales' : ''}</Text>
  );
}
