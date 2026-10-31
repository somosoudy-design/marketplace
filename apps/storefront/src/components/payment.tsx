'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newIdempotencyKey, type Payment, type PaymentQuote } from '@kora/api';
import { validateUpload, normalizeReference, PAYMENT_RECORD_LABEL } from '@kora/core';
import { CreditCard, Check, Clock3 } from 'lucide-react';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { currency, date, safeExternal } from '@/lib/purchase';
import { ownOrderKey, useOwnOrder } from './orders';
import { Empty } from './states';
import { QueryError } from './buyer';
export function PaymentPage({ buyerId, id }: { buyerId: string; id: string }) {
  const order = useOwnOrder(buyerId, id);
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: () => browser().api.payments.methods() });
  const qc = useQueryClient();
  const [method, setMethod] = useState('');
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const create = useMutation({
    mutationFn: () => browser().api.payments.quote(id, method),
    onSuccess: (q) => {
      setQuote(q);
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('payment-heading')?.focus();
    },
  });
  const cancel = useMutation({
    mutationFn: (payment: string) => browser().api.payments.cancelOnline(payment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ownOrderKey(buyerId, id) }),
  });
  if (order.isPending)
    return (
      <section className="state" role="status">
        Cargando opciones de pago…
      </section>
    );
  if (order.isError) return <QueryError error={order.error} retry={() => order.refetch()} />;
  const o = order.data;
  if (!o)
    return (
      <Empty
        title="Este pedido no está disponible"
        text="Comprueba el enlace y la cuenta de la compra."
        href="/pedidos"
        action="Ver mis pedidos"
      />
    );
  const pending = o.payments.filter((p) => p.status === 'pending_verification' || p.status === 'processing');
  const next = o.payment_obligations.find((p) => p.status === 'pending' || p.status === 'partially_paid');
  return (
    <div className="wrap commerce-page">
      <Link href={`/pedidos/${id}`} className="text-link">
        ← Ver mi pedido
      </Link>
      <div className="commerce-heading">
        <span className="eyebrow">PEDIDO {o.number}</span>
        <h1 id="payment-heading" tabIndex={-1}>
          {pending.length ? 'Estado del pago' : quote ? 'Completa tu pago' : 'Elige cómo pagar'}
        </h1>
        <p>Tu pedido está guardado. El pago se confirma después de su revisión.</p>
      </div>
      <div className="purchase-layout">
        <section className="purchase-content">
          {o.status === 'cancelled' ? (
            <p className="notice">Este pedido fue cancelado y no admite nuevos pagos.</p>
          ) : pending.length ? (
            pending.map((p) => (
              <div className="payment-pending" key={p.id}>
                <Clock3 size={30} />
                <h2>
                  {p.status === 'pending_verification' ? 'Estamos verificando tu pago' : 'Tu pago está en proceso'}
                </h2>
                <p>
                  {p.number} · {currency(p.amount, p.currency)}
                </p>
                <p>{p.reference ? `Referencia ${p.reference}` : 'Consulta aquí el resultado del pago.'}</p>
                <p>No necesitas enviarlo otra vez. Te avisaremos cuando cambie su estado.</p>
                {p.status === 'processing' && safeExternal(p.provider_checkout_url) && (
                  <a
                    className="button"
                    href={safeExternal(p.provider_checkout_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Retomar pago
                  </a>
                )}
                {p.status === 'processing' && p.provider && (
                  <button
                    className="button secondary"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (window.confirm('Cancela este intento sólo si no completaste el pago. ¿Deseas continuar?'))
                        cancel.mutate(p.id);
                    }}
                  >
                    Cancelar intento
                  </button>
                )}
                <Link className="button secondary" href={`/pedidos/${id}`}>
                  Ver mi pedido
                </Link>
              </div>
            ))
          ) : !next ? (
            <div className="payment-pending">
              <Check />
              <h2>Este pedido no tiene pagos pendientes</h2>
              <Link className="button" href={`/pedidos/${id}`}>
                Ver mi pedido
              </Link>
            </div>
          ) : quote ? (
            <PaymentForm
              key={quote.id}
              quote={quote}
              buyerId={buyerId}
              orderId={id}
              onBack={() => setQuote(null)}
              onSent={async () => {
                setQuote(null);
                await qc.invalidateQueries({ queryKey: ownOrderKey(buyerId, id) });
              }}
            />
          ) : (
            <>
              {methods.isPending && <p role="status">Cargando métodos…</p>}
              {methods.isError && <QueryError error={methods.error} retry={() => methods.refetch()} />}
              {methods.isSuccess && !methods.data.length && (
                <p className="notice">
                  No hay métodos disponibles. Tu pedido se conserva; vuelve a consultar antes de pagar.
                </p>
              )}
              {methods.data?.map((m) => (
                <label className="option-row payment-method" key={m.code}>
                  <CreditCard size={23} />
                  <span>
                    <strong>{m.name}</strong>
                    <span>{m.currency}</span>
                  </span>
                  <input
                    type="radio"
                    name="method"
                    checked={method === m.code}
                    onChange={() => setMethod(m.code)}
                    disabled={create.isPending}
                  />
                </label>
              ))}
              {create.isError && <QueryError error={create.error} retry={() => create.reset()} />}
              <button
                className="button"
                disabled={!methods.data?.some((m) => m.code === method) || create.isPending || order.isFetching}
                onClick={() => create.mutate()}
              >
                {create.isPending ? 'Consultando importe…' : 'Consultar importe a pagar'}
              </button>
            </>
          )}
          {cancel.isError && <QueryError error={cancel.error} retry={() => cancel.reset()} />}
        </section>
        <aside className="purchase-summary">
          <h2>Resumen</h2>
          <div>
            <span>Total del pedido</span>
            <strong>{money(o.total_usd)}</strong>
          </div>
          <div>
            <span>Pagado y confirmado</span>
            <strong>{money(o.paid_usd)}</strong>
          </div>
          {next && (
            <div className="summary-total">
              <span>
                {pending.length
                  ? 'Pendiente de confirmación'
                  : next.kind === 'installment'
                    ? 'Próxima cuota'
                    : next.kind === 'down_payment'
                      ? 'Anticipo'
                      : 'Pago pendiente'}
              </span>
              <strong>{money(next._outstanding ?? next.amount_usd)}</strong>
            </div>
          )}
          <button className="text-button" disabled={order.isFetching} onClick={() => order.refetch()}>
            Actualizar estado
          </button>
        </aside>
      </div>
    </div>
  );
}
const instructionLabels: Record<string, string> = {
  banco: 'Banco',
  titular: 'Titular',
  telefono: 'Teléfono',
  documento: 'RIF / Cédula',
  cuenta: 'Cuenta',
  correo: 'Correo',
  red: 'Red',
  direccion: 'Dirección',
};
function PaymentForm({
  quote: q,
  buyerId,
  orderId,
  onBack,
  onSent,
}: {
  quote: PaymentQuote;
  buyerId: string;
  orderId: string;
  onBack: () => void;
  onSent: () => Promise<void>;
}) {
  const [reference, setReference] = useState('');
  const [bank, setBank] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState<string | null>(null);
  const [sent, setSent] = useState<Payment | null>(null);
  const [key] = useState(() => newIdempotencyKey('web-pay'));
  const locked = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = now >= new Date(q.expires_at).getTime();
  const recover = async () => {
    const order = await browser().api.orders.detail(orderId, buyerId);
    return order?.payments.find((p) => p.quote_id === q.id && p.idempotency_key === key) ?? null;
  };
  const submit = useMutation({
    mutationFn: async () => {
      if (q.method.kind === 'automated') {
        const result = await browser().api.payments.startOnline(q.id, key);
        const url = safeExternal(result.checkout_url);
        if (url) setOnline(url);
        return null;
      }
      if (q.method.requires_reference && normalizeReference(reference).length < 4)
        throw new Error('Escribe la referencia del pago.');
      let path = proof;
      if (file && !path) {
        const error = validateUpload(file);
        if (error) throw new Error(error);
        path = await browser().api.payments.uploadProof(
          buyerId,
          await file.arrayBuffer(),
          file.type,
          file.type === 'application/pdf'
            ? 'pdf'
            : file.type === 'image/png'
              ? 'png'
              : file.type === 'image/webp'
                ? 'webp'
                : 'jpg',
        );
        setProof(path);
      }
      if (q.method.requires_proof && !path) throw new Error('Adjunta el comprobante del pago.');
      try {
        const result = await browser().api.payments.submit({
          quoteId: q.id,
          reference: reference.trim() || null,
          proofPath: path,
          payer: { bank: bank.trim() || undefined },
          idempotencyKey: key,
        });
        if (result.error)
          throw new Error(
            result.error === 'quote_expired'
              ? 'El importe venció. Consulta una nueva cotización.'
              : 'Esta obligación ya fue pagada. Actualiza el pedido.',
          );
        return result;
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'network' || code === 'unknown') {
          try {
            const recovered = await recover();
            if (recovered) return recovered;
          } catch {}
          setUnknown(true);
        }
        throw e;
      }
    },
    onSuccess: async (p) => {
      if (p) setSent(p);
      else if (q.method.kind === 'automated') setUnknown(true);
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  const check = useMutation({
    mutationFn: recover,
    onSuccess: (p) => {
      if (p) setSent(p);
      else setProblem('Aún no aparece un pago registrado. Puedes volver a comprobarlo o reintentar el mismo envío.');
    },
  });
  if (sent)
    return (
      <div className="payment-pending" role="status" data-testid="payment-sent">
        <Clock3 size={30} />
        <h2>{PAYMENT_RECORD_LABEL[sent.status]}</h2>
        <p>
          Pago {sent.number} · {currency(sent.amount, sent.currency)}
        </p>
        <p>
          {sent.status === 'confirmed'
            ? 'El servidor confirmó el pago.'
            : 'Recibimos tu información. Confirmaremos el pago después de revisarlo.'}
        </p>
        <button className="button" onClick={() => onSent()}>
          Consultar estado
        </button>
        <Link href={`/pedidos/${orderId}`}>Ver mi pedido</Link>
      </div>
    );
  const busy = submit.isPending || check.isPending;
  return (
    <form
      className="commerce-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (locked.current || expired) return;
        locked.current = true;
        setProblem('');
        submit.mutate();
      }}
    >
      <div className="section-heading">
        <h2>{q.method.name}</h2>
        {!unknown && (
          <button type="button" className="text-button" disabled={busy} onClick={onBack}>
            Cambiar método
          </button>
        )}
      </div>
      <div className="quote-amount">
        <span>Importe a pagar</span>
        <strong>{currency(q.amount_due, q.currency)}</strong>
        <span>
          Base {money(q.base_usd)}
          {q.fee_usd ? ` · Comisión ${money(q.fee_usd)}` : ''}
        </span>
      </div>
      <p className="muted">
        Válido hasta {new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' }).format(new Date(q.expires_at))} ·{' '}
        {date(q.issued_at)}
      </p>
      {q.currency === 'VES' && (
        <p className="muted">
          {q.rate_source === 'bcv_official' ? 'Tasa oficial BCV' : 'Tasa de la cotización'} ·{' '}
          {q.rate_applied.toLocaleString('es-VE')} Bs. por USD · {date(q.rate_observed_at)}
        </p>
      )}
      {expired && (
        <p className="notice error" role="alert">
          El importe venció. Actualízalo antes de realizar el pago.
        </p>
      )}
      <dl className="payment-instructions">
        {Object.entries(q.method.instructions)
          .filter(([k, v]) => k !== 'nota' && typeof v === 'string')
          .map(([k, v]) => (
            <div key={k}>
              <dt>{instructionLabels[k] ?? k}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
      </dl>
      {typeof q.method.instructions.nota === 'string' && <p>{q.method.instructions.nota}</p>}
      {q.method.kind === 'manual' && (
        <>
          <label>
            Referencia del pago
            <input
              name="reference"
              autoComplete="off"
              required={q.method.requires_reference}
              disabled={busy || unknown}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            Banco de origen (opcional)
            <input value={bank} disabled={busy || unknown} maxLength={80} onChange={(e) => setBank(e.target.value)} />
          </label>
          <label>
            Comprobante{!q.method.requires_proof ? ' (opcional)' : ''}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy || unknown}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const error = f ? validateUpload(f) : null;
                setProblem(error ?? '');
                setFile(error ? null : f);
                setProof(null);
              }}
            />
          </label>
          <p className="muted">JPG, PNG, WebP o PDF. Máximo 5 MB.</p>
        </>
      )}
      {(problem || submit.isError) && (
        <p className="error" role="alert">
          {problem || submit.error?.message}
        </p>
      )}
      {check.isError && (
        <p className="error" role="alert">
          No pudimos comprobar el pago. Intenta de nuevo.
        </p>
      )}
      {unknown && (
        <>
          <p className="notice">Comprueba el estado antes de enviar otro pago o cambiar de método.</p>
          <button type="button" className="button secondary" disabled={busy} onClick={() => check.mutate()}>
            Comprobar pago
          </button>
        </>
      )}
      {online && (
        <a className="button" href={online} target="_blank" rel="noopener noreferrer">
          Continuar con el proveedor
        </a>
      )}
      {!expired && (
        <button className="button" disabled={busy}>
          {submit.isPending
            ? 'Enviando…'
            : q.method.kind === 'automated'
              ? 'Iniciar pago en línea'
              : unknown
                ? 'Reintentar el mismo envío'
                : 'Ya pagué, enviar para verificar'}
        </button>
      )}
      {expired && !unknown && (
        <button type="button" className="button" onClick={onBack}>
          Actualizar importe
        </button>
      )}
    </form>
  );
}
