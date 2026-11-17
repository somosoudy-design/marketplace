import { router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/States';
import { authTarget, useAuthReturn } from '@/lib/auth-navigation';
import { useTheme } from '@/theme';

export default function ResetPasswordScreen() {
  const t = useTheme();
  const returnTo = useAuthReturn();
  return (
    <View testID="reset-link-invalid" style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
      <EmptyState icon="mail" title="Cambia tu contraseña con un código"
        body="Pide un código a tu correo y escríbelo en la app para crear tu contraseña nueva."
        action="Pedir un código" onAction={() => router.replace(authTarget('/forgot-password', returnTo))} />
    </View>
  );
}
