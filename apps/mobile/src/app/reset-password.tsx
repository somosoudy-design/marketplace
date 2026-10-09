import { validatePassword } from '@kora/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner, EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { useAuthLinkSession } from '@/lib/auth-link';
import { useTheme } from '@/theme';

// Opened from the "reset password" email. The link signs the user in for this one purpose; the new password
// is saved with the session it created.
export default function ResetPasswordScreen() {
  const t = useTheme();
  const link = useAuthLinkSession();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const pwError = password ? validatePassword(password) : null;
  const repeatError = repeat && repeat !== password ? 'Las contraseñas no coinciden.' : null;

  const submit = async () => {
    const problem = validatePassword(password) ?? (repeat !== password ? 'Las contraseñas no coinciden.' : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

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
          title="Este enlace ya no sirve"
          body={link.reason === 'missing'
            ? 'Abre el enlace del correo en este teléfono para crear tu contraseña nueva.'
            : 'Los enlaces para cambiar la contraseña vencen y se pueden usar una sola vez. Pide uno nuevo y ábrelo aquí.'}
          action="Pedir otro enlace"
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
        {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
        <TextField testID="reset-password" label="Contraseña nueva" value={password} onChangeText={setPassword} secureToggle autoComplete="new-password" textContentType="newPassword" helper="Mínimo 8 caracteres, con letras y números." error={pwError} />
        <TextField testID="reset-password-repeat" label="Repite la contraseña" value={repeat} onChangeText={setRepeat} secureToggle autoComplete="new-password" textContentType="newPassword" error={repeatError} onSubmitEditing={submit} />
        <Button testID="reset-submit" title="Guardar contraseña" size="lg" full loading={busy} disabled={!password || !repeat} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
