import { router, Stack } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/lib/auth';
import { SellerProvider } from '@/lib/seller';
import { useTheme } from '@/theme';

export default function SellerLayout() {
  const t = useTheme();
  const { user } = useAuth();
  return <SellerProvider key={user?.id ?? 'guest'}><Stack screenOptions={{
    headerStyle: { backgroundColor: t.colors.background }, headerTintColor: t.colors.text,
    headerTitleStyle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 17 },
    headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: t.colors.background },
  }}>
    <Stack.Screen name="index" options={{ title: 'Mi tienda', headerLeft: () => <IconButton testID="seller-account-back" icon="chevron-left" label="Volver a Cuenta" size={44} onPress={() => router.dismissTo('/account')} /> }} />
    <Stack.Screen name="products" options={{ title: 'Mis productos' }} />
    <Stack.Screen name="orders" options={{ title: 'Pedidos de mi tienda' }} />
    <Stack.Screen name="settings" options={{ title: 'Configuración de tienda' }} />
  </Stack></SellerProvider>;
}
