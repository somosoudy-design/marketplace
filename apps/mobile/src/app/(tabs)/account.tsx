import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfilePhoto } from '@/components/account/ProfilePhoto';
import { MAX_CONTENT } from '@/components/catalog/ProductGrid';
import { RatePill } from '@/components/RateSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider, ListRow } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { useFavorites, useOrders, useProfile, useSupport, useUnreadCount } from '@/lib/hooks';
import { useTheme } from '@/theme';

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL ?? '';
// Builds made before the web panel is published say so instead of a row that does nothing.
const PANEL_PENDING = 'El panel web todavía no está publicado para esta versión';

export default function AccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, roles, storeIds, signOut } = useAuth();
  const profile = useProfile();
  const orders = useOrders();
  const unread = useUnreadCount();
  const support = useSupport();
  const fav = useFavorites();
  const open = (orders.data ?? []).filter((o) => o.status === 'placed' || o.status === 'in_progress').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48, paddingHorizontal: 16, gap: 18, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>
      <Text variant="displayL">Cuenta</Text>
      {!user ? (
        <>
          <Card style={{ gap: 14, padding: 20 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={26} color={t.colors.brand} />
            </View>
            <Text variant="title">Entra para comprar y seguir tus pedidos</Text>
            <Text color="textSecondary">Guarda direcciones, paga en bolívares o dólares y recibe avisos de cada entrega.</Text>
            <Button testID="account-sign-in" title="Iniciar sesión" full onPress={() => router.push('/sign-in')} />
            <Button title="Crear cuenta" variant="secondary" full onPress={() => router.push('/sign-up')} />
          </Card>
          <Card padded={false}>
            <ListRow testID="account-favorites" icon="heart" title="Favoritos" subtitle="Lo que guardas con el corazón" onPress={() => router.push('/favorites')} />
          </Card>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ProfilePhoto userId={user.id} name={profile.data?.full_name ?? user.email ?? ''} path={profile.data?.avatar_path ?? null} />
            <View style={{ flex: 1 }}>
              <Text variant="title" testID="account-name">{profile.data?.full_name ?? 'Tu cuenta'}</Text>
              <Text variant="bodySmall" color="textMuted">{user.email}</Text>
            </View>
          </View>
          <Card padded={false}>
            <ListRow testID="account-orders" icon="receipt" title="Mis pedidos" subtitle={open ? `${open} en curso` : 'Historial y seguimiento'} onPress={() => router.push('/orders')} />
            <Divider inset={52} />
            <ListRow testID="account-favorites" icon="heart" title="Favoritos" subtitle={fav.ids.size ? (fav.ids.size === 1 ? '1 producto guardado' : `${fav.ids.size} productos guardados`) : 'Lo que guardas con el corazón'} onPress={() => router.push('/favorites')} />
            <Divider inset={52} />
            <ListRow icon="map-pin" title="Direcciones" subtitle="Dónde recibes tus compras" onPress={() => router.push('/addresses')} />
            <Divider inset={52} />
            <ListRow icon="bell" title="Notificaciones" value={unread ? `${unread} nuevas` : undefined} onPress={() => router.push('/notifications')} />
            <Divider inset={52} />
            <ListRow icon="settings" title="Preferencias y privacidad" subtitle="Tema, recomendaciones, eliminar cuenta" onPress={() => router.push('/settings')} />
          </Card>
          {storeIds.length || roles.length ? (
            <Card padded={false}>
              {storeIds.length ? (
                <ListRow icon="store" title="Panel de vendedor" subtitle={PANEL_URL ? 'Pedidos, productos, inventario y liquidaciones' : PANEL_PENDING} onPress={PANEL_URL ? () => openPanel('/vendedor') : undefined} />
              ) : null}
              {storeIds.length && roles.length ? <Divider inset={52} /> : null}
              {roles.length ? <ListRow icon="shield-check" title="Administración" subtitle={PANEL_URL ? 'Panel web de operaciones' : PANEL_PENDING} onPress={PANEL_URL ? () => openPanel('/admin') : undefined} /> : null}
            </Card>
          ) : null}
        </>
      )}
      <Card padded={false}>
        <ListRow
          icon="circle-question-mark"
          title="Ayuda"
          subtitle={support.data ? `${support.data.email} · ${support.data.hours}` : brand.supportEmail}
          onPress={() => Linking.openURL(`mailto:${support.data?.email ?? brand.supportEmail}`)}
        />
      </Card>
      {/* the bolívar reference rate lives here and next to prices, not on the store front */}
      <RatePill testID="account-rate" />
      {user ? <Button title="Cerrar sesión" variant="ghost" icon="log-out" onPress={() => signOut()} /> : null}
      <Text variant="caption" color="textMuted" align="center" onPress={() => router.push('/diagnostico')} testID="app-version">
        {brand.legalName} · versión {Constants.expoConfig?.version ?? '0.1.0'}
        {/* which EAS Update is running, so a tester can tell whether the latest one arrived */}
        {Updates.isEnabled && !Updates.isEmbeddedLaunch && Updates.updateId
          ? ` · actualización ${Updates.updateId.slice(0, 8)}${Updates.createdAt ? ` del ${Updates.createdAt.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}` : ''}`
          : ''}
      </Text>
    </ScrollView>
  );
}

function openPanel(path: string) {
  WebBrowser.openBrowserAsync(`${PANEL_URL}${path}`).catch(() => undefined);
}
