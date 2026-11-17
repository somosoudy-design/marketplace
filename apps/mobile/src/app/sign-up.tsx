import { LegalLinks } from '@/components/account/LegalLinks';
import { GoogleAccessButton } from '@/components/account/GoogleAccessButton';
import { validatePassword } from '@kora/core';
import { Link, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { AuthScreen, authStyles } from '@/components/auth/AuthScreen';
import { ScalePressable } from '@/components/ui/Pressable';
import { authTarget, finishAuth, useAuthReturn } from '@/lib/auth-navigation';

export default function SignUpScreen() {
  const returnTo = useAuthReturn();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { signUp, googleBusy } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<TextInput>(null);
  const emailInput = useRef<TextInput>(null);
  const pw = useRef<TextInput>(null);
  const [submitted, setSubmitted] = useState(false);
  const [passwordVisited, setPasswordVisited] = useState(false);
  const nameError = name.trim().length < 2 ? 'Escribe tu nombre.' : null;
  const emailError = /^\S+@\S+\.\S+$/.test(email.trim()) ? null : 'Escribe un correo válido.';
  const passwordError = validatePassword(password);

  const submit = async () => {
    if (busy || googleBusy) return;
    setSubmitted(true);
    setError(null);
    if (nameError) return nameInput.current?.focus();
    if (emailError) return emailInput.current?.focus();
    if (passwordError) return pw.current?.focus();
    setBusy(true);
    try {
      const r = await signUp(email, password, name);
      if (!mounted.current) return;
      if (r.needsConfirmation) router.replace(authTarget('/verify-email', returnTo, { email: email.trim() }));
      else finishAuth(returnTo);
    } catch (e) {
      if (!mounted.current) return;
      setError(authErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <AuthScreen title="Crea tu cuenta"
      description={returnTo?.split('?')[0] === '/checkout' ? 'Regístrate para continuar con tu compra.' : 'Guarda tus favoritos y sigue tus pedidos.'}
      footer={
        <View>
          <View style={authStyles.switchRow}>
            <Text variant="bodySmall" color="textSecondary">¿Ya tienes cuenta?</Text>
            <Link href={authTarget('/sign-in', returnTo)} replace asChild>
              <ScalePressable accessibilityRole="link" style={authStyles.switchAction}>
                <Text variant="label" color="brand">Inicia sesión</Text>
              </ScalePressable>
            </Link>
          </View>
          <Text variant="caption" color="textSecondary" align="center">
            Al crear tu cuenta aceptas los términos y la política de privacidad. Puedes solicitar la eliminación de tu cuenta.
          </Text>
          <LegalLinks compact />
        </View>
      }>
      <GoogleAccessButton purpose="register" returnTo={returnTo} disabled={busy} />
      {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
      <TextField strongOutline ref={nameInput} testID="sign-up-name" label="Nombre y apellido" value={name} onChangeText={setName}
        error={submitted ? nameError : null} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailInput.current?.focus()} />
      <TextField strongOutline ref={emailInput} testID="sign-up-email" label="Correo electrónico" value={email} onChangeText={setEmail}
        error={submitted ? emailError : null} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => pw.current?.focus()} />
      <TextField strongOutline ref={pw} testID="sign-up-password" label="Contraseña" value={password} onChangeText={setPassword}
        secureToggle autoCorrect={false} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit}
        onBlur={() => setPasswordVisited(true)} helper="Usa al menos 8 caracteres, con letras y números."
        error={submitted || (passwordVisited && password) ? passwordError : null} />
      <Button testID="sign-up-submit" title="Crear cuenta" size="lg" full loading={busy} disabled={googleBusy} onPress={submit} />
    </AuthScreen>
  );
}
