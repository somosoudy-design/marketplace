import { validatePassword } from '@kora/core';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { assertCurrentActor } from '@/lib/actor-api';
import { haptics } from '@/lib/haptics';

/** Keep OTP alive in the parent; only protected password inputs reset when the account changes. */
export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  return <PasswordFields key={user?.id ?? 'guest'} actorId={user?.id ?? null} onDone={onDone} />;
}
function PasswordFields({ actorId, onDone }: { actorId: string | null; onDone: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(false), generation = useRef(0), submitting = useRef(false);
  useEffect(() => { alive.current = true; generation.current += 1; return () => { alive.current = false; }; }, []);
  const pwError = password ? validatePassword(password) : null;
  const repeatError = repeat && repeat !== password ? 'Las contraseñas no coinciden.' : null;

  const submit = async () => {
    if (submitting.current) return;
    const problem = validatePassword(password) ?? (repeat !== password ? 'Las contraseñas no coinciden.' : null);
    if (problem) return setError(problem);
    if (!actorId) return setError('Tu verificación venció. Pide un código nuevo.');
    const input = { actorId, password, generation: generation.current };
    const current = () => alive.current && generation.current === input.generation;
    submitting.current = true; setBusy(true); setError(null);
    try {
      await assertCurrentActor(input.actorId);
      if (!current()) return;
      await updatePassword(input.password, current);
      await assertCurrentActor(input.actorId);
      if (!current()) return;
      haptics.success(); onDone();
    } catch (cause) {
      if (current()) { haptics.warning(); setError(authErrorMessage(cause)); }
    } finally {
      submitting.current = false;
      if (current()) setBusy(false);
    }
  };

  return (
    <View style={{ gap: 18 }}>
      {!actorId ? <Banner tone="warning" icon="circle-alert" body="Tu sesión terminó. Verifica tu acceso de nuevo para continuar." /> : null}
      {error ? <Banner tone="danger" icon="circle-alert" body={error} /> : null}
      <TextField testID="reset-password" label="Contraseña nueva" value={password} onChangeText={setPassword} secureToggle autoComplete="new-password" textContentType="newPassword" helper="Mínimo 8 caracteres, con letras y números." error={pwError} />
      <TextField testID="reset-password-repeat" label="Repite la contraseña" value={repeat} onChangeText={setRepeat} secureToggle autoComplete="new-password" textContentType="newPassword" error={repeatError} onSubmitEditing={submit} />
      <Button testID="reset-submit" title="Guardar contraseña" size="lg" full loading={busy} disabled={!actorId || !password || !repeat} onPress={submit} />
    </View>
  );
}
