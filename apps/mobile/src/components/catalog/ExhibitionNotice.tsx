import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';

/** Internal context belongs to diagnostics; shopping surfaces use the commercial presentation. */
export function ExhibitionNotice({ style, diagnostic = false }: { style?: StyleProp<TextStyle>; explain?: boolean; diagnostic?: boolean }) {
  if (!diagnostic || !isPrivateCatalogPresentation) return null;
  return (
    <Text testID="catalog-exhibition-notice" variant="caption" color="textSecondary"
      accessibilityLabel="Catálogo interno con datos de evaluación."
      style={style}>Catálogo interno</Text>
  );
}
