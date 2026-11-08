import { useState } from 'react';
import { Linking, View } from 'react-native';
import { productExhibitionPhoto } from '@/lib/catalog-exhibition';
import { exhibitionSourceKey } from '@/lib/catalog-exhibition-policy';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

/** Keep attribution beside its image without replacing product information with internal copy. */
export function ExhibitionPhotoCredit({ productId, path, variantId, isDemo, failedSources }: { productId: string; path?: string; variantId?: string; isDemo?: boolean; failedSources?: ReadonlySet<string> }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const photo = productExhibitionPhoto(productId, path, variantId, isDemo);
  if (!photo) return null;
  const hasSource = !!photo.author && !!photo.originUrl;
  const attributed = !!photo.author && !!photo.originUrl && !!photo.licenseUrl;
  // The Storage fallback is not proven to share the override's provenance.
  if (failedSources?.has(exhibitionSourceKey(productId, path, photo)!)) return null;
  return <>
    <ScalePressable testID="product-image-info" accessibilityRole="button" accessibilityLabel="Información de la imagen" onPress={() => setOpen(true)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      <Icon name="info" size={15} color={t.colors.textMuted} />
      <Text variant="caption" color="textSecondary">Información de la imagen</Text>
    </ScalePressable>
    <Sheet visible={open} title="Información de la imagen" testID="product-image-info-sheet" onClose={() => setOpen(false)}>
      <View style={{ gap: 12 }}>
        {photo.kind === 'generated-demo' ? <Text testID="exhibition-generated-credit" variant="bodySmall" color="textSecondary">{attributed ? 'Imagen editada digitalmente a partir de una fotografía.' : 'Imagen creada digitalmente.'}</Text> : null}
        {photo.referenceOnly ? <Text variant="bodySmall" color="textSecondary">Imagen referencial. Consulta las características y la variante seleccionada.</Text> : null}
        {hasSource ? <View testID="exhibition-photo-credit" style={{ gap: 8 }}>
          <CreditLink label={`Fuente: ${photo.author}`} url={photo.originUrl!} />
          {photo.additionalSources?.map((source) => <CreditLink key={source.url} label={source.label} url={source.url} />)}
          {photo.licenseUrl ? <CreditLink label={photo.license ?? 'Licencia de la imagen'} url={photo.licenseUrl} /> : null}
          {photo.kind !== 'generated-demo' ? <Text variant="caption" color="textSecondary">Tamaño adaptado.</Text> : null}
        </View> : null}
      </View>
    </Sheet>
  </>;
}

function CreditLink({ label, url }: { label: string; url: string }) {
  return <ScalePressable accessibilityRole="link" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} style={{ minHeight: 44, justifyContent: 'center' }}><Text variant="bodySmall" color="brand" style={{ textDecorationLine: 'underline' }}>{label}</Text></ScalePressable>;
}
