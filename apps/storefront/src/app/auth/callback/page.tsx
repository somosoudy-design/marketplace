'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browser } from '@/lib/browser';
import { authHref, safeReturnPath } from '@/lib/auth-return';
export default function Callback() {
  const router = useRouter();
  const attempt = useRef<Promise<{ destination: string; recovery: boolean; success: boolean }> | null>(null);
  const [failed, setFailed] = useState(false);
  const [back, setBack] = useState('/cuenta');
  useEffect(() => {
    let active = true;
    if (!attempt.current)
      attempt.current = (async () => {
        const url = new URL(window.location.href);
        const destination = safeReturnPath(url.searchParams.get('volver'));
        const fragment = new URLSearchParams(url.hash.slice(1));
        const recovery = url.searchParams.get('tipo') === 'recuperar' || fragment.get('type') === 'recovery';
        // Remove credentials while this callback is still mounted, before the first await.
        history.replaceState(null, '', '/auth/callback');
        try {
          const auth = browser().client.auth; let error: unknown;
          if (url.searchParams.get('code')) ({ error } = await auth.exchangeCodeForSession(url.searchParams.get('code')!));
          else if (fragment.get('access_token') && fragment.get('refresh_token')) ({ error } = await auth.setSession({ access_token: fragment.get('access_token')!, refresh_token: fragment.get('refresh_token')! }));
          else throw new Error('Enlace inválido');
          return { destination, recovery, success: !error };
        } catch { return { destination, recovery, success: false }; }
      })();
    attempt.current.then(result => {
      if (!active) return;
      setBack(result.destination);
      if (!result.success) { setFailed(true); return; }
      router.replace(result.recovery ? `/recuperar?cambiar=1&volver=${encodeURIComponent(result.destination)}` : result.destination);
    }).catch(() => { if (active) setFailed(true); });
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
          <Link prefetch={false} className="button" href={authHref('/recuperar', back)}>
            Recuperar acceso
          </Link>
          <Link prefetch={false} href={authHref('/cuenta', back)}>Iniciar sesión</Link>
        </>
      )}
    </section>
  );
}
