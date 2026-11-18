'use client';
import { StoreIdentity } from '@/components/store-badge';
import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, ArrowRight } from 'lucide-react';
import type { CartLine } from '@kora/api';
import { D, describeDispatchStage, variantDisplayTitle, productConditionLabel, chooseOfferedPlan, paymentPlanTitle, paymentPlanDescription, planFromSearch, withPlan } from '@kora/core';
import { useAccount } from '@/lib/providers';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { ProductPhoto } from '@/components/photo';
import { Empty } from '@/components/states';
import { QuantityControl } from '@/components/quantity-control';
import { OfferStatus, PurchaseHelp } from '@/components/offer';
import { assertBuyerActor, captureBuyerApi } from '@/lib/actor-api';
import { guestCart } from '@/lib/guest-storage';
import { useGuestCartState } from '@/lib/guest-hooks';
import { guestCartView, readGuestCartCatalog, type GuestCartLine } from '@/lib/guest-cart-view';
import { PendingCartMerge } from '@/components/guest-sync';
import { authHref } from '@/lib/auth-return';
import { matchingCartProduct, quantityLimitLabel } from '@/lib/purchase-context';
import { guestError } from '@/lib/guest-errors';
const guestCartWrites = ['cart-write', 'guest'] as const;

function CartHeading({ units }: { units: number }) {
  return <h1 className="cart-heading">Carrito <span>({units})</span></h1>;
}

function Line({ line, buyerId, guestQuantity, href, priceKnown = true, dispatchStage, maxPerOrder, stock }: { line: CartLine; buyerId?: string; guestQuantity?: (quantity: number) => Promise<void>; href?: string; priceKnown?: boolean; dispatchStage?: string | null; maxPerOrder?: number; stock?: number | null }) {
  const conditionLabel = productConditionLabel(line.product_condition);
  const qc = useQueryClient();
  const [remove, setRemove] = useState(false);
  const writing = useRef(false);
  const product = useQuery({
    queryKey: ['product', line.product_id],
    queryFn: () => browser().api.catalog.product(line.product_id),
    enabled: !!buyerId,
  });
  const update = useMutation({
    networkMode: guestQuantity ? 'always' : 'online',
    mutationKey: guestQuantity ? guestCartWrites : ['cart-write', buyerId],
    mutationFn: async (quantity: number) => {
      if (guestQuantity) { try { return await guestQuantity(quantity); } catch (error) { throw guestError(error); } }
      if (!buyerId) throw new Error('No pudimos identificar el carrito. Intenta de nuevo.');
      const bound = await captureBuyerApi(buyerId);
      await bound.assertCurrent();
      // This remains an absolute legacy quantity assignment, not a new intent RPC.
      const result = await bound.api.cart.setQuantity(line.variant_id, quantity);
      await bound.assertCurrent(); return result;
    },
    onSettled: async () => {
      if (guestQuantity) return;
      if (!buyerId) return;
      try { await assertBuyerActor(buyerId); } catch { return; }
      await qc.invalidateQueries({ queryKey: ['cart', buyerId] });
    },
  });
  const changeQuantity = (quantity: number) => {
    if (writing.current || update.isPending) return;
    writing.current = true;
    update.mutate(quantity, { onSettled: () => { writing.current = false; } });
  };
  const currentProduct = matchingCartProduct(product.data, line.product_id, line.availability) ? product.data : null;
  const stage = priceKnown && !line.issue ? dispatchStage ?? (currentProduct ? describeDispatchStage(line.availability, currentProduct.lead_min_days, currentProduct.lead_max_days) : null) : null;
  const limitId = `cart-limit-${line.variant_id}`;
  const currentStock = stock === undefined ? currentProduct?.variants.find(variant => variant.id === line.variant_id)?.stock : stock;
  const limit = priceKnown && !line.issue ? quantityLimitLabel(line.max_quantity, currentStock, maxPerOrder ?? currentProduct?.max_per_order) : null;
  return (
    <article className="cart-line" data-testid={`cart-line-${line.variant_id}`}>
      <ProductPhoto
        id={line.product_id}
        path={line.image_path}
        demo={product.data?.is_demo === true}
        title={line.title}
        variant={line.variant_id}
        exact={!!guestQuantity}
      />
      <div className="cart-line-copy">
        {href || product.data ? (
          <Link prefetch={false} href={href ?? `/p/${product.data!.slug}?variant=${encodeURIComponent(line.variant_id)}`}>
            <h3>{line.title}</h3>
          </Link>
        ) : (
          <h3>{line.title}</h3>
        )}
        {variantDisplayTitle(line.variant_title) && <p>{variantDisplayTitle(line.variant_title)}</p>}
        {conditionLabel && <p data-testid="cart-product-condition">{conditionLabel}</p>}
        {line.quantity > 1 && priceKnown && <span className="muted">{money(line.unit_price_usd)} por unidad</span>}
        {priceKnown ? <p className="cart-availability"><OfferStatus availability={line.availability} issue={line.issue} /></p> : <p className="cart-availability-pending">Disponibilidad pendiente de comprobar</p>}
        {stage && <p className="cart-dispatch-stage">{stage}</p>}
        {line.issue && (
          <p className="error" role="alert">
            {
              {
                sold_out: 'Agotado',
                unavailable: 'Producto no disponible',
                insufficient_stock: 'No hay suficientes unidades',
                over_limit: 'Supera el máximo permitido',
              }[line.issue]
            }
          </p>
        )}
      </div>
      <div className="cart-line-actions" aria-busy={update.isPending}>
        <div className="cart-line-price">
          {line.quantity > 1 && priceKnown && <span className="cart-line-price-label">Subtotal</span>}
          <strong className="cart-line-total">{priceKnown ? money(line.line_total_usd) : 'Precio no disponible'}</strong>
        </div>
        <div className="quantity">
          <QuantityControl quantity={line.quantity} maximum={line.max_quantity} label={line.title}
            editable={priceKnown && line.issue !== 'unavailable' && line.issue !== 'sold_out'} pending={update.isPending} onChange={changeQuantity} />
          <button
            className="remove"
            aria-label={`Eliminar ${line.title}`}
            disabled={update.isPending}
            onClick={() => setRemove(true)}
          >
            <Trash2 size={17} />
          </button>
        </div>
        {limit && <p id={limitId} className="cart-quantity-limit">{limit}</p>}
        {remove && (
          <div className="remove-confirm">
            <span>¿Quitar este producto?</span>
            <button disabled={update.isPending} onClick={() => setRemove(false)}>
              Conservar
            </button>
            <button disabled={update.isPending} onClick={() => changeQuantity(0)}>
              Quitar
            </button>
          </div>
        )}
        {update.isError && (
          <p className="error" role="alert">
            {update.error.message} Intenta de nuevo.
          </p>
        )}
      </div>
      <p className="cart-line-feedback" role="status">
        {update.isPending && <span className="sr-only">{line.title}. </span>}
        {update.isPending ? update.isPaused ? 'Esperando conexión para actualizar este producto…' : 'Actualizando este producto…' : ''}
      </p>
    </article>
  );
}
function BuyerCart({ buyerId, preference }: { buyerId: string; preference?: string }) {
  const router = useRouter();
  const [planNotice, setPlanNotice] = useState<{ source?: string; text: string }>({ text: '' });
  const qc = useQueryClient();
  const { cartSyncing, cartSyncError } = useAccount();
  const updating = useIsMutating({ mutationKey: ['cart-write', buyerId] }) > 0;
  const cart = useQuery({ queryKey: ['cart', buyerId], queryFn: async () => {
    const bound = await captureBuyerApi(buyerId); const result = await bound.api.cart.summaryReviewed(); await bound.assertCurrent(); return result;
  }, enabled: !cartSyncing });
  const selectedPlan = chooseOfferedPlan(preference, cart.data?.plans ?? []);
  const preferenceReady = cart.isSuccess && !cart.isFetching && !updating && !cartSyncing && !cartSyncError && cart.data.issues === 0;
  // Retain a server fallback notice when its URL preference is replaced, until the buyer chooses again.
  if (preferenceReady && selectedPlan.notice && planNotice.source !== preference) setPlanNotice({ source: preference, text: selectedPlan.notice });
  useEffect(() => {
    // Do not persist a fallback while the cart, account merge or a quantity write is still changing.
    if (!cart.isSuccess || cart.isFetching || updating || cartSyncing || cartSyncError || cart.data.issues) return;
    const offered = chooseOfferedPlan(preference, cart.data.plans);
    if (!offered.code) return;
    const next = withPlan('/carrito', offered.code);
    if (window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false });
  }, [preference, cart.isSuccess, cart.isFetching, cart.data, updating, cartSyncing, cartSyncError, router]);
  if (cartSyncing || cart.isPending)
    return (
      <section className="state" role="status">
        {cartSyncing ? 'Incorporando tus productos…' : 'Cargando tu carrito…'}
      </section>
    );
  if (cart.isError)
    return (
      <section className="state" role="alert">
        <h1>No pudimos cargar tu carrito</h1>
        <button className="button" onClick={() => cart.refetch()}>
          Volver a intentar
        </button>
      </section>
    );
  if (!cart.data.line_count)
    return <Empty kind="cart" title="Tu carrito está vacío" text="Explora el catálogo y agrega lo que te guste." />;
  const lines = cart.data.groups.flatMap((g) => g.lines);
  const units = lines.reduce((n, l) => n + l.quantity, 0);
  const checkoutBlocked = updating || cart.isFetching || !!cartSyncError || !selectedPlan.code;
  const guardCheckout = (event: { preventDefault(): void }) => {
    if (qc.isMutating({ mutationKey: ['cart-write', buyerId] }) || cart.isFetching || cartSyncError || !selectedPlan.code) event.preventDefault();
  };
  return (
    <div className="wrap cart-page">
      <CartHeading units={units} />
      <div className="cart-layout">
        <div className="cart-products">
          {cart.data.groups.map((g) => (
            <section className="cart-group" key={g.key}>
              <header className="cart-group-heading"><StoreIdentity store={g.store} as="h2" /><p>{g.label}</p></header>
              {g.lines.map((l) => (
                <Line key={l.variant_id} line={l} buyerId={buyerId} />
              ))}
            </section>
          ))}
        </div>
        <aside className="cart-summary" aria-label="Resumen del carrito">
          <h2>Resumen</h2>
          <div className="cart-summary-subtotal">
            <span>Productos</span>
            <strong>{money(cart.data.items_usd)}</strong>
          </div>
          <div className="cart-summary-guide">
            <p>El envío se calcula con tu dirección. Revisarás el total antes de confirmar el pedido.</p>
          </div>
          <fieldset className="variant-picker" disabled={updating || cart.isFetching || !!cartSyncError}>
            <legend>Plan de pago</legend>
            {cart.data.plans.map(option => (
              <label className="option-row" key={option.code}>
                <input type="radio" name="cart-plan" checked={selectedPlan.code === option.code} onChange={() => { setPlanNotice({ source: preference, text: '' }); router.replace(withPlan('/carrito', option.code), { scroll: false }); }} />
                <span><strong>{paymentPlanTitle(option)}</strong><span>{paymentPlanDescription(option)}</span></span>
              </label>
            ))}
          </fieldset>
          {(selectedPlan.notice || planNotice.text) && <p className="notice" role="status">{selectedPlan.notice || planNotice.text}</p>}
          {!selectedPlan.code && <p className="notice error" role="alert">{cart.data.plans.length ? 'Selecciona un plan de pago disponible antes de continuar.' : 'No hay un plan de pago disponible para este carrito. Actualiza el carrito antes de continuar.'}</p>}
          <div className="cart-summary-actions">
            {cart.data.issues > 0 ? (
              <p className="notice error">Revisa los productos no disponibles antes de continuar.</p>
            ) : checkoutBlocked ? (
              <button type="button" className="button" data-testid="cart-checkout" disabled aria-disabled="true">Continuar con la compra</button>
            ) : (
              <Link prefetch={false} className="button" data-testid="cart-checkout" href={withPlan('/checkout', selectedPlan.code)} aria-disabled={false} onClick={guardCheckout} onAuxClick={guardCheckout} onContextMenu={guardCheckout}>
                Continuar con la compra
              </Link>
            )}
            <Link prefetch={false} className="text-link" href="/buscar">
              Seguir explorando <ArrowRight size={16} />
            </Link>
          </div>
          <PurchaseHelp />
        </aside>
      </div>
    </div>
  );
}
function GuestCart({ preference }: { preference?: string } = {}) {
  const qc = useQueryClient();
  const updating = useIsMutating({ mutationKey: guestCartWrites, exact: true }) > 0;
  const guest = useGuestCartState();
  const ids = [...new Set(guest.data.map(line => line.product_id))];
  const current = useQuery({ queryKey: ['guest-cart-current', ids],
    queryFn: () => readGuestCartCatalog(ids, browser().api.catalog.productCommercial, browser().api.catalog.metadata),
    enabled: guest.ready && !guest.error && guest.data.length > 0 });
  if (!guest.ready) return <section className="state" role="status">Cargando tu carrito…</section>;
  if (guest.error) return <section className="state" role="alert"><h1>No pudimos recuperar tu carrito</h1><p>{guest.error.message}</p><button className="button" onClick={() => void guest.refresh()}>Volver a intentar</button></section>;
  if (!guest.data.length) return <Empty kind="cart" title="Tu carrito está vacío" text="Explora el catálogo y agrega lo que te guste." />;
  const offline = current.fetchStatus === 'paused';
  if (current.isPending && !offline) return <section className="state" role="status">Actualizando tus productos…</section>;
  // A read failure must not erase or hide the locally saved selections. No stored amount is used at checkout.
  const fallback: GuestCartLine[] = guest.data.map(old => {
    const priceKnown = false;
    const unit = priceKnown ? old.price_usd : 0;
    return { ...old, title: typeof old.title === 'string' ? old.title : 'Producto guardado', variant_title: typeof old.variant_title === 'string' ? old.variant_title : null,
      image_path: typeof old.image_path === 'string' ? old.image_path : null, availability: 'unavailable', issue: null, max_quantity: 0,
      unit_price_usd: unit, line_total_usd: D(unit).times(old.quantity).toNumber(), priceKnown, slug: null, storeId: 'guest', storeName: 'Productos guardados' };
  });
  const view = current.data ? guestCartView(guest.data, current.data) : { lines: fallback, groups: [{ key: 'guest', store: undefined, storeName: 'Productos guardados', lines: fallback }], units: fallback.reduce((n, line) => n + line.quantity, 0), issues: 0,
    items_usd: fallback.every(line => line.priceKnown) ? fallback.reduce((sum, line) => sum.plus(line.line_total_usd), D(0)).toNumber() : null };
  const checkoutBlocked = updating || offline || current.isError || current.isFetching;
  const guardCheckout = (event: { preventDefault(): void }) => {
    if (qc.isMutating({ mutationKey: guestCartWrites, exact: true }) || offline || current.isError || current.isFetching) event.preventDefault();
  };
  return <div className="wrap cart-page">
    <CartHeading units={view.units} />
    {(current.isError || offline) && <div className="notice error" role="alert"><p>{offline ? 'Sin conexión. Tus productos siguen guardados; actualizaremos precios y disponibilidad al recuperar la conexión.' : 'No pudimos actualizar precios y disponibilidad. Tus productos siguen guardados.'}</p><button type="button" className="button secondary" onClick={() => void current.refetch()}>Volver a intentar</button></div>}
    <div className="cart-layout"><div className="cart-products">{view.groups.map(group => <section className="cart-group" key={group.key}><header className="cart-group-heading"><StoreIdentity store={group.store ?? { name: group.storeName }} as="h2" /></header>{group.lines.map(line => <Line key={line.variant_id} line={line} priceKnown={line.priceKnown && !offline && !current.isError} href={line.slug ? `/p/${line.slug}?variant=${encodeURIComponent(line.variant_id)}` : undefined} dispatchStage={line.dispatchStage} maxPerOrder={line.maxPerOrder} stock={line.stock} guestQuantity={quantity => guestCart.setQuantity(line.variant_id, quantity)} />)}</section>)}</div>
      <aside className="cart-summary" aria-label="Resumen del carrito">
        <h2>Resumen</h2>
        <div className="cart-summary-subtotal">
          <span>Productos</span>
          <strong>{view.items_usd == null || offline || current.isError ? 'Precio no disponible' : money(view.items_usd)}</strong>
        </div>
        <div className="cart-summary-guide">
          <p>El envío se calcula con tu dirección. Revisarás el total antes de confirmar el pedido.</p>
          <p className="cart-identification">Al continuar, ingresa o crea tu cuenta para comprar estos productos.</p>
        </div>
        {preference && <p className="notice" role="status" data-testid="guest-plan-preference">{preference === 'three_parts' ? 'Preferencia: 3 pagos en total.' : 'Conservamos tu preferencia de pago.'} Confirmaremos los planes disponibles para tu carrito al iniciar sesión.</p>}
        {updating && <p className="muted">Guardando cambios del carrito…</p>}
        <div className="cart-summary-actions">
          {view.issues > 0 ? <p className="notice error">Revisa los productos no disponibles antes de continuar.</p>
            : checkoutBlocked ? <button type="button" className="button" data-testid="cart-checkout" disabled aria-disabled="true">Continuar con la compra</button>
            : <Link prefetch={false} className="button" data-testid="cart-checkout" href={authHref('/cuenta', withPlan('/checkout', preference))} aria-disabled={false} onClick={guardCheckout} onAuxClick={guardCheckout} onContextMenu={guardCheckout}>Continuar con la compra</Link>}
          <Link prefetch={false} className="text-link" href="/buscar">Seguir explorando <ArrowRight size={16} /></Link>
        </div>
        <PurchaseHelp />
      </aside>
    </div>
  </div>;
}
function CartContent() {
  const search = useSearchParams();
  const preference = planFromSearch(new URLSearchParams(search.toString()));
  const { session, ready } = useAccount();
  if (!ready)
    return (
      <section className="state" role="status">
        Cargando tu cuenta…
      </section>
    );
  return session ? (
    <><PendingCartMerge key={'pending:' + session.user.id} /><BuyerCart key={session.user.id} buyerId={session.user.id} preference={preference} /></>
  ) : (
    <GuestCart preference={preference} />
  );
}

export default function Cart() {
  return <Suspense fallback={<section className="state" role="status">Cargando tu carrito…</section>}><CartContent /></Suspense>;
}
