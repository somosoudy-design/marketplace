import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function RadioRow({ selected, title, subtitle, trailing, badge, onPress, testID }: { selected: boolean; title: string; subtitle?: string; trailing?: string; badge?: string; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={() => { haptics.select(); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent' })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? t.colors.brand : t.colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.colors.brand }} /> : null}
      </View>
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
