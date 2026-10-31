'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browser } from '@/lib/browser';
export default function Callback() {
  const router = useRouter();
  const attempt = useRef<Promise<void> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (!attempt.current)
      attempt.current = (async () => {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        const auth = browser().client.auth;
        let error: unknown;
        if (url.searchParams.get('code'))
          ({ error } = await auth.exchangeCodeForSession(url.searchParams.get('code')!));
        else if (fragment.get('access_token') && fragment.get('refresh_token'))
          ({ error } = await auth.setSession({
            access_token: fragment.get('access_token')!,
            refresh_token: fragment.get('refresh_token')!,
          }));
        else throw new Error('Enlace inválido');
        const recovery = url.searchParams.get('tipo') === 'recuperar' || fragment.get('type') === 'recovery';
        history.replaceState(null, '', '/auth/callback');
        if (error) throw error;
        router.replace(recovery ? '/recuperar?cambiar=1' : '/cuenta');
      })();
    attempt.current.catch(() => {
      if (active) {
        history.replaceState(null, '', '/auth/callback');
        setFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <section className="state" role={failed ? 'alert' : 'status'}>
      <h1>{failed ? 'Este enlace no está disponible' : 'Confirmando tu cuenta…'}</h1>
      {failed && (
        <>
          <p>El enlace puede haber vencido. Solicita uno nuevo para continuar.</p>
          <Link className="button" href="/recuperar">
            Recuperar acceso
          </Link>
          <Link href="/cuenta">Iniciar sesión</Link>
        </>
      )}
    </section>
  );
}
