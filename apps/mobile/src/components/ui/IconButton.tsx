import { type StyleProp, type ViewStyle } from 'react-native';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';

interface Props {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  tone?: 'plain' | 'surface' | 'glass' | 'brand';
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
}

export function IconButton({ icon, label, onPress, size = 44, tone = 'plain', color, filled, style, testID, disabled }: Props) {
  const { colors, elevation, layout } = useTheme();
  const target = Math.max(size, layout.minTouch);
  const bg = tone === 'surface' ? colors.surface : tone === 'glass' ? colors.tabBar : tone === 'brand' ? colors.brand : 'transparent';
  const fg = color ?? (tone === 'brand' ? colors.onBrand : colors.text);
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      scaleTo={0.9}
      style={[
        { width: target, height: target, borderRadius: target / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        // floating over photos only; on plain surfaces a hairline is enough
        tone === 'glass' ? elevation.low : tone === 'surface' ? { borderWidth: 1, borderColor: colors.border } : null,
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={fg} fill={filled ? fg : 'none'} />
    </ScalePressable>
  );
}
