import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { EmailCodeStep } from '@/components/auth/EmailCodeStep';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

// After "Crear cuenta" (or a sign-in with an unconfirmed address): the buyer types the code from the email and
// the account becomes active, signed in, without leaving the app.
export default function VerifyEmailScreen() {
  const t = useTheme();
  const { email = '', resend } = useLocalSearchParams<{ email?: string; resend?: string }>();
  const [done, setDone] = useState(false);
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(leave, 1600);
    return () => clearTimeout(id);
  }, [done]);

  if (!email) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
        <EmptyState icon="mail" title="Falta tu correo" body="Crea tu cuenta o inicia sesión para recibir el código." action="Crear cuenta" onAction={() => router.replace('/sign-up')} />
      </View>
    );
  }
  if (done) {
    return (
      <View testID="verify-done" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14, backgroundColor: t.colors.background }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: t.colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="circle-check" size={38} color={t.colors.success} />
        </View>
        <Text variant="displayL" align="center">Cuenta confirmada</Text>
        <Text color="textSecondary" align="center">Ya puedes comprar, pagar y seguir tus pedidos. La dirección de envío la agregas en tu primera compra.</Text>
        <Button title="Continuar" size="lg" full onPress={leave} style={{ marginTop: 8 }} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <EmailCodeStep
          email={email}
          purpose="signup"
          title="Confirma tu correo"
          sendOnMount={resend === '1'}
          onVerified={() => setDone(true)}
          onChangeEmail={() => router.replace('/sign-up')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
