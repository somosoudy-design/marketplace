import { View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function Chip({ label, selected, onPress, icon, count, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; count?: number; testID?: string }) {
  const { colors, radii } = useTheme();
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      aria-selected={!!selected}
      onPress={() => {
        haptics.select();
        onPress?.();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 34,
        paddingHorizontal: 13,
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.brand : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? colors.onBrand : colors.textSecondary} /> : null}
      <Text variant="label" style={{ color: selected ? colors.onBrand : colors.text }}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: selected ? colors.onBrand : colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text variant="caption" style={{ color: selected ? colors.brand : colors.onBrand, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 }}>{count}</Text>
        </View>
      ) : null}
    </ScalePressable>
  );
}
