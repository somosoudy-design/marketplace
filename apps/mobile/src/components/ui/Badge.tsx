import { colors as colorTokens } from '@kora/design-tokens';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type Tone = 'success' | 'editorial' | 'info' | 'warning' | 'muted' | 'danger' | 'brand' | 'accent';

interface Props {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
  /** Sits on a product photo: photos are light in both schemes, so the badge keeps its light colors. */
  onPhoto?: boolean;
  testID?: string;
}

export function Badge({ label, tone = 'muted', style, solid, onPhoto, testID }: Props) {
  const theme = useTheme();
  const { radii } = theme;
  const colors = onPhoto ? colorTokens.light : theme.colors;
  const map: Record<Tone, [string, string]> = {
    success: [colors.successSoft, colors.success],
    editorial: [colors.editorialSoft, colors.editorial],
    info: [colors.infoSoft, colors.info],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    muted: [colors.surfaceSunken, colors.textSecondary],
    brand: [colors.brandSoft, colors.brand],
    accent: [colors.accentSoft, colors.warning],
  };
  const [bg, fg] = map[tone];
  return (
    <View testID={testID} style={[{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: solid ? fg : bg }, style]}>
      <Text variant="caption" style={{ color: solid ? colors.surface : fg, fontFamily: 'PlusJakartaSans_700Bold' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
