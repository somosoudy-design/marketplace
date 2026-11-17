'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { googleProviderEnabled } from '@kora/api';
import { browser } from '@/lib/browser';
import { env } from '@/lib/env';
import { useAccount } from '@/lib/providers';

interface Props {
  purpose: 'login' | 'register';
  returnTo: string;
  disabled?: boolean;
  onBusyChange(busy: boolean): void;
}

export function GoogleAccessButton({ purpose, returnTo, disabled, onBusyChange }: Props) {
  const { ready, session } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const availability = useQuery({
    queryKey: ['google-access', env.url],
    enabled: ready && !session && typeof window !== 'undefined' && browser().runtime.enabled,
    queryFn: ({ signal }) => googleProviderEnabled(env.url, env.anon, signal),
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    mounted.current = true;
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && inFlight.current) {
        browser().runtime.google.cancel();
        inFlight.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    };
    window.addEventListener('pageshow', restore);
    return () => { mounted.current = false; window.removeEventListener('pageshow', restore); };
  }, [onBusyChange]);
  if (!availability.data || session) return null;

  async function start() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      const attempt = await browser().runtime.google.begin(purpose, returnTo);
      if (mounted.current) window.location.assign(attempt.url);
      else browser().runtime.google.cancel();
    } catch {
      if (!mounted.current) return;
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
      setError('No pudimos abrir Google. Inténtalo de nuevo o continúa con tu correo.');
    }
  }
  return (
    <div className="google-access">
      <button type="button" className="button secondary" data-testid="google-access"
        disabled={disabled || busy} aria-busy={busy} onClick={start}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/>
          <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9L31 34a12.3 12.3 0 0 1-18.3-6.5H5.9v5.3A20.4 20.4 0 0 0 24 44z"/>
          <path fill="#FBBC05" d="M12.7 27.5a12 12 0 0 1 0-7.2V15H5.9a20 20 0 0 0 0 17.8l6.8-5.3z"/>
          <path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20.4 20.4 0 0 0 5.9 15l6.8 5.3A12.1 12.1 0 0 1 24 11.8z"/>
        </svg>
        {busy ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="access-divider">o continúa con tu correo</p>
    </div>
  );
}
