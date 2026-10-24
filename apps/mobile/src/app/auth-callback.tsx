import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuthLinkSession } from '@/lib/auth-link';
import { useTheme } from '@/theme';

// Opened from the "confirm your email" message: the link confirms the address and signs the buyer in.
export default function AuthCallbackScreen() {
  const t = useTheme();
  const link = useAuthLinkSession();

  if (link.status === 'working') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: t.colors.background }}>
        <ActivityIndicator color={t.colors.brand} />
        <Text color="textSecondary">Confirmando tu correo…</Text>
      </View>
    );
  }
  if (link.status === 'invalid') {
    return (
      <View testID="confirm-invalid" style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
        <EmptyState
          icon="hourglass"
          title="No pudimos confirmar tu correo"
          body={link.reason === 'expired'
            ? 'El enlace venció o ya se usó. Inicia sesión con tu correo y contraseña: si aún falta confirmar, te enviaremos otro.'
            : 'Abre el enlace del correo en este teléfono, o inicia sesión si ya confirmaste.'}
          action="Iniciar sesión"
          onAction={() => router.replace('/sign-in')}
        />
      </View>
    );
  }
  return (
    <View testID="confirm-done" style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}>
      <EmptyState icon="circle-check" title="Correo confirmado" body="Tu cuenta está lista. Agregarás tu dirección de envío en tu primera compra." />
      <View style={{ paddingHorizontal: 24 }}>
        <Button title="Empezar a comprar" size="lg" full onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}
