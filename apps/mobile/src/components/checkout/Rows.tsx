import { Pressable, View } from 'react-native';
import { palette } from '@kora/design-tokens';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function RadioRow({ selected, title, subtitle, trailing, badge, icon, disabled, onPress, testID, indicator = 'leading' }: { selected: boolean; title: string; subtitle?: string; trailing?: string; badge?: string; icon?: IconName; disabled?: boolean; onPress: () => void; testID?: string; indicator?: 'leading' | 'trailing' }) {
  const t = useTheme();
  const radio = <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? t.colors.brand : t.colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
    {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.brand }} /> : null}
  </View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => { haptics.select(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: indicator === 'trailing' ? 10 : 16, minHeight: 56, opacity: disabled ? 0.5 : 1, backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent' })}
    >
      {indicator === 'leading' ? radio : null}
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: t.radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? t.colors.brandSoft : t.colors.surfaceSunken }}>
          <Icon name={icon} size={18} color={selected ? t.colors.brand : t.colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="subtitle" style={{ fontSize: 15 }}>{title}</Text>
        {subtitle ? <Text variant="caption" color="textMuted">{subtitle}</Text> : null}
        {badge ? <Badge label={badge} tone="muted" style={{ marginTop: 4 }} /> : null}
      </View>
      {trailing ? <Text variant="label" tabular>{trailing}</Text> : null}
      {indicator === 'trailing' ? radio : null}
    </Pressable>
  );
}

export function SummaryRow({ label, value, strong, testID, inverse = false }: { label: string; value: string; strong?: boolean; testID?: string; inverse?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <Text variant={strong ? 'subtitle' : inverse ? 'bodySmall' : 'body'} color={strong ? 'text' : 'textSecondary'} style={{ flexShrink: 1, ...(inverse ? { color: palette.ink[0] } : {}) }}>{label}</Text>
      <Text variant={strong ? 'priceLarge' : 'label'} style={{ ...(strong ? { fontSize: 22 } : {}), ...(inverse ? { color: palette.ink[0] } : {}) }} tabular testID={testID}>{value}</Text>
    </View>
  );
}
