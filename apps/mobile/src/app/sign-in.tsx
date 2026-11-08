import { authErrorKind } from '@kora/core';
import { Link, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { authTarget, finishAuth, useAuthReturn } from '@/lib/auth-navigation';

export default function SignInScreen() {
  const t = useTheme();
  const returnTo = useAuthReturn();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
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
      if (!mounted.current) return;
      haptics.success();
      finishAuth(returnTo);
    } catch (e) {
      if (!mounted.current) return;
      // the account exists but was never confirmed: finish it with a code instead of a dead end
      if (authErrorKind(e).kind === 'email_not_confirmed') return router.replace(authTarget('/verify-email', returnTo, { email: email.trim(), resend: '1' }));
      haptics.warning();
      setError(authErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6, marginBottom: 6 }}>
          <Text variant="displayL">Hola de nuevo</Text>
          <Text color="textSecondary">Entra para pagar, seguir tus pedidos y guardar tus favoritos en tu cuenta.</Text>
        </View>
        {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
        <TextField testID="sign-in-email" label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} />
        <TextField testID="sign-in-password" ref={pw} label="Contraseña" value={password} onChangeText={setPassword} secureToggle autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <Button testID="sign-in-submit" title="Iniciar sesión" size="lg" full loading={busy} onPress={submit} />
        <Link href={authTarget('/forgot-password', returnTo)} style={{ alignSelf: 'center', padding: 8 }}>
          <Text variant="label" color="brand">Olvidé mi contraseña</Text>
        </Link>
        <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 6 }} />
        <Text align="center" color="textSecondary">¿Primera vez aquí?</Text>
        <Button title="Crear una cuenta" variant="secondary" full onPress={() => router.replace(authTarget('/sign-up', returnTo))} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
