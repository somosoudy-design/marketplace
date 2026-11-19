'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, ShoppingBag, LogOut, ArrowRight, UserRound, Bell, MapPin } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { browser } from '@/lib/browser';
import { AccessHeading, AccessPassword, BuyerAccess } from '@/components/buyer-access';
import { GoogleAccessButton } from '@/components/google-access-button';
import { StoreAccountLinks } from '@/components/store-account-links';
import { configured } from '@/lib/env';
import { useAccount } from '@/lib/providers';
import { toAppError } from '@kora/core';
import { authHref, guestReturnPath, safeReturnPath } from '@/lib/auth-return';
function Account() {
  const { session, ready } = useAccount();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const requested = params.get('volver') ?? '/cuenta';
  // Only same-origin application paths. Prevent scheme-relative redirects and backslash URL tricks.
  const back = safeReturnPath(requested);
  const login = useMutation({
    mutationFn: async () => {
      if (!alive.current) throw new Error('El inicio de sesión se canceló.');
      const { error } = await browser().runtime.primary(() => browser().client.auth.signInWithPassword({ email: email.trim(), password }));
      if (error) throw error;
    },
    onSuccess: () => {
      if (!alive.current) return;
      setPassword('');
      if (back !== window.location.pathname + window.location.search) router.replace(back);
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await browser().runtime.primary(() => browser().client.auth.signOut());
      if (error) throw error;
    },
    onSuccess: () => {
      if (!alive.current) return;
      if (window.location.pathname + window.location.search !== '/cuenta') router.replace('/cuenta');
    },
  });
  if (!configured)
    return (
      <section className="state">
        <h1>Conexión pendiente</h1>
        <p>El acceso a tu cuenta no está disponible en este momento. Vuelve a intentarlo más tarde.</p>
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
        <StoreAccountLinks />
        <div className="account-options">
          <Link prefetch={false} href="/pedidos">
            <ShoppingBag />
            <div>
              <h2>Mis pedidos</h2>
              <p>Pagos, entregas y seguimiento.</p>
            </div>
            <ArrowRight />
          </Link>
          <Link prefetch={false} href="/direcciones">
            <MapPin />
            <div>
              <h2>Mis direcciones</h2>
              <p>Elige dónde recibir tus compras.</p>
            </div>
            <ArrowRight />
          </Link>
          <Link prefetch={false} href="/notificaciones">
            <Bell />
            <div>
              <h2>Notificaciones</h2>
              <p>Novedades de tus pedidos y pagos.</p>
            </div>
            <ArrowRight />
          </Link>
          <Link prefetch={false} href="/favoritos">
            <Heart />
            <div>
              <h2>Favoritos</h2>
              <p>Tus productos guardados, también en la app.</p>
            </div>
            <ArrowRight />
          </Link>
          <Link prefetch={false} href="/carrito">
            <ShoppingBag />
            <div>
              <h2>Mi carrito</h2>
              <p>Continúa con los productos de tu cuenta.</p>
            </div>
            <ArrowRight />
          </Link>
        </div>
        <section className="profile-management" aria-label="Perfil">
          <h2>Perfil</h2>
          <Link prefetch={false} href="/eliminar-cuenta">Eliminar cuenta</Link>
        </section>
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
    <BuyerAccess>
      <AccessHeading title="Iniciar sesión">
        {back.split('?')[0] === '/checkout'
          ? 'Ingresa para continuar con tu compra.'
          : 'Accede a tus pedidos y favoritos de MAYAMI.'}
      </AccessHeading>
      <GoogleAccessButton purpose="login" returnTo={back} disabled={login.isPending} onBusyChange={setGoogleBusy} />
      <form method="post" className="buyer-access-form" onSubmit={(event) => {
        event.preventDefault();
        if (!login.isPending && !googleBusy) login.mutate();
      }}>
        <label className="access-field">
          Correo electrónico
          <input type="email" autoComplete="username" required value={email}
            disabled={login.isPending || googleBusy} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <AccessPassword value={password} onChange={setPassword} disabled={login.isPending || googleBusy}
          recovery={<Link prefetch={false} href={authHref('/recuperar', back)}>¿Olvidaste tu contraseña?</Link>} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button access-submit" aria-busy={login.isPending} disabled={login.isPending || googleBusy}>
          {login.isPending ? 'Ingresando…' : 'Ingresar'} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <p className="access-switch">¿Aún no tienes cuenta? <Link prefetch={false} href={authHref('/registro', back)}>Crear una cuenta</Link></p>
      <Link prefetch={false} className="access-guest" href={guestReturnPath(back)}>
        Explorar sin iniciar sesión <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </BuyerAccess>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
