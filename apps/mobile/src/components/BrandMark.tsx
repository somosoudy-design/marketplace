import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import artwork from '../../../../config/brand-artwork.json';
import { brand } from '@/lib/brand';
import { useTheme } from '@/theme';

/** Original Work SVG, unchanged. Surrounding header margins/gaps provide the kit's clear space. */
export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  const t = useTheme();
  const width = artwork.minimumScreenWidth;
  return (
    <View testID="brand-mark" accessible accessibilityRole="header" accessibilityLabel={brand.name}
      style={{ width, minHeight: 44, flexShrink: 0, justifyContent: 'center' }}>
      <SvgXml xml={inverse || t.scheme === 'dark' ? artwork.wordmark.white : artwork.wordmark.violet}
        width={width} height={width * artwork.height / artwork.width}
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        aria-hidden pointerEvents="none" />
    </View>
  );
}
