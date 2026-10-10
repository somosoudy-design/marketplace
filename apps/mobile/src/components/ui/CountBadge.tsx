import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** The parent control announces the full count; this compact mark is visual only. */
export function CountBadge({ count, testID }: { count: number; testID?: string }) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', right: -3, top: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}
    >
      <Text variant="caption" style={{ color: colors.onBrand, fontSize: 10, lineHeight: 14, fontFamily: 'PlusJakartaSans_700Bold' }}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}
