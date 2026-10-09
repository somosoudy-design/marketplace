import { validatePassword } from '@kora/core';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const t = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const pwError = password ? validatePassword(password) : null;

  const submit = async () => {
    if (name.trim().length < 2) return setError('Escribe tu nombre.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un correo válido.');
    if (validatePassword(password)) return setError(validatePassword(password));
    setBusy(true);
    setError(null);
    try {
      const r = await signUp(email, password, name);
      if (r.needsConfirmation) setSent(true);
      else if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={{ flex: 1, padding: 24, gap: 14, backgroundColor: t.colors.background }}>
        <Text variant="displayL">Revisa tu correo</Text>
        <Text color="textSecondary">Te enviamos un enlace a {email.trim()} para confirmar tu cuenta.</Text>
        <Button title="Entendido" onPress={() => router.back()} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text variant="displayL">Crea tu cuenta</Text>
          <Text color="textSecondary">Solo te pedimos lo necesario. La dirección la agregas al comprar.</Text>
        </View>
        {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
        <TextField testID="sign-up-name" label="Nombre y apellido" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
        <TextField testID="sign-up-email" label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <TextField testID="sign-up-password" label="Contraseña" value={password} onChangeText={setPassword} secureToggle autoComplete="new-password" textContentType="newPassword" helper="Mínimo 8 caracteres, con letras y números." error={pwError} />
        <Button testID="sign-up-submit" title="Crear cuenta" size="lg" full loading={busy} onPress={submit} />
        <Text variant="caption" color="textMuted" align="center">
          Al crear tu cuenta aceptas los términos y la política de privacidad. Puedes pedir la eliminación de tu cuenta cuando quieras.
        </Text>
        <Link href="/sign-in" replace style={{ alignSelf: 'center', padding: 8 }}>
          <Text variant="label" color="brand">Ya tengo cuenta</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
