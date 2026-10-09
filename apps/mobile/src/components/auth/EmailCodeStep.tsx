import { OTP_LENGTH, OTP_RESEND_SECONDS, OTP_VALID_MINUTES, authErrorKind, authErrorMessage } from '@kora/core';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { CodeInput } from '@/components/ui/CodeInput';
import { Icon } from '@/components/ui/Icon';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth, type EmailCodePurpose } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  email: string;
  purpose: EmailCodePurpose;
  title: string;
  /** Ask for a fresh code when the step opens (a sign-in found the account unconfirmed). */
  sendOnMount?: boolean;
  onVerified: () => void;
  onChangeEmail: () => void;
}

// The six-digit code Supabase Auth emails, checked against Supabase itself: the account (or the password
// change) is only confirmed when the server accepts the code.
export function EmailCodeStep({ email, purpose, title, sendOnMount, onVerified, onChangeEmail }: Props) {
  const { colors } = useTheme();
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [sentAt, setSentAt] = useState(() => (sendOnMount ? 0 : Date.now()));
  // a clock rather than a countdown of ticks: timers stop while the buyer reads the email in another app
  const [now, setNow] = useState(() => Date.now());
  const [resendAt, setResendAt] = useState(() => (sendOnMount ? 0 : Date.now() + OTP_RESEND_SECONDS * 1000));
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const counting = wait > 0;
  const allowResendIn = (seconds: number) => {
    const t = Date.now();
    setNow(t);
    setResendAt(t + seconds * 1000);
  };
  const input = useRef<TextInput>(null);

  const verify = async (value = code) => {
    if (value.length < OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, value, purpose);
      haptics.success();
      onVerified();
    } catch (e) {
      haptics.warning();
      const expired = authErrorKind(e).kind === 'invalid_code' && sentAt > 0 && Date.now() - sentAt > OTP_VALID_MINUTES * 60_000;
      setError(expired ? 'Este código ya venció. Pide uno nuevo.' : authErrorMessage(e));
      setErrorKey((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const resend = async (onOpen = false) => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await sendEmailCode(email, purpose);
      setSentAt(Date.now());
      allowResendIn(OTP_RESEND_SECONDS);
      setCode('');
      setNotice(onOpen ? 'Tu correo aún no está confirmado. Te enviamos un código.' : 'Te enviamos un código nuevo. Usa el más reciente.');
      input.current?.focus();
    } catch (e) {
      const k = authErrorKind(e);
      if (k.kind === 'resend_too_soon') {
        allowResendIn(k.seconds!);
        if (onOpen) return setNotice('Ya te enviamos un código hace poco. Usa el último que recibiste.');
      }
      setError(authErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    if (!sendOnMount) return;
    const id = setTimeout(() => resend(true), 0);
    return () => clearTimeout(id);
    // once, when the step opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 10 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={purpose === 'signup' ? 'mail' : 'key-round'} size={26} color={colors.brand} />
        </View>
        <Text variant="displayL">{title}</Text>
        <Text color="textSecondary">
          Escribe el código de {OTP_LENGTH} dígitos que enviamos a <Text variant="subtitle">{email}</Text>
        </Text>
      </View>
      {notice ? <Banner tone="brand" icon="mail-check" body={notice} /> : null}
      <View style={{ gap: 10 }}>
        <CodeInput ref={input} testID="code-input" value={code} onChange={setCode} onComplete={verify} errorKey={errorKey} disabled={busy} autoFocus />
        <View style={{ minHeight: 18, alignItems: 'center' }}>
          {error ? (
            <Text testID="code-error" variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">{error}</Text>
          ) : (
            <Text variant="caption" color="textMuted" align="center">El código vence en {OTP_VALID_MINUTES} minutos.</Text>
          )}
        </View>
      </View>
      <Button testID="code-submit" title={busy ? 'Verificando…' : purpose === 'signup' ? 'Confirmar cuenta' : 'Continuar'} size="lg" full loading={busy} disabled={code.length < OTP_LENGTH} onPress={() => verify()} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 32 }}>
        <Text color="textSecondary">¿No te llegó?</Text>
        {sending ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : wait > 0 ? (
          <Text testID="code-resend-wait" color="textMuted" tabular>Reenviar en {clock(wait)}</Text>
        ) : (
          <Pressable testID="code-resend" accessibilityRole="button" hitSlop={10} onPress={() => resend()}>
            <Text variant="label" color="brand">Reenviar código</Text>
          </Pressable>
        )}
      </View>
      <Text variant="caption" color="textMuted" align="center">
        Revisa también las carpetas de spam y promociones.{' '}
        <Text testID="code-change-email" variant="caption" color="brand" onPress={onChangeEmail} accessibilityRole="link">Cambiar correo</Text>
      </Text>
    </View>
  );
}
