'use client';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { browser } from '@/lib/browser';
export function VerifyCode({
  email,
  type,
  onDone,
  resend,
}: {
  email: string;
  type: 'signup' | 'recovery';
  onDone: () => void;
  resend: () => Promise<void>;
}) {
  const [code, setCode] = useState(''),
    [cooldown, setCooldown] = useState(30);
  useEffect(() => {
    const timer = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await browser().client.auth.verifyOtp({ email, token: code.trim(), type });
      if (error) throw error;
    },
    onSuccess: onDone,
  });
  const again = useMutation({ mutationFn: resend, onSuccess: () => setCooldown(30) });
  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!verify.isPending) verify.mutate();
      }}
    >
      <h2>Revisa tu correo</h2>
      <p>
        Escribe el código de seis dígitos que enviamos a tu correo. Si no llega, revisa la carpeta de correo no deseado.
      </p>
      <label>
        Código de verificación
        <input
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          disabled={verify.isPending || again.isPending}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      {verify.isError && (
        <p role="alert" className="error">
          El código no es válido o venció. Revísalo o solicita otro.
        </p>
      )}
      {again.isError && (
        <p role="alert" className="error">
          No pudimos reenviar el código. Espera un momento e intenta de nuevo.
        </p>
      )}
      <button className="button" disabled={verify.isPending || again.isPending || code.length !== 6}>
        {verify.isPending ? 'Verificando…' : 'Verificar código'}
      </button>
      <button
        className="text-button"
        type="button"
        disabled={cooldown > 0 || verify.isPending || again.isPending}
        onClick={() => again.mutate()}
      >
        {again.isPending ? 'Reenviando…' : cooldown > 0 ? `Reenviar código en ${cooldown} s` : 'Reenviar código'}
      </button>
    </form>
  );
}
