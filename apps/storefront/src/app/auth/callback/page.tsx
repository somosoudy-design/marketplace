'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isGoogleAuthCallback, type GoogleResult } from '@kora/api';
import { browser } from '@/lib/browser';
import { authHref, safeReturnPath } from '@/lib/auth-return';

export default function Callback() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'email' | 'cancelled' | 'error'>('loading');
  const [back, setBack] = useState('/cuenta');
  const result = useRef<Promise<GoogleResult> | null>(null);
  const initialBack = useRef('/cuenta');
  const inspected = useRef(false);

  useEffect(() => {
    let active = true;
    if (!inspected.current) {
      inspected.current = true;
      const url = new URL(window.location.href);
      history.replaceState(history.state, '', '/auth/callback');
      if (isGoogleAuthCallback(url.href)) {
        const runtime = browser().runtime;
        // Only use the saved destination when the callback matches this tab's pending flow.
        const dest = runtime.google.returnDestination(url.href);
        if (dest) initialBack.current = dest;
        result.current = runtime.google.complete(url.href);
      } else {
        initialBack.current = safeReturnPath(url.searchParams.get('volver'));
      }
    }
    const completion = result.current;
    Promise.resolve(completion).then(async outcome => {
      if (!active) return;
      setBack(initialBack.current);
      if (outcome === null) {
        setState('email');
        return;
      }
      if (outcome.status === 'accepted' && await browser().runtime.claimNavigation(outcome, () => active)) {
        router.replace(outcome.returnTo);
      } else if (active) {
        setState(outcome.status === 'cancelled' ? 'cancelled' : 'error');
      }
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [router]);

  return <section className="state" aria-live="polite">
    <h1>{state === 'email' ? 'Confirma con tu código' : state === 'loading' ? 'Confirmando tu acceso…'
      : state === 'cancelled' ? 'El acceso con Google se canceló' : 'No pudimos completar el acceso con Google'}</h1>
    {state === 'email' && <p>Introduce el código que recibiste en la pantalla donde lo solicitaste.</p>}
    {state === 'error' && <p>Intenta de nuevo. Si ya tenías una cuenta con contraseña, puedes recuperar el acceso con tu correo.</p>}
    {state !== 'loading' && <Link prefetch={false} className="button" href={authHref('/cuenta', back)}>Volver al acceso</Link>}
    {(state === 'error' || state === 'email') && <Link prefetch={false} href={authHref('/recuperar', back)}>Recuperar acceso</Link>}
  </section>;
}
