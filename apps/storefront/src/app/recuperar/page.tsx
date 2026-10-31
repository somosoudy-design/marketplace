'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { validatePassword, toAppError } from '@kora/core';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
import { VerifyCode } from '@/components/verify-code';
function Recovery() {
  const params = useSearchParams();
  const router = useRouter();
  const change = params.get('cambiar') === '1';
  const { session, ready } = useAccount();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const action = useMutation({
    mutationFn: async () => {
      if (change) {
        if (!session) throw new Error('Verifica el código que enviamos a tu correo.');
        const invalid = validatePassword(password);
        if (invalid) throw Object.assign(new Error(invalid), { name: 'ValidationError' });
        const { error } = await browser().client.auth.updateUser({ password });
        if (error) throw error;
      } else {
        const { error } = await browser().client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/auth/callback?tipo=recuperar',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => setPassword(''),
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
            router.replace('/recuperar?cambiar=1');
          }}
          resend={async () => {
            const { error } = await browser().client.auth.resetPasswordForEmail(email.trim());
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
          <Link className="button" href="/cuenta">
            Volver a mi cuenta
          </Link>
        </section>
      ) : (
        <form method="post"
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!action.isPending) action.mutate();
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
          <Link className="text-link" href={change ? '/recuperar' : '/cuenta'}>
            {change ? 'Solicitar otro código' : 'Volver a iniciar sesión'}
          </Link>
        </form>
      )}
    </div>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Recovery />
    </Suspense>
  );
}
