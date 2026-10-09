import { router } from 'expo-router';
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

/**
 * A screen that could not load. Says why: only a network failure asks to check the connection, an ended
 * session asks to sign in again, and anything else shows the server's own message.
 */
export function ErrorState({ error, message, onRetry }: { error?: unknown; message?: string; onRetry?: () => void }) {
  const code = (error as { code?: string } | null | undefined)?.code;
  if (code === 'auth_required') {
    return <EmptyState icon="user" title="Tu sesión terminó" body="Inicia sesión otra vez para continuar." action="Iniciar sesión" onAction={() => router.push('/sign-in')} />;
  }
  const network = code === undefined || code === 'network';
  const detail = error instanceof Error && error.message ? error.message : undefined;
  return (
    <EmptyState
      icon={network ? 'wifi-off' : 'circle-alert'}
      title="No pudimos cargar esto"
      body={message ?? (network ? 'Revisa tu conexión e intenta de nuevo.' : detail ?? 'Algo salió mal. Intenta de nuevo.')}
      action={onRetry ? 'Reintentar' : undefined}
      onAction={onRetry}
    />
  );
}

/** Shown instead of a skeleton when there is nothing saved for this screen and the device is offline. */
export function OfflineState() {
  return <EmptyState icon="wifi-off" title="Sin conexión" body="Esto todavía no está guardado en tu teléfono. Se carga solo cuando vuelva la conexión." />;
}

/** A query that has never loaded and is waiting for the network (React Query pauses it while offline). */
export const waitingForNetwork = (q: { isPending: boolean; fetchStatus: string }) => q.isPending && q.fetchStatus === 'paused';

/** Over saved data when the latest refresh failed, so an old amount or status is never taken as current. */
export function StaleNotice({ q }: { q: { isError: boolean; data: unknown } }) {
  if (!q.isError || q.data === undefined) return null;
  return <Banner tone="warning" icon="wifi-off" body="No pudimos actualizar. Ves lo último que cargaste; puede haber cambiado." />;
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
