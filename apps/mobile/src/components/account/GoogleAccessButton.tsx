import { googleProviderEnabled } from '@kora/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/States';
import { useAuth } from '@/lib/auth';
import { finishAuth } from '@/lib/auth-navigation';
import { env, isConfigured } from '@/lib/env';

export function GoogleAccessButton({ purpose, returnTo, disabled }: {
  purpose: 'login' | 'register'; returnTo?: string; disabled: boolean;
}) {
  const auth = useAuth();
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const pending = useRef(false);
  const cancel = useRef(auth.cancelGoogle);
  useEffect(() => { cancel.current = auth.cancelGoogle; }, [auth.cancelGoogle]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pending.current) cancel.current();
    };
  }, []);
  const provider = useQuery({
    queryKey: ['google-auth-provider', env.supabaseUrl],
    queryFn: ({ signal }) => googleProviderEnabled(env.supabaseUrl, env.supabaseAnonKey, signal),
    enabled: isConfigured && auth.googleEnabled && !auth.user,
    staleTime: 60_000, retry: 1,
  });
  if (!auth.googleEnabled || !isConfigured) return null;
  if (provider.isError && !provider.data) {
    return <Button variant="ghost" title="Reintentar acceso con Google" loading={provider.isFetching}
      onPress={() => { void provider.refetch(); }} />;
  }
  if (!provider.data) return null;
  const blocked = disabled || !auth.ready || !!auth.user || auth.googleBusy;
  const start = async () => {
    if (blocked || pending.current) return;
    pending.current = true;
    setError('');
    try {
      const result = await auth.signInWithGoogle(purpose, returnTo ?? '/account');
      if (!mounted.current) return;
      if (result.status === 'accepted') {
        if (await auth.claimGoogleNavigation(result, () => mounted.current)) {
          pending.current = false;
          finishAuth(result.returnTo);
        }
      } else if (result.status === 'uncertain') {
        setError('No pudimos confirmar el acceso. Revisa tu cuenta antes de repetirlo.');
      } else if (result.status !== 'cancelled') {
        setError('No pudimos continuar con Google. Si ya usabas contraseña, puedes recuperarla con tu correo.');
      }
    } catch {
      if (mounted.current) setError('No pudimos continuar con Google. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      pending.current = false;
    }
  };
  return <View style={styles.group}>
    {error ? <Banner tone="danger" body={error} /> : null}
    <Pressable testID="google-access" accessibilityRole="button" accessibilityLabel="Continuar con Google"
      accessibilityState={{ disabled: blocked, busy: auth.googleBusy }} disabled={blocked} onPress={start}
      style={({ pressed }) => [styles.button, (blocked || pressed) && styles.dimmed]}>
      {auth.googleBusy ? <ActivityIndicator size="small" color="#1f1f1f" /> :
        <Image accessibilityIgnoresInvertColors source={require('../../../assets/images/auth/google-g.png')} style={styles.logo} />}
      <Text style={styles.label}>Continuar con Google</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  button: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', gap: 12,
    alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#747775' },
  dimmed: { opacity: 0.68 },
  logo: { width: 20, height: 20 },
  label: { color: '#1f1f1f', fontSize: 16, fontWeight: '500' },
});
