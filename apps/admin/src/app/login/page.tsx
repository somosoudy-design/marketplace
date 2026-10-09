'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/env';
import { brand } from '@/lib/brand';

export default function LoginPage() {
  const { signIn, session, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace('/');
  }, [ready, session, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-[28px] border border-line bg-surface p-8 shadow-sm">
        <span className="mb-6 grid size-11 place-items-center rounded-[14px] bg-brand font-display text-xl font-semibold text-on-brand">K</span>
        <h1 className="font-display text-[28px] font-semibold">Panel de {brand.name}</h1>
        <p className="mt-1 mb-6 text-[15px] text-ink-2">Administración y vendedores. Usa tu cuenta del marketplace.</p>
        {!isConfigured ? (
          <Notice tone="warning" title="Falta configuración">Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/admin/.env.local.</Notice>
        ) : null}
        <div className="flex flex-col gap-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="Correo">
            <Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <Input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="mt-2 h-11">Entrar</Button>
        </div>
      </form>
    </div>
  );
}
