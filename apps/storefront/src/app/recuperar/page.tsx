'use client';
import { emailWebCallbackUrl } from '@kora/api';
import { env } from '@/lib/env';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { validatePassword, toAppError } from '@kora/core';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
import { VerifyCode } from '@/components/verify-code';
import { authHref, callbackPath, safeReturnPath } from '@/lib/auth-return';
import { updateBuyerPassword } from '@/lib/actor-api';
type RecoveryInput = { generation: number; back: string } & ({ mode: 'change'; actorId: string; password: string } | { mode: 'request'; email: string });
function RecoveryForm() {
  const params = useSearchParams();
  const router = useRouter();
  const change = params.get('cambiar') === '1';
  const back = safeReturnPath(params.get('volver'));
  const { session, ready } = useAccount();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const alive = useRef(false), generation = useRef(0);
  useEffect(() => { alive.current = true; generation.current += 1; return () => { alive.current = false; }; }, []);
  const action = useMutation({
    networkMode: 'always',
    mutationFn: async (input: RecoveryInput) => {
      const current = () => alive.current && generation.current === input.generation;
      if (!current()) throw new Error('La recuperación se canceló.');
      if (input.mode === 'change') {
        if (!input.actorId) throw new Error('Verifica el código que enviamos a tu correo.');
        const invalid = validatePassword(input.password);
        if (invalid) throw Object.assign(new Error(invalid), { name: 'ValidationError' });
        await updateBuyerPassword(input.actorId, input.password, current);
      } else {
        const { error } = await browser().client.auth.resetPasswordForEmail(input.email, {
          redirectTo: emailWebCallbackUrl(env.url, window.location.origin, callbackPath(input.back, true)),
        });
        if (error) throw error;
      }
    },
    onSuccess: (_result, input) => { if (alive.current && generation.current === input.generation) setPassword(''); },
  });
  if (!ready)
    return (
      <section className="state" role="status">
        Cargando…
      </section>
    );
  return (
    <div className="wrap login-layout">
      <section className="login-intro">
        <h1>
          Recupera el acceso
          <br />a tu cuenta.
        </h1>
        <p>Usa el correo con el que te registraste.</p>
      </section>
      {action.isSuccess && !change ? (
        <VerifyCode
          email={email.trim()}
          type="recovery"
          onDone={() => {
            action.reset();
            router.replace(`/recuperar?cambiar=1&volver=${encodeURIComponent(back)}`);
          }}
          resend={async () => {
            if (!alive.current) throw new Error('El reenvío se canceló.');
            const { error } = await browser().client.auth.resetPasswordForEmail(email.trim(), { redirectTo: emailWebCallbackUrl(env.url, window.location.origin, callbackPath(back, true)) });
            if (error) throw error;
          }}
        />
      ) : action.isSuccess ? (
        <section className="state">
          <h2>{change ? 'Contraseña actualizada' : 'Revisa tu correo'}</h2>
          <p>
            {change
              ? 'Ya puedes seguir comprando.'
              : 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.'}
          </p>
          <Link prefetch={false} className="button" href={back}>
            {back === '/cuenta' ? 'Volver a mi cuenta' : 'Continuar'}
          </Link>
        </section>
      ) : (
        <form method="post"
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!action.isPending) action.mutate(change ? { mode: 'change', actorId: session?.user.id ?? '', password, back, generation: generation.current } : { mode: 'request', email: email.trim(), back, generation: generation.current });
          }}
        >
          <h2>{change ? 'Nueva contraseña' : 'Restablecer contraseña'}</h2>
          {change ? (
            <label>
              Nueva contraseña
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={action.isPending || !session}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Correo electrónico
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={action.isPending}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {change && !session && (
            <p className="error">Verifica un código de recuperación para cambiar la contraseña.</p>
          )}
          {action.isError && (
            <p role="alert" className="error">
              {action.error.name === 'ValidationError' ? action.error.message : toAppError(action.error).message}
            </p>
          )}
          <button className="button" disabled={action.isPending || (change && !session)}>
            {action.isPending ? 'Procesando…' : change ? 'Guardar contraseña' : 'Enviar código'}
          </button>
          <Link prefetch={false} className="text-link" href={authHref(change ? '/recuperar' : '/cuenta', back)}>
            {change ? 'Solicitar otro código' : 'Volver a iniciar sesión'}
          </Link>
        </form>
      )}
    </div>
  );
}
function Recovery() {
  const params = useSearchParams();
  const { session } = useAccount();
  // Keep OTP mounted when it accepts a session; reset only the protected password form on account change.
  const key = params.get('cambiar') === '1' ? 'password:' + (session?.user.id ?? 'guest') : 'request';
  return <RecoveryForm key={key} />;
}
export default function Page() {
  return (
    <Suspense>
      <Recovery />
    </Suspense>
  );
}
