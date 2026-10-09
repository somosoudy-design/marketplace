import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, useColorScheme, View } from 'react-native';

// Rendered by Expo Router when a screen throws while rendering. It may sit above the theme
// provider (root layout), so it only relies on React Native primitives.
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() === 'dark';
  if (__DEV__) console.error(error);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, backgroundColor: dark ? '#121416' : '#F6F0E7' }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', color: dark ? '#F3EEE6' : '#1E1B17' }}>Algo no salió bien</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, textAlign: 'center', color: dark ? '#B9B2A7' : '#5C554B', maxWidth: 360 }}>
        Tuvimos un problema mostrando esta pantalla. Tus datos y pedidos están a salvo.
      </Text>
      <Pressable testID="error-retry" accessibilityRole="button" onPress={retry} style={{ marginTop: 6, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 999, backgroundColor: '#0E5E54' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Reintentar</Text>
      </Pressable>
    </View>
  );
}
