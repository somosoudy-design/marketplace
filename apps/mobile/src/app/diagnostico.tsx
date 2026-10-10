import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { env } from '@/lib/env';
import { sessionSealSelfTest } from '@/lib/session-storage';
import { useTheme } from '@/theme';

// For testers and support: which build, update and backend this copy of the app runs, and whether the session
// is sealed on this device. Opens from the version line in Cuenta, or kora://diagnostico. Shows no keys or tokens.
export default function DiagnosticsScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [seal, setSeal] = useState('…');
  const [backend, setBackend] = useState('…');

  useEffect(() => {
    sessionSealSelfTest().then(setSeal);
    const started = Date.now();
    fetch(`${env.supabaseUrl}/auth/v1/health`, { headers: { apikey: env.supabaseAnonKey } })
      .then((r) => setBackend(`${r.ok ? 'responde' : `HTTP ${r.status}`} en ${Date.now() - started} ms`))
      .catch((e) => setBackend(`sin respuesta (${String(e?.message ?? e)})`));
  }, []);

  const rows: [string, string][] = [
    ['App', `${Constants.expoConfig?.name ?? ''} ${Constants.expoConfig?.version ?? ''}`],
    ['Sistema', `${Platform.OS} ${String(Platform.Version)}`],
    ['Canal', Updates.channel ?? '—'],
    ['Runtime', Updates.runtimeVersion ?? '—'],
    ['Código', Updates.isEmbeddedLaunch ? 'el del APK' : `actualización ${Updates.updateId ?? ''}`],
    ['Publicada', Updates.createdAt ? Updates.createdAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—'],
    ['Backend', env.supabaseUrl.replace(/^https?:\/\//, '') || 'sin configurar'],
    ['Conexión', backend],
    ['Sesión cifrada', seal === 'ok' ? 'sí (llave en el almacén seguro del teléfono)' : seal === 'not-encrypted' ? 'no disponible en esta versión' : seal],
    ['Cuenta', user ? 'con sesión' : 'sin sesión'],
  ];

  useEffect(() => {
    if (seal === '…' || backend === '…') return;
    // one line in the device log, so an emulator run (tools/eas/emulator-install.sh) can read the result
    console.log(`KoraDiag ${JSON.stringify(Object.fromEntries(rows))}`);
  });

  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 20, gap: 2 }}>
      {rows.map(([k, v]) => (
        <View key={k} testID={`diag-${k}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
          <Text variant="label" color="textSecondary" style={{ width: 110 }}>{k}</Text>
          <Text variant="bodySmall" selectable style={{ flex: 1 }}>{v}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
