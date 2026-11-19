import { authErrorKind } from '@kora/core';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { ScalePressable } from '@/components/ui/Pressable';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { AuthScreen, authStyles } from '@/components/auth/AuthScreen';
import { authTarget, finishAuth, useAuthReturn } from '@/lib/auth-navigation';
import { GoogleAccessButton } from '@/components/account/GoogleAccessButton';

export default function SignInScreen() {
  const returnTo = useAuthReturn();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { signIn, googleBusy } = useAuth();
  const { googleRetry } = useLocalSearchParams<{ googleRetry?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const pw = useRef<TextInput>(null);
  const [submitted, setSubmitted] = useState(false);
  const emailError = email.includes('@') ? null : 'Escribe tu correo electrónico.';
  const passwordError = password.length >= 6 ? null : 'Escribe tu contraseña completa.';

  const submit = async () => {
    if (busy || googleBusy) return;
    setSubmitted(true);
    setError(null);
    if (emailError) return emailInput.current?.focus();
    if (passwordError) return pw.current?.focus();
    setBusy(true);
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
    <AuthScreen title="Inicia sesión"
      description={returnTo?.split('?')[0] === '/checkout' ? 'Entra para continuar con tu compra.' : 'Entra para ver tus pedidos y favoritos.'}
      footer={
        <View style={authStyles.switchRow}>
          <Text variant="bodySmall" color="textSecondary">¿Primera vez en Mayami?</Text>
          <Button title="Crear una cuenta" variant="ghost" size="sm" onPress={() => router.replace(authTarget('/sign-up', returnTo))} />
        </View>
      }>
      {googleRetry === '1' && !error ? <Banner body="Se interrumpió el acceso. Vuelve a pulsar Continuar con Google." /> : null}
      <GoogleAccessButton purpose="login" returnTo={returnTo} disabled={busy} />
      {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
      <TextField strongOutline ref={emailInput} testID="sign-in-email" label="Correo electrónico" value={email} onChangeText={setEmail}
        error={submitted ? emailError : null} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} />
      <View>
        <TextField strongOutline ref={pw} testID="sign-in-password" label="Contraseña" value={password} onChangeText={setPassword}
          error={submitted ? passwordError : null} secureToggle autoCorrect={false} autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        <Link href={authTarget('/forgot-password', returnTo)} asChild>
          <ScalePressable accessibilityRole="link" style={authStyles.recovery}>
            <Text variant="label" color="brand">Olvidé mi contraseña</Text>
          </ScalePressable>
        </Link>
      </View>
      <Button testID="sign-in-submit" title="Iniciar sesión" size="lg" full loading={busy} disabled={googleBusy} onPress={submit} />
    </AuthScreen>
  );
}
