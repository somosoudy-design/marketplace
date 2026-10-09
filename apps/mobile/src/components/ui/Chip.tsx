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
        height: 36,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        backgroundColor: selected ? colors.text : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.text : colors.border,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? colors.surface : colors.textSecondary} /> : null}
      <Text variant="label" style={{ color: selected ? colors.surface : colors.text }}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text variant="caption" style={{ color: colors.onBrand, fontFamily: 'Manrope_700Bold', fontSize: 11 }}>{count}</Text>
        </View>
      ) : null}
    </ScalePressable>
  );
}
