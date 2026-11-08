'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  newIdempotencyKey,
  type Address,
  type CheckoutSummary,
  type ShippingSelection,
  type PlaceOrderResult,
} from '@kora/api';
import { ArrowLeft, ArrowRight, Check, Plus, Truck } from 'lucide-react';
import { describeEtaDates, chooseOfferedPlan, paymentPlanTitle, paymentPlanDescription, planFromSearch, presentServerSchedule, withPlan } from '@kora/core';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { confirmCheckout, recoverCheckout, UnconfirmedCheckoutError } from '@/lib/purchase';
import { AddressEditor } from './addresses';
import { QueryError } from './buyer';
import { ReviewLine } from './review-line';
import { assertBuyerActor, captureBuyerApi } from '@/lib/actor-api';
import { checkoutIntentKey, clearCheckoutIntent, restoreCheckoutIntent, persistCheckoutIntent, type CheckoutIntent } from '@/lib/checkout-intent';
import { useAccount } from '@/lib/providers';
import { PendingCartMerge } from './guest-sync';
const steps = ['Dirección', 'Entregas', 'Plan de pago', 'Revisión'];
type Intent = CheckoutIntent;
export function Checkout({ buyerId }: { buyerId: string }) {
  const { cartSyncing, cartSyncError } = useAccount();
  const cartBlocked = cartSyncing || !!cartSyncError;
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
  const [storageProblem, setStorageProblem] = useState('');
  const [reviewedToken, setReviewedToken] = useState('');
  const [restoreNonce,setRestoreNonce]=useState(0);
  const submitting = useRef(false),
    alive = useRef(true);
  useEffect(()=>{
    let active=true;
    const restore=async()=>{
      try{
        if(!navigator.locks)throw new Error('Este navegador no puede coordinar la compra entre pestañas. Usa un navegador actualizado.');
        const i=await navigator.locks.request(`mayami.checkout:${buyerId}`,()=>active?restoreCheckoutIntent(localStorage,sessionStorage,buyerId):null);
        if(active&&i){setIntent(i);setUncertain(true);}
        else if(active) {
          // A URL carries a preference only. A stored/transmitted intent above keeps its accepted plan untouched.
          setPlan(planFromSearch(new URLSearchParams(window.location.search)) ?? 'full');
        }
      }catch(error){if(active)setStorageProblem((error as Error).message||'No pudimos recuperar tu compra guardada.');}
      finally{if(active)setRestored(true);}
    };
    void restore();return()=>{active=false;};
  },[buyerId,restoreNonce]);
  useEffect(()=>{
    if(intent)return;
    const changed=(event:StorageEvent)=>{if(event.storageArea===localStorage&&event.key===checkoutIntentKey(buyerId)&&event.newValue)setRestoreNonce(n=>n+1);};
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[buyerId,intent]);
  const clearStoredIntent=(accepted:Intent)=>navigator.locks.request(`mayami.checkout:${buyerId}`,()=>clearCheckoutIntent(localStorage,accepted));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const addresses = useQuery({
    queryKey: ['addresses', buyerId],
    queryFn: async () => { const bound = await captureBuyerApi(buyerId); const rows = await bound.api.account.addressesForBuyer(buyerId); await bound.assertCurrent(); return rows; },
  });
  const methods = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => browser().api.payments.methods(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const methodsReady = methods.isSuccess && !methods.isFetching && methods.data.some((m) => m.enabled);
  const address =
    addresses.data?.find((a) => a.id === chosen) ?? addresses.data?.find((a) => a.is_default) ?? addresses.data?.[0];
  const signature = address ? JSON.stringify(address) : '';
  if (destination !== signature && !uncertain) {
    setDestination(signature);
    setShipping({});
    setStep(0);
  }
  const preview = useQuery({
    queryKey: ['checkout', buyerId, signature, shipping, plan],
    enabled: restored && !storageProblem && addresses.isSuccess && !uncertain && !created && !cartBlocked,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const bound = await captureBuyerApi(buyerId);
      let selected = shipping;
      let code: string | null = plan;
      let recoveredPlan = false;
      for (let n = 0; n < 4; n++) {
        try {
          const s = await bound.api.checkout.previewReviewed(address?.id ?? null, selected, code);
          await bound.assertCurrent();
          const offered = chooseOfferedPlan(code, s.plans);
          if (code && offered.code !== code) recoveredPlan = true;
          if (offered.code && s.plan?.code !== offered.code) {
            recoveredPlan = recoveredPlan || (!!code && code !== offered.code);
            code = offered.code;
            continue;
          }
          return {
            summary: s,
            code: offered.code && s.plan?.code === offered.code ? offered.code : null,
            recovered: Object.keys(shipping).length > 0 && selected !== shipping,
            recoveredPlan,
            planNotice: chooseOfferedPlan(plan, s.plans).notice,
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
  useEffect(() => {
    // This is navigation preference only; recovery never changes its stored selection or destination.
    if (!restored || intent || uncertain || !preview.isSuccess || preview.isFetching || preview.isPlaceholderData || !preview.data.code) return;
    const next = withPlan('/checkout', preview.data.code);
    if (window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false });
  }, [restored, intent, uncertain, preview.isSuccess, preview.isFetching, preview.isPlaceholderData, preview.data, router]);
  if (preview.data && !preview.isFetching && preview.data !== seen && !uncertain) {
    setSeen(preview.data);
    if (step === 3 && reviewedToken && reviewedToken !== preview.data.summary.review_token) {
      setReviewedToken('');
      setStep(2);
      setNotice('El pedido cambió. Revisa los productos, la entrega y el total antes de confirmar.');
    }
    if (preview.data.recovered) {
      setShipping({});
      setStep(1);
      setNotice('Las opciones de entrega cambiaron. Revísalas antes de continuar.');
    }
    if (preview.data.recoveredPlan) {
      setPlan(preview.data.code ?? 'full');
      if (step >= 2 && !preview.data.recovered) setStep(2);
      setNotice(preview.data.planNotice ?? 'El plan de pago cambió. Revisa el plan y los importes antes de confirmar.');
    }
  }
  const complete = async (result: PlaceOrderResult, accepted: Intent) => {
    if (!alive.current) return;
    await assertBuyerActor(buyerId);
    if (!alive.current) return;
    try { await clearStoredIntent(accepted); } catch { /* A retained key recovers this same confirmed order next time. */ }
    try { await assertBuyerActor(buyerId); } catch { return; }
    if(!alive.current)return;
    setCreated(result);
    setUncertain(false);
    submitting.current = false;
    await qc.invalidateQueries({ queryKey: ['cart', buyerId] });
    await qc.invalidateQueries({ queryKey: ['orders', buyerId] });
    await assertBuyerActor(buyerId);
    if (alive.current) router.replace(`/pagar/${result.order_id}`);
  };
  const place = useMutation({
    mutationFn: async (i: Intent & { newAttempt?: boolean }) => {
      const bound = await captureBuyerApi(buyerId);
      const result = await confirmCheckout(
        async () => {
          await bound.assertCurrent();
          // An older stored attempt has no accepted review token. Only recover its
          // existing order; never attach a new summary or call the legacy writer.
          if (!i.reviewToken) {
            const existing = await recoverCheckout(() => bound.api.checkout.placedOrder(buyerId, i.key));
            if (existing) return existing;
            throw new UnconfirmedCheckoutError();
          }
          const available = await methods.refetch();
          await bound.assertCurrent();
          if (!available.isSuccess || !available.data.some((m) => m.enabled)) {
            if (i.newAttempt) {
              throw new ApiError({ code: 'method_unavailable', message: 'No podemos confirmar el pedido sin un método de pago disponible. Tu carrito se conserva.' });
            }
            try {
              const existing = await recoverCheckout(() => bound.api.checkout.placedOrder(buyerId, i.key));
              if (existing) return existing;
            } catch (cause) { throw new UnconfirmedCheckoutError(cause); }
            throw new UnconfirmedCheckoutError();
          }
          return bound.api.checkout.placeOrderReviewed(i.selection.address, i.selection.shipping, i.selection.plan, i.key, i.reviewToken);
        },
        () => bound.api.checkout.placedOrder(buyerId, i.key),
      );
      await bound.assertCurrent();
      return result;
    },
    onSuccess: (result, i) => complete(result, i),
    onError: async (error, i) => {
      if (!alive.current) return;
      try { await assertBuyerActor(buyerId); } catch { return; }
      if (!alive.current) return;
      submitting.current = false;
      const code = (error as { code?: string }).code;
      const rejected = ['checkout_changed', 'plan_invalid', 'shipping_invalid', 'insufficient_stock', 'sold_out', 'unavailable', 'cart_has_issues', 'cart_empty', 'address_required', 'address_not_found', 'shipping_unavailable', 'invalid_input'].includes(code ?? '') || (code === 'method_unavailable' && i.newAttempt);
      if (error instanceof UnconfirmedCheckoutError || !rejected || !i.newAttempt) { setUncertain(true); return; }
      try { await clearStoredIntent(i); }
      catch { setUncertain(true); return; }
      try { await assertBuyerActor(buyerId); } catch { return; }
      if(!alive.current)return;
      setUncertain(false);
      setIntent(null);
      if (code === 'checkout_changed') {
        setReviewedToken(''); setStep(0);
        setNotice('El pedido cambió. Revisa los productos, la entrega y el total antes de confirmar.');
      } else setStep(code === 'plan_invalid' ? 2 : code === 'shipping_invalid' ? 1 : 3);
      if (code === 'shipping_invalid') setShipping({});
      if (!cartBlocked) void preview.refetch();
    },
  });
  const check = useMutation({
    mutationFn: async () => {
      const accepted = intent!;
      const bound = await captureBuyerApi(buyerId);
      const order = await recoverCheckout(() => bound.api.checkout.placedOrder(buyerId, accepted.key));
      await bound.assertCurrent();
      return { order, accepted };
    },
    onSuccess: async ({ order, accepted }) => {
      if (!alive.current) return;
      if (order) await complete(order, accepted);
      else setLookupMissing(true);
    },
  });
  const confirm = async () => {
    if (cartBlocked || submitting.current || !methodsReady || !preview.isSuccess || preview.isFetching || preview.isPlaceholderData ||
      !preview.data.summary.can_place || !address || reviewedToken !== preview.data.summary.review_token) return;
    const s = preview.data.summary;
    const candidate: Intent = { version: 2, buyerId, key: newIdempotencyKey('web-order'), reviewToken: s.review_token,
      selection: { address: address.id, plan: preview.data.code!, shipping: Object.fromEntries(s.groups.filter((g) => g.selected_shipping).map((g) => [g.key, g.selected_shipping!.method_id])) } };
    submitting.current=true;
    let shouldSend=true;
    let prepared: ReturnType<typeof persistCheckoutIntent>;
    try {
      if(!navigator.locks)throw new Error('Este navegador no puede coordinar la compra entre pestañas. Usa un navegador actualizado.');
      prepared=await navigator.locks.request(`mayami.checkout:${buyerId}`,{ifAvailable:true},async lock=>{
        if(!lock)throw new Error('Hay una confirmación en curso en otra pestaña. Comprueba su resultado.');
        await assertBuyerActor(buyerId);
        const pending=restoreCheckoutIntent(localStorage,sessionStorage,buyerId);
        if(pending){shouldSend=false;return{intent:pending,fresh:false};}
        return persistCheckoutIntent(localStorage,candidate);
      });
      await assertBuyerActor(buyerId);
      if(!alive.current){submitting.current=false;return;}
    }
    catch (error) { submitting.current=false;if(alive.current)setNotice((error as Error).message || 'No pudimos guardar tu compra. No enviamos el pedido; vuelve a intentarlo.'); return; }
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSnapshot(s); setIntent(prepared.intent); setUncertain(true); setLookupMissing(false); submitting.current = true;
    if(shouldSend)place.mutate({ ...prepared.intent, newAttempt: prepared.fresh });
    else submitting.current=false;
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
    if (n > step) setNotice('');
    if (n === 3) {
      if (!preview.isSuccess || preview.isFetching || preview.isPlaceholderData) return;
      setReviewedToken(preview.data.summary.review_token);
    } else setReviewedToken('');
    setStep(n);
    document.getElementById('checkout-heading')?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (storageProblem) return (
    <section className="state" role="alert" data-testid="checkout-storage-error">
      <h1>No pudimos recuperar tu compra guardada</h1><p>{storageProblem}</p>
      <button className="button" onClick={() => { setStorageProblem(''); setRestored(false);setRestoreNonce(n=>n+1); }}>Reintentar lectura</button>
      <Link prefetch={false} href="/pedidos">Ver mis pedidos</Link>
    </section>
  );
  if (created)
    return (
      <section className="state" role="status">
        <Check />
        <h1>Pedido {created.number} creado</h1>
        <Link prefetch={false} className="button" href={`/pagar/${created.order_id}`}>
          Continuar al pago
        </Link>
        <Link prefetch={false} href={`/pedidos/${created.order_id}`}>Ver mi pedido</Link>
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
        {place.isError && !(place.error instanceof UnconfirmedCheckoutError) && <p className="error" role="alert">{place.error.message} Conservamos la referencia de esta compra mientras comprobamos su resultado.</p>}
        {!place.isPending && (
          <button className="button" disabled={locked} onClick={() => check.mutate()}>
            {check.isPending ? 'Comprobando…' : 'Comprobar pedido'}
          </button>
        )}
        {lookupMissing && intent.reviewToken && (
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
        {lookupMissing && !intent.reviewToken && <p>Esta compra se inició con una versión anterior. Conservamos su referencia; sigue comprobando el pedido antes de iniciar otra compra.</p>}
        <Link prefetch={false} href="/pedidos">Ver mis pedidos</Link>
      </section>
    );
  // Existing persisted attempts remain recoverable above, even while a new guest merge needs attention.
  if (cartSyncing) return <section className="state" role="status">Incorporando tus productos…</section>;
  if (cartSyncError) return <PendingCartMerge />;
  const s = preview.data?.summary ?? snapshot;
  const displayedPayments = s && preview.data?.code ? presentServerSchedule(s.schedule) : null;
  const dueToday = displayedPayments?.singlePaymentDueToday;
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
        <Link prefetch={false} className="button" href="/buscar">
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
  const productCount = s?.groups.flatMap((g) => g.lines).length ?? 0;
  const quantity = s?.groups.reduce((n, g) => n + g.lines.reduce((q, l) => q + l.quantity, 0), 0) ?? 0;
  const enabled =
    step === 0
      ? !!address
      : step === 1
        ? !!s?.groups.every((g) => g.selected_shipping)
        : step === 2
          ? !!preview.data?.code
          : !!s?.can_place;
  return (
    <div className="wrap commerce-page checkout-page">
      <Link prefetch={false} className="text-link" href={withPlan('/carrito', plan)}>
        <ArrowLeft size={16} />
        Volver al carrito
      </Link>
      <div className="commerce-heading">
        <h1 id="checkout-heading" tabIndex={-1}>
          {['Dirección de entrega', 'Tus entregas', 'Plan de pago', 'Revisa tu pedido'][step]}
        </h1>
        <ol className="checkout-progress" aria-label="Pasos de compra">
          {steps.map((title, i) => (
            <li key={title} aria-current={i === step ? 'step' : undefined}>
              <button
                type="button"
                disabled={i >= step || locked || edit}
                onClick={() => move(i)}
                aria-label={i < step ? `Volver a ${title.toLowerCase()}` : title}
              >
                <span>{i < step ? <Check size={14} /> : i + 1}</span>
                <span>{i === 2 ? 'Plan' : title}</span>
              </button>
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
      <p role="status" className="purchase-status">
        {preview.isFetching ? 'Actualizando importes y opciones…' : ''}
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="purchase-layout">
        <section className="purchase-content" aria-label={steps[step]}>
          <div className="checkout-phase" key={step}>
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
                  <button className="text-button add-address" onClick={() => setEdit(true)}>
                    <Plus size={18} /> Agregar dirección
                  </button>
                </>
              ))}
            {step === 1 &&
              s?.groups.map((g, index) => (
                <section className="delivery-block" key={g.key}>
                  <div className="section-heading">
                    <div>
                      <span className="step-caption">
                        Entrega {index + 1} de {s.groups.length}
                      </span>
                      <h2>{g.store.name}</h2>
                    </div>
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
                          checked={(shipping[g.key] ?? g.selected_shipping?.method_id) === o.method_id}
                          disabled={!fresh}
                          onChange={() => setShipping({ ...shipping, [g.key]: o.method_id })}
                        />
                        <span>
                          <strong>{o.name}</strong>
                          <span>
                            {o.kind === 'home_delivery' ? o.carrier : 'Retiras tú'} ·{' '}
                            {describeEtaDates(o.eta_min_date, o.eta_max_date)}
                          </span>
                        </span>
                        <strong>{o.cost_usd === 0 ? 'Gratis' : money(o.cost_usd)}</strong>
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
                    onChange={() => { setPlan(p.code); router.replace(withPlan('/checkout', p.code), { scroll: false }); }}
                  />
                  <span>
                    <strong>{paymentPlanTitle(p)}</strong>
                    <span>{paymentPlanDescription(p)}</span>
                  </span>
                </label>
              ))}
            {step === 2 && s && preview.data?.code && <PaymentSchedule summary={s} />}
            {step === 2 && s && !preview.data?.code && <p className="notice" role="status">Selecciona uno de los planes disponibles para continuar.</p>}
            {step === 3 && s && (
              <>
                <div className="checkout-products" data-testid="checkout-products">
                <h2>{productCount} {productCount === 1 ? 'producto' : 'productos'} · {quantity} {quantity === 1 ? 'unidad' : 'unidades'}</h2>
                {s.groups.map((g, index) => (
                  <section className="delivery-block" key={g.key}>
                    <div className="section-heading">
                      <div>
                        <span className="step-caption">
                          Entrega {index + 1} de {s.groups.length}
                        </span>
                        <h2>{g.store.name}</h2>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => move(1)}
                        aria-label={`Cambiar entrega ${index + 1}`}
                      >
                        Cambiar
                      </button>
                    </div>
                    <p className="delivery-mode">{g.label}</p>
                    {g.lines.map((l) => (
                      <ReviewLine key={l.variant_id} line={l} />
                    ))}
                    {g.selected_shipping && (
                      <div className="delivery-choice">
                        <Truck size={19} aria-hidden="true" />
                        <div>
                          <strong>{g.selected_shipping.name}</strong>
                          <p>
                            {describeEtaDates(g.selected_shipping.eta_min_date, g.selected_shipping.eta_max_date)} ·{' '}
                            {g.selected_shipping.cost_usd === 0 ? 'Gratis' : money(g.selected_shipping.cost_usd)}
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                ))}
                </div>
                <div className="review-address">
                  <div className="section-heading">
                    <h2>Dirección de entrega</h2>
                    <button className="text-button" onClick={() => move(0)} aria-label="Cambiar dirección">
                      Cambiar
                    </button>
                  </div>
                  <strong>{address?.recipient}</strong>
                  <p>
                    {address?.line1}, {address?.city}
                  </p>
                  <p>{address?.phone}</p>
                </div>
                <div className="review-address review-plan">
                  <div className="section-heading">
                    <h2>{s.plan ? paymentPlanTitle(s.plan) : 'Plan de pago'}</h2>
                    <button className="text-button" onClick={() => move(2)} aria-label="Cambiar plan de pago">
                      Cambiar
                    </button>
                  </div>
                  <PaymentSchedule summary={s} />
                  {s.schedule.length <= 1 && <p>Elige el método de pago después de confirmar.</p>}
                </div>
                {s.issues > 0 && (
                  <p className="notice error">
                    Hay productos que requieren revisión. Vuelve al carrito antes de confirmar.
                  </p>
                )}
              </>
            )}
          </div>
        </section>
        <aside className="purchase-summary" aria-label="Resumen de compra">
          <h2>Tu pedido</h2>
          {s && (
            <>
              {step !== 3 && <details className="summary-products">
                <summary>
                  {productCount} {productCount === 1 ? 'producto' : 'productos'} · {quantity} {quantity === 1 ? 'unidad' : 'unidades'} · Ver detalle
                </summary>
                {s.groups
                  .flatMap((g) => g.lines)
                  .map((l) => (
                    <ReviewLine key={l.variant_id} line={l} />
                  ))}
              </details>}
              <dl className="purchase-totals">
                <div>
                  <dt>Productos</dt>
                  <dd>{money(s.items_usd)}</dd>
                </div>
                <div>
                  <dt>Envío{!address || s.needs_shipping ? ' por calcular' : ''}</dt>
                  <dd>
                    {!address || s.needs_shipping ? '—' : s.shipping_usd === 0 ? 'Gratis' : money(s.shipping_usd)}
                  </dd>
                </div>
                {s.financing_usd > 0 && (
                  <div>
                    <dt>Financiamiento</dt>
                    <dd>{money(s.financing_usd)}</dd>
                  </div>
                )}
                <div className="summary-total">
                  <dt>Total del pedido</dt>
                  <dd>{money(s.total_usd)}</dd>
                </div>
                {s.schedule.length > 1 && dueToday && (
                  <div className="summary-now">
                    <dt>Pagas hoy</dt>
                    <dd>{money(dueToday.amount_usd)}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
          {!edit && (
            <div className="checkout-actions">
              {s && (
                <div className="action-amount">
                  <span>{s.schedule.length > 1 && dueToday ? 'Pagas hoy' : 'Total del pedido'}</span>
                  <strong>{money(s.schedule.length > 1 && dueToday ? dueToday.amount_usd : s.total_usd)}</strong>
                </div>
              )}
              <button
                className="button"
                data-testid="checkout-next"
                disabled={!fresh || !enabled || locked || (step === 3 && (!methodsReady || reviewedToken !== preview.data?.summary.review_token))}
                onClick={() => (step === 3 ? confirm() : move(step + 1))}
              >
                {['Continuar a entregas', 'Elegir plan de pago', 'Revisar pedido', 'Confirmar pedido'][step]}
                <ArrowRight size={17} />
              </button>
              {step === 3 && !methodsReady && (
                <div className="notice" data-testid="checkout-methods-unavailable">
                  <p role="status">
                    {methods.isFetching || methods.isPending
                      ? 'Comprobando métodos de pago…'
                      : methods.isError
                        ? 'No pudimos comprobar los métodos de pago. Tu carrito se conserva.'
                        : 'Los métodos de pago no están disponibles por ahora. Tu carrito se conserva; podrás confirmar cuando haya uno disponible.'}
                  </p>
                  <button className="text-button" disabled={methods.isFetching} onClick={() => methods.refetch()}>
                    Actualizar métodos
                  </button>
                </div>
              )}
              {step === 3 && (
                <p className="confirmation-note">
                  Confirmar crea tu pedido. El pago se realiza a continuación. Consulta los{' '}
                  <Link prefetch={false} href="/terminos">términos</Link> y las{' '}
                  <Link prefetch={false} href="/devoluciones">devoluciones</Link>.
                </p>
              )}
            </div>
          )}
          {step > 0 && (
            <button className="text-button previous-step" disabled={locked} onClick={() => move(step - 1)}>
              <ArrowLeft size={15} /> Volver al paso anterior
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function PaymentSchedule({ summary: s }: { summary: CheckoutSummary }) {
  if (s.schedule.length <= 1) return null;
  const displayed = presentServerSchedule(s.schedule);
  return (
    <div className="payment-schedule">
      <h2>{displayed.title}</h2>
      {displayed.distribution && <p>{displayed.distribution}</p>}
      {displayed.rows.map(({ item: p, label, due }) => (
        <div key={p.seq}>
          <span>
            {label} · {due}
          </span>
          <strong>{money(p.amount_usd)}</strong>
        </div>
      ))}
      <p>Tu saldo queda en dólares. Si pagas en bolívares, se cotiza con la tasa vigente de cada pago.</p>
    </div>
  );
}
