'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { signUpSchema, toAppError } from '@kora/core';
import { browser } from '@/lib/browser';
import { emailWebCallbackUrl } from '@kora/api';
import { env } from '@/lib/env';
import { ArrowRight } from 'lucide-react';
import { AccessHeading, AccessPassword, BuyerAccess } from '@/components/buyer-access';
import { GoogleAccessButton } from '@/components/google-access-button';
import { VerifyCode } from '@/components/verify-code';
import { authHref, callbackPath, safeReturnPath } from '@/lib/auth-return';
function Registration() {
  const router = useRouter();
  const params = useSearchParams();
  const back = safeReturnPath(params.get('volver'));
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const signup = useMutation({
    mutationFn: async () => {
      if (!alive.current) throw new Error('El registro se canceló.');
      const p = signUpSchema.safeParse({ full_name: name, email, password });
      if (!p.success) throw Object.assign(new Error(p.error.issues[0]?.message), { name: 'ValidationError', field: p.error.issues[0]?.path[0] });
      const { data, error } = await browser().runtime.primary(() => browser().client.auth.signUp({
        email: p.data.email,
        password: p.data.password,
        options: { data: { full_name: p.data.full_name }, emailRedirectTo: emailWebCallbackUrl(env.url, window.location.origin, callbackPath(back)) },
      }));
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (!alive.current) return;
      setPassword('');
      if (data.session) router.replace(back);
      else setSent(true);
    },
  });
  if (sent)
    return (
      <BuyerAccess>
        <VerifyCode
          email={email.trim()}
          type="signup"
          onDone={() => router.replace(back)}
          resend={async () => {
            const { error } = await browser().runtime.primary(() => browser().client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: emailWebCallbackUrl(env.url, window.location.origin, callbackPath(back)) } }));
            if (error) throw error;
          }}
        />
      </BuyerAccess>
    );
  return (
    <BuyerAccess>
      <AccessHeading title="Crear cuenta">
        {back.split('?')[0] === '/checkout'
          ? 'Crea tu cuenta para continuar con tu compra.'
          : 'Usa tu cuenta tanto en la web como en la app.'}
      </AccessHeading>
      <GoogleAccessButton purpose="register" returnTo={back} disabled={signup.isPending} onBusyChange={setGoogleBusy} />
      <form method="post" className="buyer-access-form" onSubmit={(event) => {
        event.preventDefault();
        if (!signup.isPending && !googleBusy) signup.mutate();
      }}>
        <label className="access-field">
          Nombre y apellido
          <input autoComplete="name" required minLength={3} maxLength={120} value={name}
            disabled={signup.isPending || googleBusy} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="access-field">
          Correo electrónico
          <input type="email" autoComplete="email" required value={email}
            disabled={signup.isPending || googleBusy} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <AccessPassword creating value={password} onChange={setPassword} disabled={signup.isPending || googleBusy} />
        {signup.isError && <p role="alert" className="error">
          {signup.error.name === 'ValidationError' ? signup.error.message : toAppError(signup.error).message}
        </p>}
        <button className="button access-submit" aria-busy={signup.isPending} disabled={signup.isPending || googleBusy}>
          {signup.isPending ? 'Creando cuenta…' : 'Crear cuenta'} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <p className="access-legal">Consulta los <Link prefetch={false} href="/terminos">términos</Link> y la{' '}
        <Link prefetch={false} href="/privacidad">política de privacidad</Link> de Mayami.</p>
      <p className="access-switch">¿Ya tienes cuenta? <Link prefetch={false} href={authHref('/cuenta', back)}>Iniciar sesión</Link></p>
    </BuyerAccess>
  );
}

export default function Page() { return <Suspense><Registration /></Suspense>; }
