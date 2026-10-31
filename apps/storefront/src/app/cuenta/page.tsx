'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, ShoppingBag, LogOut, ArrowRight, UserRound } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { browser } from '@/lib/browser';
import { configured } from '@/lib/env';
import { useAccount } from '@/lib/providers';
import { toAppError } from '@kora/core';
function Account() {
  const { session, ready } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const requested = params.get('volver') ?? '/cuenta';
  // Only same-origin application paths. Prevent scheme-relative redirects and backslash URL tricks.
  const back = /^\/(?![\/\\])/.test(requested) && !requested.includes('\\') ? requested : '/cuenta';
  const login = useMutation({
    mutationFn: async () => {
      const { error } = await browser().client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword('');
      router.replace(back);
      router.refresh();
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await browser().client.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      router.replace('/cuenta');
      router.refresh();
    },
  });
  if (!configured)
    return (
      <section className="state">
        <h1>Conexión pendiente</h1>
        <p>Falta configurar el backend del sitio.</p>
      </section>
    );
  if (!ready)
    return (
      <section className="state" role="status">
        Cargando tu cuenta…
      </section>
    );
  if (session)
    return (
      <div className="wrap account-page">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TU ESPACIO</span>
            <h1>Mi cuenta</h1>
            <p>{session.user.email}</p>
          </div>
          <UserRound size={30} />
        </div>
        <div className="account-options">
          <Link href="/favoritos">
            <Heart />
            <div>
              <h2>Favoritos</h2>
              <p>Tus productos guardados, también en la app.</p>
            </div>
            <ArrowRight />
          </Link>
          <Link href="/carrito">
            <ShoppingBag />
            <div>
              <h2>Mi carrito</h2>
              <p>Continúa con los productos de tu cuenta.</p>
            </div>
            <ArrowRight />
          </Link>
        </div>
        <button className="button secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
          <LogOut size={17} />
          {logout.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        {logout.isError && (
          <p role="alert" className="error">
            No pudimos cerrar la sesión. Inténtalo de nuevo.
          </p>
        )}
      </div>
    );
  const error = login.isError
    ? /invalid login credentials/i.test(login.error.message)
      ? 'Correo o contraseña incorrectos.'
      : /email not confirmed/i.test(login.error.message)
        ? 'Confirma tu correo para continuar.'
        : toAppError(login.error).message
    : '';
  return (
    <div className="wrap login-layout">
      <section className="login-intro">
        <span className="eyebrow">TU CUENTA, DONDE ESTÉS</span>
        <h1>
          Todo lo que te gusta.
          <br />
          En un mismo lugar.
        </h1>
        <p>Entra con la misma cuenta que utilizas en la aplicación.</p>
        <Link href="/buscar">
          Explorar sin iniciar sesión <ArrowRight size={17} />
        </Link>
      </section>
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!login.isPending) login.mutate();
        }}
      >
        <h2>Iniciar sesión</h2>
        <label>
          Correo electrónico
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={login.isPending}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={login.isPending}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button" disabled={login.isPending}>
          {login.isPending ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="muted">
          Registro y recuperación de cuenta continúan disponibles en la app durante esta primera entrega web.
        </p>
      </form>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
