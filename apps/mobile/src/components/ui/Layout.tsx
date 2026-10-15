import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function SectionHeader({ overline, title, action, onAction, stackAction = false }: { overline?: string; title: string; action?: string; onAction?: () => void; stackAction?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: stackAction ? 'column' : 'row', alignItems: stackAction ? 'flex-start' : 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12, gap: stackAction ? 0 : 12 }}>
      <View style={{ flex: stackAction ? undefined : 1, width: stackAction ? '100%' : undefined, gap: 2 }}>
        {overline ? <Text variant="caption" color="textMuted">{overline}</Text> : null}
        <Text variant="displayM" accessibilityRole="header">{title}</Text>
      </View>
      {action ? (
        <ScalePressable accessibilityRole="link" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingBottom: 2 }}>
          <Text variant="label" color="brand">{action}</Text>
          <Icon name="chevron-right" size={16} color={colors.brand} />
        </ScalePressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style, padded = true, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; testID?: string }) {
  const { colors, radii } = useTheme();
  return <View testID={testID} style={[{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: padded ? 16 : 0, borderWidth: 1, borderColor: colors.border }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: inset }} />;
}

export function ListRow({ icon, title, subtitle, value, onPress, danger, testID }: { icon?: Parameters<typeof Icon>[0]['name']; title: string; subtitle?: string; value?: string; onPress?: () => void; danger?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <ScalePressable testID={testID} scaleTo={0.99} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 }}>
      {icon ? <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? colors.dangerSoft : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={21} color={danger ? colors.danger : colors.brand} /></View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="subtitle" color={danger ? 'danger' : 'text'}>{title}</Text>
        {subtitle ? <Text variant="bodySmall" color="textMuted">{subtitle}</Text> : null}
        {value ? <Text variant="bodySmall" color="textSecondary">{value}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null}
    </ScalePressable>
  );
}

export function Stepper({ value, min = 1, max, onChange, disabled }: { value: number; min?: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  const { colors, radii, layout } = useTheme();
  const btn = (icon: 'minus' | 'plus', next: number, label: string, enabled: boolean) => (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!enabled}
      disabled={!enabled}
      onPress={() => onChange(next)}
      hitSlop={6}
      style={{ width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.35 }}
    >
      <Icon name={icon} size={18} color={colors.text} strokeWidth={2} />
    </ScalePressable>
  );
  return (
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface }}>
      {btn('minus', value - 1, 'Disminuir cantidad', !disabled && value > min)}
      <Text variant="label" tabular style={{ minWidth: 24, textAlign: 'center' }} accessibilityLabel={`Cantidad ${value}`}>{value}</Text>
      {btn('plus', value + 1, 'Aumentar cantidad', !disabled && value < max)}
    </View>
  );
}
