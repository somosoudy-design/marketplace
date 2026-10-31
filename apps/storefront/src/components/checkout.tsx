'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  newIdempotencyKey,
  type Address,
  type CheckoutSummary,
  type ShippingSelection,
  type PlaceOrderResult,
} from '@kora/api';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { confirmCheckout, recoverCheckout, UnconfirmedCheckoutError } from '@/lib/purchase';
import { AddressEditor } from './addresses';
import { QueryError } from './buyer';
import { ReviewLine } from './review-line';
const steps = ['Dirección', 'Entregas', 'Plan de pago', 'Revisión'];
type Selection = { address: string; shipping: ShippingSelection; plan: string };
type Intent = { key: string; selection: Selection };
export function Checkout({ buyerId }: { buyerId: string }) {
  const router = useRouter(),
    qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [shipping, setShipping] = useState<ShippingSelection>({});
  const [plan, setPlan] = useState('full');
  const [edit, setEdit] = useState(false);
  const [notice, setNotice] = useState('');
  const [destination, setDestination] = useState('');
  const [seen, setSeen] = useState<unknown>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [snapshot, setSnapshot] = useState<CheckoutSummary | null>(null);
  const [restored, setRestored] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [created, setCreated] = useState<PlaceOrderResult | null>(null);
  const [lookupMissing, setLookupMissing] = useState(false);
  const submitting = useRef(false),
    alive = useRef(true);
  const storageKey = `checkout-intent:${buyerId}`;
  const stored = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(storageKey) ?? '';
      } catch {
        return '';
      }
    },
    () => undefined,
  );
  if (!restored && stored !== undefined) {
    setRestored(true);
    try {
      const i = JSON.parse(stored) as Intent;
      if (
        typeof i.key === 'string' &&
        typeof i.selection?.address === 'string' &&
        typeof i.selection?.plan === 'string' &&
        i.selection.shipping &&
        typeof i.selection.shipping === 'object'
      ) {
        setIntent(i);
        setUncertain(true);
      }
    } catch {
      /* No persisted attempt. */
    }
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const addresses = useQuery({
    queryKey: ['addresses', buyerId],
    queryFn: () => browser().api.account.addresses(buyerId),
  });
  const address =
    addresses.data?.find((a) => a.id === chosen) ?? addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0];
  const signature = address ? JSON.stringify([address.id, address.region_code, address.city, address.line1]) : '';
  if (destination !== signature && !uncertain) {
    setDestination(signature);
    setShipping({});
    setStep(0);
  }
  const preview = useQuery({
    queryKey: ['checkout', buyerId, signature, shipping, plan],
    enabled: restored && addresses.isSuccess && !uncertain && !created,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let selected = shipping;
      let code: string | null = plan;
      let recoveredPlan = false;
      for (let n = 0; n < 4; n++) {
        try {
          const s = await browser().api.checkout.preview(address?.id ?? null, selected, code);
          if (!s.plan && s.plans[0]) {
            code = s.plans[0].code;
            continue;
          }
          return {
            summary: s,
            code: s.plan?.code ?? code,
            recovered: Object.keys(shipping).length > 0 && selected !== shipping,
            recoveredPlan,
          };
        } catch (e) {
          const problem = (e as { code?: string }).code;
          if (problem === 'plan_invalid' && code) {
            recoveredPlan = true;
            code = null;
            continue;
          }
          if (problem === 'shipping_invalid' && Object.keys(selected).length) {
            selected = {};
            continue;
          }
          throw e;
        }
      }
      throw new Error('No pudimos actualizar las opciones de compra.');
    },
  });
  if (preview.data && !preview.isFetching && preview.data !== seen && !uncertain) {
    setSeen(preview.data);
    if (preview.data.recovered) {
      setShipping({});
      setStep(1);
      setNotice('Las opciones de entrega cambiaron. Revísalas antes de continuar.');
    }
    if (preview.data.recoveredPlan) {
      setPlan(preview.data.code ?? 'full');
      if (step >= 2 && !preview.data.recovered) setStep(2);
      setNotice('El plan de pago cambió. Revisa el plan y los importes antes de confirmar.');
    }
  }
  const complete = async (result: PlaceOrderResult) => {
    if (!alive.current) return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    setCreated(result);
    setUncertain(false);
    submitting.current = false;
    await qc.invalidateQueries({ queryKey: ['cart', buyerId] });
    await qc.invalidateQueries({ queryKey: ['orders', buyerId] });
    if (alive.current) router.replace(`/pagar/${result.order_id}`);
  };
  const place = useMutation({
    mutationFn: (i: Intent) =>
      confirmCheckout(
        () => browser().api.checkout.placeOrder(i.selection.address, i.selection.shipping, i.selection.plan, i.key),
        () => browser().api.checkout.placedOrder(buyerId, i.key),
      ),
    onSuccess: complete,
    onError: (e) => {
      submitting.current = false;
      if (e instanceof UnconfirmedCheckoutError) {
        setUncertain(true);
        return;
      }
      setUncertain(false);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      setIntent(null);
      const code = (e as { code?: string }).code;
      setStep(code === 'plan_invalid' ? 2 : code === 'shipping_invalid' ? 1 : 3);
      if (code === 'shipping_invalid') setShipping({});
      void preview.refetch();
    },
  });
  const check = useMutation({
    mutationFn: () => recoverCheckout(() => browser().api.checkout.placedOrder(buyerId, intent!.key)),
    onSuccess: (r) => {
      if (r) void complete(r);
      else setLookupMissing(true);
    },
  });
  const confirm = () => {
    if (
      submitting.current ||
      !preview.data ||
      preview.isFetching ||
      preview.isError ||
      !preview.data.summary.can_place ||
      !address
    )
      return;
    const s = preview.data.summary;
    const i: Intent = intent ?? {
      key: newIdempotencyKey('web-order'),
      selection: {
        address: address.id,
        plan: preview.data.code!,
        shipping: Object.fromEntries(
          s.groups.filter((g) => g.selected_shipping).map((g) => [g.key, g.selected_shipping!.method_id]),
        ),
      },
    };
    setSnapshot(s);
    setIntent(i);
    setUncertain(true);
    setLookupMissing(false);
    submitting.current = true;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(i));
    } catch {}
    place.mutate(i);
  };
  const locked = place.isPending || check.isPending;
  useEffect(() => {
    if (!uncertain) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uncertain]);
  const move = (n: number) => {
    setStep(n);
    document.getElementById('checkout-heading')?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (created)
    return (
      <section className="state" role="status">
        <Check />
        <h1>Pedido {created.number} creado</h1>
        <Link className="button" href={`/pagar/${created.order_id}`}>
          Continuar al pago
        </Link>
        <Link href={`/pedidos/${created.order_id}`}>Ver mi pedido</Link>
      </section>
    );
  if (!restored)
    return (
      <section className="state" role="status">
        Preparando tu compra…
      </section>
    );
  if (uncertain && intent)
    return (
      <section className="state" data-testid="checkout-recovery">
        <h1>{place.isPending ? 'Confirmando tu pedido…' : 'Comprobemos tu pedido'}</h1>
        <p>
          {place.isPending
            ? 'Espera un momento mientras recibimos la confirmación.'
            : 'La conexión se interrumpió. Comprueba si el pedido quedó guardado antes de continuar.'}
        </p>
        {check.isError && (
          <p role="alert" className="error">
            No pudimos comprobarlo. Intenta de nuevo.
          </p>
        )}
        {!place.isPending && (
          <button className="button" disabled={locked} onClick={() => check.mutate()}>
            {check.isPending ? 'Comprobando…' : 'Comprobar pedido'}
          </button>
        )}
        {lookupMissing && (
          <>
            <p>Aún no aparece una confirmación. Puedes reintentar la misma compra.</p>
            <button
              className="button secondary"
              disabled={locked}
              onClick={() => {
                if (submitting.current) return;
                submitting.current = true;
                place.mutate(intent);
              }}
            >
              Reintentar confirmación
            </button>
          </>
        )}
        <Link href="/pedidos">Ver mis pedidos</Link>
      </section>
    );
  const s = preview.data?.summary ?? snapshot;
  const fresh = preview.isSuccess && !preview.isFetching && !preview.isPlaceholderData;
  if (addresses.isPending)
    return (
      <section className="state" role="status">
        Cargando direcciones…
      </section>
    );
  if (!s && preview.isPending && addresses.isSuccess)
    return (
      <section className="state" role="status">
        Calculando opciones de compra…
      </section>
    );
  if (s && !s.line_count)
    return (
      <section className="state">
        <h1>Tu carrito está vacío</h1>
        <Link className="button" href="/buscar">
          Explorar productos
        </Link>
      </section>
    );
  const changeAddress = (a: Address) => {
    setChosen(a.id);
    setShipping({});
    setStep(0);
    setEdit(false);
  };
  const enabled =
    step === 0
      ? !!address
      : step === 1
        ? !!s?.groups.every((g) => g.selected_shipping)
        : step === 2
          ? !!preview.data?.code
          : !!s?.can_place;
  return (
    <div className="wrap commerce-page">
      <Link className="text-link" href="/carrito">
        <ArrowLeft size={16} />
        Volver al carrito
      </Link>
      <div className="commerce-heading">
        <span className="eyebrow">PASO {step + 1} DE 4</span>
        <h1 id="checkout-heading" tabIndex={-1}>
          {['Dirección de entrega', 'Tus entregas', 'Plan de pago', 'Revisa tu pedido'][step]}
        </h1>
        <ol className="checkout-progress" aria-label="Pasos de compra">
          {steps.map((title, i) => (
            <li key={title} aria-current={i === step ? 'step' : undefined}>
              <span>{i < step ? <Check size={13} /> : i + 1}</span>
              {title}
            </li>
          ))}
        </ol>
      </div>
      {addresses.isError && <QueryError error={addresses.error} retry={() => addresses.refetch()} />}
      {preview.isError && <QueryError error={preview.error} retry={() => preview.refetch()} />}
      {place.isError && !(place.error instanceof UnconfirmedCheckoutError) && (
        <p className="notice error" role="alert">
          {place.error.message}
        </p>
      )}
      {preview.isFetching && (
        <p role="status" className="muted">
          Actualizando importes y opciones…
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="purchase-layout">
        <section className="purchase-content" aria-label={steps[step]}>
          {step === 0 &&
            (edit ? (
              <AddressEditor
                buyerId={buyerId}
                first={!addresses.data?.length}
                onDone={changeAddress}
                onCancel={() => setEdit(false)}
              />
            ) : (
              <>
                <div className="address-list">
                  {addresses.data?.map((a) => (
                    <label className="option-row" key={a.id}>
                      <input
                        type="radio"
                        name="address"
                        checked={address?.id === a.id}
                        onChange={() => changeAddress(a)}
                      />
                      <span>
                        <strong>
                          {a.label}
                          {a.is_default ? ' · Principal' : ''}
                        </strong>
                        <span>
                          {a.recipient} · {a.phone}
                        </span>
                        <span>
                          {a.line1}, {a.city}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <button className="button secondary" onClick={() => setEdit(true)}>
                  Agregar dirección
                </button>
              </>
            ))}
          {step === 1 &&
            s?.groups.map((g, index) => (
              <section className="delivery-block" key={g.key}>
                <div className="section-heading">
                  <h2>Entrega {index + 1}</h2>
                  <span className="muted">{g.store.name}</span>
                </div>
                {g.lines.map((l) => (
                  <ReviewLine key={l.variant_id} line={l} />
                ))}
                {g.shipping_options?.length ? (
                  g.shipping_options.map((o) => (
                    <label className="option-row" key={o.method_id}>
                      <input
                        type="radio"
                        name={g.key}
                        checked={g.selected_shipping?.method_id === o.method_id}
                        disabled={!fresh}
                        onChange={() => setShipping({ ...shipping, [g.key]: o.method_id })}
                      />
                      <span>
                        <strong>{o.name}</strong>
                        <span>
                          {o.carrier} · {o.min_days}–{o.max_days} días estimados
                        </span>
                      </span>
                      <strong>{money(o.cost_usd)}</strong>
                    </label>
                  ))
                ) : (
                  <p className="notice">
                    No hay opciones de entrega para esta dirección. Prueba otra dirección o revisa el carrito.
                  </p>
                )}
              </section>
            ))}
          {step === 2 &&
            s?.plans.map((p) => (
              <label className="option-row" key={p.code}>
                <input
                  type="radio"
                  name="plan"
                  checked={preview.data?.code === p.code}
                  disabled={!fresh}
                  onChange={() => setPlan(p.code)}
                />
                <span>
                  <strong>{p.name}</strong>
                  <span>{p.description}</span>
                </span>
              </label>
            ))}
          {step === 2 && !!s?.schedule.length && (
            <div className="payment-schedule">
              <h2>Calendario de pagos</h2>
              {s.schedule.map((p) => (
                <div key={p.seq}>
                  <span>
                    {p.kind === 'down_payment'
                      ? 'Anticipo'
                      : p.kind === 'installment'
                        ? `Cuota ${p.seq}`
                        : 'Pago total'}{' '}
                    · {p.due_in_days === 0 ? 'Ahora' : `En ${p.due_in_days} días`}
                  </span>
                  <strong>{money(p.amount_usd)}</strong>
                </div>
              ))}
            </div>
          )}
          {step === 3 && s && (
            <>
              <div className="review-address">
                <h2>Entrega en {address?.label}</h2>
                <p>
                  {address?.recipient} · {address?.line1}, {address?.city}
                </p>
                <button className="text-button" onClick={() => move(0)}>
                  Cambiar dirección
                </button>
              </div>
              {s.groups.map((g) => (
                <section className="delivery-block" key={g.key}>
                  <h2>{g.store.name}</h2>
                  {g.lines.map((l) => (
                    <ReviewLine key={l.variant_id} line={l} />
                  ))}
                  <p className="muted">
                    {g.selected_shipping?.name} · {money(g.selected_shipping?.cost_usd ?? 0)}
                  </p>
                </section>
              ))}
              <div className="review-address">
                <h2>{s.plan?.name}</h2>
                <p>Al confirmar se crea tu pedido. A continuación eliges el método de pago.</p>
              </div>
              {s.issues > 0 && (
                <p className="notice error">
                  Hay productos que requieren revisión. Vuelve al carrito antes de confirmar.
                </p>
              )}
            </>
          )}
        </section>
        <aside className="purchase-summary">
          <h2>Tu compra</h2>
          {s && (
            <>
              <div>
                <span>Productos</span>
                <strong>{money(s.items_usd)}</strong>
              </div>
              <div>
                <span>Envío{!address ? ' por calcular' : ''}</span>
                <strong>{address ? money(s.shipping_usd) : '—'}</strong>
              </div>
              {s.financing_usd > 0 && (
                <div>
                  <span>Financiamiento</span>
                  <strong>{money(s.financing_usd)}</strong>
                </div>
              )}
              <div className="summary-total">
                <span>Total</span>
                <strong>{money(s.total_usd)}</strong>
              </div>
            </>
          )}
          <button
            className="button"
            data-testid="checkout-next"
            disabled={!fresh || !enabled || edit || locked}
            onClick={() => (step === 3 ? confirm() : move(step + 1))}
          >
            {step === 3 ? 'Confirmar pedido' : 'Continuar'}
            <ArrowRight size={17} />
          </button>
          {step > 0 && (
            <button className="text-button" disabled={locked} onClick={() => move(step - 1)}>
              Volver al paso anterior
            </button>
          )}
          <p className="muted">
            {step === 3
              ? 'El pago se realiza después de confirmar el pedido.'
              : 'Los importes se actualizan con tus selecciones.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
