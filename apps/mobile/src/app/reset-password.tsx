import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { NewPasswordForm } from '@/components/auth/NewPasswordForm';
import { Button } from '@/components/ui/Button';
import { Banner, EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuthLinkSession } from '@/lib/auth-link';
import { useTheme } from '@/theme';

// Opened from a "reset password" email link (emails sent before the six-digit codes, or link templates). The link
// signs the user in for this one purpose; the new password is saved with the session it created.
export default function ResetPasswordScreen() {
  const t = useTheme();
  const link = useAuthLinkSession();
  const [done, setDone] = useState(false);

  if (link.status === 'working') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: t.colors.background }}>
        <ActivityIndicator color={t.colors.brand} />
        <Text color="textSecondary">Verificando el enlace…</Text>
      </View>
    );
  }
  if (link.status === 'invalid') {
    return (
      <View testID="reset-link-invalid" style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
        <EmptyState
          icon="hourglass"
          title={link.reason === 'missing' ? 'Cambia tu contraseña con un código' : 'Este enlace ya no sirve'}
          body={link.reason === 'missing'
            ? 'Para cambiar tu contraseña, pide un código de 6 dígitos a tu correo.'
            : 'Los enlaces para cambiar la contraseña vencen y se pueden usar una sola vez. Pide un código de 6 dígitos a tu correo.'}
          action="Pedir un código"
          onAction={() => router.replace('/forgot-password')}
        />
      </View>
    );
  }
  if (done) {
    return (
      <View testID="reset-done" style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: t.colors.background }}>
        <Banner tone="success" icon="circle-check" title="Contraseña actualizada" body="Ya entraste con tu contraseña nueva. Úsala la próxima vez que inicies sesión." />
        <Button title="Ir a la tienda" size="lg" full onPress={() => router.replace('/')} />
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, width: '100%', maxWidth: 480, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text variant="displayL">Crea tu contraseña nueva</Text>
          <Text color="textSecondary">La anterior deja de funcionar en cuanto guardes esta.</Text>
        </View>
        <NewPasswordForm onDone={() => setDone(true)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
