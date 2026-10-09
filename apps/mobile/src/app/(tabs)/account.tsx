import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT } from '@/components/catalog/ProductGrid';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider, ListRow } from '@/components/ui/Layout';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { useOrders, useProfile, useUnreadCount } from '@/lib/hooks';
import { useTheme } from '@/theme';

const PANEL_URL = process.env.EXPO_PUBLIC_PANEL_URL ?? '';

export default function AccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, roles, storeIds, signOut } = useAuth();
  const profile = useProfile();
  const orders = useOrders();
  const unread = useUnreadCount();
  const open = (orders.data ?? []).filter((o) => o.status === 'placed' || o.status === 'in_progress').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48, paddingHorizontal: 16, gap: 18, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}>
      <Text variant="displayL">Cuenta</Text>
      {!user ? (
        <Card style={{ gap: 14, padding: 20 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="user" size={26} color={t.colors.brand} />
          </View>
          <Text variant="title">Entra para comprar y seguir tus pedidos</Text>
          <Text color="textSecondary">Guarda direcciones, paga en bolívares o dólares y recibe avisos de cada entrega.</Text>
          <Button testID="account-sign-in" title="Iniciar sesión" full onPress={() => router.push('/sign-in')} />
          <Button title="Crear cuenta" variant="secondary" full onPress={() => router.push('/sign-up')} />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="title" style={{ color: t.colors.onBrand }}>{initials(profile.data?.full_name ?? user.email ?? '')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title" testID="account-name">{profile.data?.full_name ?? 'Tu cuenta'}</Text>
              <Text variant="bodySmall" color="textMuted">{user.email}</Text>
            </View>
          </View>
          <Card padded={false}>
            <ListRow testID="account-orders" icon="receipt" title="Mis pedidos" subtitle={open ? `${open} en curso` : 'Historial y seguimiento'} onPress={() => router.push('/orders')} />
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
                <ListRow icon="store" title="Panel de vendedor" subtitle="Pedidos, productos, inventario y liquidaciones" onPress={() => openPanel('/vendedor')} />
              ) : null}
              {storeIds.length && roles.length ? <Divider inset={52} /> : null}
              {roles.length ? <ListRow icon="shield-check" title="Administración" subtitle="Panel web de operaciones" onPress={() => openPanel('/admin')} /> : null}
            </Card>
          ) : null}
        </>
      )}
      <Card padded={false}>
        <ListRow icon="circle-question-mark" title="Ayuda" subtitle={brand.supportEmail} onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)} />
      </Card>
      {user ? <Button title="Cerrar sesión" variant="ghost" icon="log-out" onPress={() => signOut()} /> : null}
      <Text variant="caption" color="textMuted" align="center">
        {brand.legalName} · versión {Constants.expoConfig?.version ?? '0.1.0'}
      </Text>
    </ScrollView>
  );
}

function openPanel(path: string) {
  if (PANEL_URL) WebBrowser.openBrowserAsync(`${PANEL_URL}${path}`).catch(() => undefined);
}

function initials(s: string) {
  const parts = s.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'K';
}
