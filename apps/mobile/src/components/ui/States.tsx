import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function EmptyState({ icon = 'sparkles', title, body, action, onAction }: { icon?: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={colors.brand} />
      </View>
      <Text variant="displayM" align="center">{title}</Text>
      {body ? <Text color="textSecondary" align="center">{body}</Text> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="wifi-off"
      title="No pudimos cargar esto"
      body={message ?? 'Revisa tu conexión e intenta de nuevo.'}
      action={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

export function Banner({ tone = 'info', icon = 'info', title, body, children }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'brand'; icon?: IconName; title?: string; body?: string; children?: React.ReactNode }) {
  const { colors, radii } = useTheme();
  const map = {
    info: [colors.infoSoft, colors.info],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    success: [colors.successSoft, colors.success],
    brand: [colors.brandSoft, colors.brand],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radii.md, backgroundColor: bg }}>
      <Icon name={icon} size={20} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="label" style={{ color: fg }}>{title}</Text> : null}
        {body ? <Text variant="bodySmall" color="textSecondary">{body}</Text> : null}
        {children}
      </View>
    </View>
  );
}
