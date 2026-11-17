import { router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/States';
import { authTarget, useAuthReturn } from '@/lib/auth-navigation';
import { useTheme } from '@/theme';

// A legacy email link has no locally initiated PKCE proof. Only the explicitly entered OTP signs in.
export default function AuthCallbackScreen() {
  const t = useTheme();
  const returnTo = useAuthReturn();
  return (
    <View testID="confirm-invalid" style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
      <EmptyState icon="mail" title="Confirma tu correo con un código"
        body="Inicia sesión y, si falta verificar tu cuenta, te enviaremos un código."
        action="Iniciar sesión" onAction={() => router.replace(authTarget('/sign-in', returnTo))} />
    </View>
  );
}
