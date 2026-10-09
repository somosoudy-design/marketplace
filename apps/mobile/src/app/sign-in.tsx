import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pw = useRef<TextInput>(null);

  const submit = async () => {
    if (!email.includes('@') || password.length < 6) return setError('Escribe tu correo y tu contraseña.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      haptics.success();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      haptics.warning();
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6, marginBottom: 6 }}>
          <Text variant="displayL">Hola de nuevo</Text>
          <Text color="textSecondary">Entra para pagar, seguir tus pedidos y guardar favoritos.</Text>
        </View>
        {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
        <TextField testID="sign-in-email" label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} />
        <TextField testID="sign-in-password" ref={pw} label="Contraseña" value={password} onChangeText={setPassword} secureToggle autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <Button testID="sign-in-submit" title="Iniciar sesión" size="lg" full loading={busy} onPress={submit} />
        <Link href="/forgot-password" style={{ alignSelf: 'center', padding: 8 }}>
          <Text variant="label" color="brand">Olvidé mi contraseña</Text>
        </Link>
        <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 6 }} />
        <Text align="center" color="textSecondary">¿Primera vez aquí?</Text>
        <Button title="Crear una cuenta" variant="secondary" full onPress={() => router.replace('/sign-up')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
