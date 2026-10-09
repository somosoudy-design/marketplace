import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      setDone(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView style={{ backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
      <View style={{ gap: 6 }}>
        <Text variant="displayL">Recupera tu acceso</Text>
        <Text color="textSecondary">Te enviaremos un enlace para crear una contraseña nueva.</Text>
      </View>
      {done ? (
        <Banner tone="success" icon="circle-check" title="Listo" body="Si existe una cuenta con ese correo, recibirás el enlace en unos minutos." />
      ) : (
        <>
          {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
          <TextField label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Button title="Enviar enlace" size="lg" full loading={busy} disabled={!email.includes('@')} onPress={submit} />
        </>
      )}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
