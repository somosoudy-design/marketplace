import { validatePassword } from '@kora/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';

/** New password and its repetition, saved for the signed-in user (after a recovery code or reset link). */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pwError = password ? validatePassword(password) : null;
  const repeatError = repeat && repeat !== password ? 'Las contraseñas no coinciden.' : null;

  const submit = async () => {
    const problem = validatePassword(password) ?? (repeat !== password ? 'Las contraseñas no coinciden.' : null);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      haptics.success();
      onDone();
    } catch (e) {
      haptics.warning();
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
      <TextField testID="reset-password" label="Contraseña nueva" value={password} onChangeText={setPassword} secureToggle autoComplete="new-password" textContentType="newPassword" helper="Mínimo 8 caracteres, con letras y números." error={pwError} />
      <TextField testID="reset-password-repeat" label="Repite la contraseña" value={repeat} onChangeText={setRepeat} secureToggle autoComplete="new-password" textContentType="newPassword" error={repeatError} onSubmitEditing={submit} />
      <Button testID="reset-submit" title="Guardar contraseña" size="lg" full loading={busy} disabled={!password || !repeat} onPress={submit} />
    </View>
  );
}
