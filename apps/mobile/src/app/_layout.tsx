import { Fraunces_500Medium_Italic, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfigMissing } from '@/components/ConfigMissing';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/env';
import { persistOptions, queryClient } from '@/lib/query';
import { OfflineFrame } from '@/components/OfflineNotice';
import { UpdateNotice } from '@/components/UpdateNotice';
import { ThemeProvider, useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 220, fade: true });

export const unstable_settings = { anchor: '(tabs)' };

function RootStack() {
  const t = useTheme();
  const { ready } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const loaded = (fontsLoaded || !!fontError) && ready;
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);
  if (!loaded) return null;

  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: t.colors.brand, background: t.colors.background, card: t.colors.background, text: t.colors.text, border: t.colors.border, notification: t.colors.danger },
  };
  const header = {
    headerStyle: { backgroundColor: t.colors.background },
    headerTitleStyle: { fontFamily: 'Manrope_700Bold', fontSize: 17, color: t.colors.text },
    headerTintColor: t.colors.text,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: t.colors.background },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <OfflineFrame>
        <Stack screenOptions={header}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Inicio' }} />
          <Stack.Screen name="product/[id]" options={{ headerShown: false, title: 'Producto' }} />
          <Stack.Screen name="store/[slug]" options={{ headerShown: false, title: 'Tienda' }} />
          <Stack.Screen name="catalog" options={{ title: 'Catálogo' }} />
          <Stack.Screen name="checkout" options={{ title: 'Finalizar compra' }} />
          <Stack.Screen name="pay/[orderId]" options={{ title: 'Pagar', gestureEnabled: false }} />
          <Stack.Screen name="orders/index" options={{ title: 'Mis pedidos' }} />
          <Stack.Screen name="orders/[id]" options={{ title: 'Pedido' }} />
          <Stack.Screen name="addresses/index" options={{ title: 'Direcciones' }} />
          <Stack.Screen name="addresses/edit" options={{ title: 'Dirección', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="settings" options={{ title: 'Preferencias y privacidad' }} />
          <Stack.Screen name="diagnostico" options={{ title: 'Diagnóstico' }} />
          <Stack.Screen name="claim/[fulfillmentId]" options={{ title: 'Reclamo' }} />
          <Stack.Screen name="p/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="tienda/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Iniciar sesión', presentation: 'modal' }} />
          <Stack.Screen name="sign-up" options={{ title: 'Crear cuenta', presentation: 'modal' }} />
          <Stack.Screen name="verify-email" options={{ title: 'Confirmar correo', presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Recuperar acceso', presentation: 'modal' }} />
          <Stack.Screen name="reset-password" options={{ title: 'Contraseña nueva', gestureEnabled: false }} />
          <Stack.Screen name="auth-callback" options={{ title: 'Confirmar correo', headerBackVisible: false }} />
        </Stack>
        <UpdateNotice />
      </OfflineFrame>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  if (!isConfigured) return <ConfigMissing />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <ThemeProvider>
            <AuthProvider>
              <RootStack />
            </AuthProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
