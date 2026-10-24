import { colors } from '@kora/design-tokens';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

/** Shown instead of crashing when the build has no backend configuration (EXPO_PUBLIC_SUPABASE_*). */
export function ConfigMissing() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.light.background }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.light.text, marginBottom: 8 }}>Falta configurar el backend</Text>
      <Text style={{ fontSize: 15, color: colors.light.textSecondary, textAlign: 'center' }}>
        Define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver apps/mobile/.env.example) y vuelve a iniciar la app.
      </Text>
    </View>
  );
}
