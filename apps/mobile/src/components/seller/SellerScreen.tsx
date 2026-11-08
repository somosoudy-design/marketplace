import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/query';
import { useSeller } from '@/lib/seller';
import { useTheme } from '@/theme';

export function SellerLoading() {
  return <View testID="seller-loading" accessibilityRole="progressbar" accessibilityLabel="Cargando tu tienda" style={{ gap: 14, padding: 16 }}><Skeleton height={96} /><Skeleton height={140} /><Skeleton height={180} /></View>;
}

export function SellerScreen({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { access, store } = useSeller();
  const online = useOnline();
  if (!ready) return <SellerLoading />;
  if (!user) return <EmptyState icon="user" title="Entra a tu cuenta" body="Inicia sesión para consultar las tiendas que tienes asignadas." action="Iniciar sesión" onAction={() => router.push('/sign-in')} />;
  if (!online && !store) return <OfflineState />;
  if (access.isError) return <ErrorState error={access.error} onRetry={() => access.refetch()} />;
  if (access.isPending) return <SellerLoading />;
  if (!store) return <EmptyState icon="store" title="No tienes una tienda asignada" body="Puedes seguir comprando desde tu cuenta. El acceso de vendedor aparece cuando la plataforma te asigna una tienda." action="Volver a Cuenta" onAction={() => router.dismissTo('/account')} />;
  // Remount the content on store/account change: filters and paginated rows never leak across stores.
  return <View key={`${user.id}:${store.id}`} style={{ flex: 1 }}>{!online ? <OfflineState /> : null}<View style={{ flex: 1, display: online ? 'flex' : 'none' }}>{children}</View></View>;
}

export function SellerScroll({ children, refresh, refreshing = false }: { children: ReactNode; refresh?: () => void; refreshing?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets style={{ flex: 1, backgroundColor: t.colors.background }} refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.brand} colors={[t.colors.brand]} /> : undefined}
    contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' }}>{children}</ScrollView>;
}

export function AdvancedPanel({ path = '/vendedor' }: { path?: string }) {
  const url = process.env.EXPO_PUBLIC_PANEL_URL;
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState(false);
  return <View style={{ gap: 10 }}>
    <Text variant="bodySmall" color="textSecondary">Para operaciones avanzadas, usa el panel web con tu cuenta habitual.</Text>
    {url ? <Button testID="seller-panel" title="Abrir panel web" icon="arrow-right" variant="secondary" full loading={opening} onPress={async () => {
      setError(false); setOpening(true);
      try { await WebBrowser.openBrowserAsync(`${url}${path}`); } catch { setError(true); } finally { setOpening(false); }
    }} /> : <Text variant="bodySmall" color="textMuted">El panel web todavía no está configurado en esta versión.</Text>}
    {error ? <Text accessibilityRole="alert" color="danger">No pudimos abrir el panel. Intenta de nuevo.</Text> : null}
  </View>;
}
