import { optionSwatchTone } from '@kora/core';
import { palette } from '@kora/design-tokens';
import { View } from 'react-native';
import { useTheme } from '@/theme';

const fills = { black: palette.ink[900], white: palette.ink[0], gray: palette.ink[500], purple: palette.violet[400] };
/** The name carries meaning. An unknown shade stays unfilled rather than being invented. */
export function ColorDot({ label, selected }: { label: string; selected?: boolean }) {
  const { colors } = useTheme();
  const tone = optionSwatchTone(label);
  return <View accessible={false} pointerEvents="none" testID="color-swatch" style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 9, borderWidth: 1.5, borderColor: selected ? colors.onBrand : colors.textMuted, backgroundColor: tone ? fills[tone] : 'transparent' }} />;
}
