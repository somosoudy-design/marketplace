import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import symbol from '../../../../config/brand-symbol.json';
import { brand } from '@/lib/brand';

/** Original optical symbol, used when the full wordmark must make room for search. */
export function BrandSymbol() {
  return (
    <View testID="brand-symbol" accessible accessibilityRole="header" accessibilityLabel={brand.name}
      style={{ width: 44, minHeight: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <SvgXml xml={symbol.white} width={30} height={28}
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        aria-hidden pointerEvents="none" />
    </View>
  );
}
