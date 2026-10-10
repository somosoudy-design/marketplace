import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** When the visible title is a short form of the action (defaults to the title). */
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full, style, accessibilityHint, accessibilityLabel, testID }: Props) {
  const { colors, radii } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.brand, fg: colors.onBrand },
    accent: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.brand },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const p = palette[variant];
  const height = size === 'lg' ? 52 : size === 'sm' ? 36 : 44;
  const inactive = disabled || loading;
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!inactive}
      aria-busy={!!loading}
      disabled={inactive}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={[
        styles.base,
        {
          height,
          backgroundColor: p.bg,
          borderRadius: size === 'sm' ? radii.sm : radii.md,
          borderWidth: p.border ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: p.border,
          paddingHorizontal: size === 'sm' ? 14 : 20,
          opacity: disabled && !loading ? 0.45 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} strokeWidth={2} /> : null}
          <Text variant={size === 'sm' ? 'label' : 'button'} style={{ color: p.fg }} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
