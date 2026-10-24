import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { EmailCodeStep } from '@/components/auth/EmailCodeStep';
import { NewPasswordForm } from '@/components/auth/NewPasswordForm';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { useTheme } from '@/theme';

type Step = 'email' | 'code' | 'password' | 'done';

// Password recovery inside the app: email -> six-digit code -> new password. The code signs the user in for
// this one change; nothing is saved until Supabase accepts it.
export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { sendEmailCode } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un correo válido.');
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(email, 'recovery');
      setStep('code');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="displayL">Recupera tu acceso</Text>
              <Text color="textSecondary">Te enviaremos un código de 6 dígitos para crear una contraseña nueva.</Text>
            </View>
            {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
            <TextField testID="forgot-email" label="Correo" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={send} />
            <Button testID="forgot-submit" title="Enviar código" size="lg" full loading={busy} disabled={!email.includes('@')} onPress={send} />
            <Button title="Volver" variant="ghost" onPress={() => router.back()} />
          </>
        ) : step === 'code' ? (
          <EmailCodeStep email={email.trim()} purpose="recovery" title="Revisa tu correo" onVerified={() => setStep('password')} onChangeEmail={() => setStep('email')} />
        ) : step === 'password' ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="displayL">Crea tu contraseña nueva</Text>
              <Text color="textSecondary">La anterior deja de funcionar en cuanto guardes esta.</Text>
            </View>
            <NewPasswordForm onDone={() => setStep('done')} />
          </>
        ) : (
          <View testID="reset-done" style={{ gap: 16 }}>
            <Banner tone="success" icon="circle-check" title="Contraseña actualizada" body="Ya entraste con tu contraseña nueva. Úsala la próxima vez que inicies sesión." />
            <Button title="Continuar" size="lg" full onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
