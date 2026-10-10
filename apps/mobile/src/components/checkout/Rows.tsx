import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function RadioRow({ selected, title, subtitle, trailing, badge, icon, disabled, onPress, testID }: { selected: boolean; title: string; subtitle?: string; trailing?: string; badge?: string; icon?: IconName; disabled?: boolean; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => { haptics.select(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, opacity: disabled ? 0.5 : 1, backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent' })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? t.colors.brand : t.colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.brand }} /> : null}
      </View>
      {icon ? (
        <View style={{ width: 36, height: 36, borderRadius: t.radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? t.colors.brandSoft : t.colors.surfaceSunken }}>
          <Icon name={icon} size={18} color={selected ? t.colors.brand : t.colors.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subtitle" style={{ fontSize: 15 }}>{title}</Text>
        {subtitle ? <Text variant="caption" color="textMuted">{subtitle}</Text> : null}
        {badge ? <Badge label={badge} tone="muted" style={{ marginTop: 4 }} /> : null}
      </View>
      {trailing ? <Text variant="label" tabular>{trailing}</Text> : null}
    </Pressable>
  );
}

export function SummaryRow({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant={strong ? 'subtitle' : 'body'} color={strong ? 'text' : 'textSecondary'}>{label}</Text>
      <Text variant={strong ? 'priceLarge' : 'label'} style={strong ? { fontSize: 22 } : null} tabular testID={testID}>{value}</Text>
    </View>
  );
}
