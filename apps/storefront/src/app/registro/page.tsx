'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { signUpSchema, toAppError } from '@kora/core';
import { browser } from '@/lib/browser';
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
  const signup = useMutation({
    mutationFn: async () => {
      if (!alive.current) throw new Error('El registro se canceló.');
      const p = signUpSchema.safeParse({ full_name: name, email, password });
      if (!p.success) throw Object.assign(new Error(p.error.issues[0]?.message), { name: 'ValidationError' });
      const { data, error } = await browser().client.auth.signUp({
        email: p.data.email,
        password: p.data.password,
        options: { data: { full_name: p.data.full_name }, emailRedirectTo: window.location.origin + callbackPath(back) },
      });
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
      <div className="wrap commerce-page">
        <VerifyCode
          email={email.trim()}
          type="signup"
          onDone={() => router.replace(back)}
          resend={async () => {
            const { error } = await browser().client.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin + callbackPath(back) } });
            if (error) throw error;
          }}
        />
      </div>
    );
  return (
    <div className="wrap login-layout">
      <section className="login-intro">
        <span className="eyebrow">BIENVENIDO</span>
        <h1>
          Tus próximos hallazgos
          <br />
          empiezan aquí.
        </h1>
        <p>Una cuenta para comprar en la web y en la aplicación.</p>
      </section>
      <form method="post"
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!signup.isPending) signup.mutate();
        }}
      >
        <h2>Crear cuenta</h2>
        <label>
          Nombre y apellido
          <input
            value={name}
            autoComplete="name"
            required
            minLength={3}
            maxLength={120}
            disabled={signup.isPending}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            autoComplete="email"
            required
            disabled={signup.isPending}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            aria-label="Contraseña"
            aria-describedby="signup-password-help"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={signup.isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small id="signup-password-help" className="muted">
            Mínimo 8 caracteres con letras y números.
          </small>
        </label>
        {signup.isError && (
          <p role="alert" className="error">
            {signup.error.name === 'ValidationError' ? signup.error.message : toAppError(signup.error).message}
          </p>
        )}
        <p className="legal-note">
          Consulta los <Link prefetch={false} href="/terminos">términos</Link> y la{' '}
          <Link prefetch={false} href="/privacidad">política de privacidad</Link> antes de crear tu cuenta.
        </p>
        <button className="button" disabled={signup.isPending}>
          {signup.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <Link prefetch={false} href={authHref('/cuenta', back)} className="text-link">
          Ya tengo cuenta
        </Link>
      </form>
    </div>
  );
}

export default function Page() { return <Suspense><Registration /></Suspense>; }
