'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { CartLine } from '@kora/api';
import { D } from '@kora/core';
import { useAccount } from '@/lib/providers';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { ProductPhoto } from '@/components/photo';
import { Empty } from '@/components/states';
import { assertBuyerActor, captureBuyerApi } from '@/lib/actor-api';
import { guestCart } from '@/lib/guest-storage';
import { useGuestCartState } from '@/lib/guest-hooks';
import { guestCartView, readGuestCartCatalog, type GuestCartLine } from '@/lib/guest-cart-view';
import { PendingCartMerge } from '@/components/guest-sync';
import { authHref } from '@/lib/auth-return';
import { guestError } from '@/lib/guest-errors';
function Line({ line, buyerId, guestQuantity, href, priceKnown = true }: { line: CartLine; buyerId?: string; guestQuantity?: (quantity: number) => Promise<void>; href?: string; priceKnown?: boolean }) {
  const qc = useQueryClient();
  const [remove, setRemove] = useState(false);
  const product = useQuery({
    queryKey: ['product', line.product_id],
    queryFn: () => browser().api.catalog.product(line.product_id),
    enabled: !!buyerId,
  });
  const update = useMutation({
    networkMode: guestQuantity ? 'always' : 'online',
    mutationKey: ['cart-write', buyerId],
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
        {line.variant_title && <p>{line.variant_title}</p>}
        {line.quantity > 1 && priceKnown && <span className="muted">{money(line.unit_price_usd)} por unidad</span>}
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
      <div className="cart-line-actions">
        <strong className="cart-line-total">{priceKnown ? money(line.line_total_usd) : 'Precio no disponible'}</strong>
        <div className="quantity">
          <button
            aria-label={`Reducir cantidad de ${line.title}`}
            disabled={update.isPending || line.quantity <= 1}
            onClick={() => update.mutate(line.quantity - 1)}
          >
            <Minus size={15} />
          </button>
          <span aria-live="polite">{line.quantity}</span>
          <button
            aria-label={`Aumentar cantidad de ${line.title}`}
            disabled={update.isPending || line.quantity >= line.max_quantity}
            onClick={() => update.mutate(line.quantity + 1)}
          >
            <Plus size={15} />
          </button>
          <button
            className="remove"
            aria-label={`Eliminar ${line.title}`}
            disabled={update.isPending}
            onClick={() => setRemove(true)}
          >
            <Trash2 size={17} />
          </button>
        </div>
        {remove && (
          <div className="remove-confirm">
            <span>¿Quitar este producto?</span>
            <button disabled={update.isPending} onClick={() => setRemove(false)}>
              Conservar
            </button>
            <button disabled={update.isPending} onClick={() => update.mutate(0)}>
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
    </article>
  );
}
function BuyerCart({ buyerId }: { buyerId: string }) {
  const qc = useQueryClient();
  const { cartSyncing, cartSyncError } = useAccount();
  const updating = useIsMutating({ mutationKey: ['cart-write', buyerId] }) > 0;
  const cart = useQuery({ queryKey: ['cart', buyerId], queryFn: async () => {
    const bound = await captureBuyerApi(buyerId); const result = await bound.api.cart.summaryReviewed(); await bound.assertCurrent(); return result;
  }, enabled: !cartSyncing });
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
    return <Empty title="Tu próximo hallazgo te espera" text="Explora el catálogo y agrega lo que te guste." />;
  const lines = cart.data.groups.flatMap((g) => g.lines);
  const units = lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="wrap cart-page">
      <div className="section-heading">
        <h1>Mi carrito</h1>
        <span className="muted">{lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {units} {units === 1 ? 'unidad' : 'unidades'}</span>
      </div>
      <div className="cart-layout">
        <div className="cart-products">
          {cart.data.groups.map((g) => (
            <section className="cart-group" key={g.key}>
              <header className="cart-group-heading"><h2>{g.store.name}</h2><p>{g.label}</p></header>
              {g.lines.map((l) => (
                <Line key={l.variant_id} line={l} buyerId={buyerId} />
              ))}
            </section>
          ))}
        </div>
        <aside className="cart-summary">
          <h2>Resumen</h2>
          <div>
            <span>Productos</span>
            <strong>{money(cart.data.items_usd)}</strong>
          </div>
          <p>Entrega y opciones de pago se calculan al continuar con la compra.</p>
          {cart.data.issues > 0 ? (
            <p className="notice error">Revisa los productos no disponibles antes de continuar.</p>
          ) : (
            <Link prefetch={false} className="button" data-testid="cart-checkout" href="/checkout" aria-disabled={updating || cart.isFetching || !!cartSyncError} onClick={(event) => { if (qc.isMutating({ mutationKey: ['cart-write', buyerId] }) || cart.isFetching || cartSyncError) event.preventDefault(); }}>
              Continuar con la compra
            </Link>
          )}
          <Link prefetch={false} className="text-link" href="/buscar">
            Seguir explorando <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
function GuestCart() {
  const guest = useGuestCartState();
  const ids = [...new Set(guest.data.map(line => line.product_id))];
  const current = useQuery({ queryKey: ['guest-cart-current', ids],
    queryFn: () => readGuestCartCatalog(ids, browser().api.catalog.productCommercial, browser().api.catalog.metadata),
    enabled: guest.ready && !guest.error && guest.data.length > 0 });
  if (!guest.ready) return <section className="state" role="status">Cargando tu carrito…</section>;
  if (guest.error) return <section className="state" role="alert"><h1>No pudimos recuperar tu carrito</h1><p>{guest.error.message}</p><button className="button" onClick={() => void guest.refresh()}>Volver a intentar</button></section>;
  if (!guest.data.length) return <Empty title="Tu próximo hallazgo te espera" text="Explora el catálogo y agrega lo que te guste." />;
  const offline = current.fetchStatus === 'paused';
  if (current.isPending && !offline) return <section className="state" role="status">Actualizando tus productos…</section>;
  // A read failure must not erase or hide the locally saved selections. No stored amount is used at checkout.
  const fallback: GuestCartLine[] = guest.data.map(old => {
    const priceKnown = false;
    const unit = priceKnown ? old.price_usd : 0;
    return { ...old, title: typeof old.title === 'string' ? old.title : 'Producto guardado', variant_title: typeof old.variant_title === 'string' ? old.variant_title : null,
      image_path: typeof old.image_path === 'string' ? old.image_path : null, availability: 'unavailable', issue: null, max_quantity: 20,
      unit_price_usd: unit, line_total_usd: D(unit).times(old.quantity).toNumber(), priceKnown, slug: null, storeId: 'guest', storeName: 'Productos guardados' };
  });
  const view = current.data ? guestCartView(guest.data, current.data) : { lines: fallback, groups: [{ key: 'guest', storeName: 'Productos guardados', lines: fallback }], units: fallback.reduce((n, line) => n + line.quantity, 0), issues: 0,
    items_usd: fallback.every(line => line.priceKnown) ? fallback.reduce((sum, line) => sum.plus(line.line_total_usd), D(0)).toNumber() : null };
  return <div className="wrap cart-page">
    <div className="section-heading"><h1>Mi carrito</h1><span className="muted">{view.lines.length} {view.lines.length === 1 ? 'producto' : 'productos'} · {view.units} {view.units === 1 ? 'unidad' : 'unidades'}</span></div>
    {(current.isError || offline) && <div className="notice error" role="alert"><p>{offline ? 'Sin conexión. Tus productos siguen guardados; actualizaremos precios y disponibilidad al recuperar la conexión.' : 'No pudimos actualizar precios y disponibilidad. Tus productos siguen guardados.'}</p><button type="button" className="button secondary" onClick={() => void current.refetch()}>Volver a intentar</button></div>}
    <div className="cart-layout"><div className="cart-products">{view.groups.map(group => <section className="cart-group" key={group.key}><header className="cart-group-heading"><h2>{group.storeName}</h2></header>{group.lines.map(line => <Line key={line.variant_id} line={line} priceKnown={line.priceKnown && !offline && !current.isError} href={line.slug ? `/p/${line.slug}?variant=${encodeURIComponent(line.variant_id)}` : undefined} guestQuantity={quantity => guestCart.setQuantity(line.variant_id, quantity)} />)}</section>)}</div>
      <aside className="cart-summary"><h2>Resumen</h2><div><span>Productos</span><strong>{view.items_usd == null || offline || current.isError ? 'Precio no disponible' : money(view.items_usd)}</strong></div><p>Entrega y opciones de pago se calculan al continuar con la compra.</p>
        {view.issues > 0 ? <p className="notice error">Revisa los productos no disponibles antes de continuar.</p>
          : <Link prefetch={false} className="button" data-testid="cart-checkout" href={authHref('/cuenta', '/checkout')} aria-disabled={offline || current.isError || current.isFetching} onClick={event => { if (offline || current.isError || current.isFetching) event.preventDefault(); }}>Continuar con la compra</Link>}
        <Link prefetch={false} className="text-link" href="/buscar">Seguir explorando <ArrowRight size={16} /></Link>
      </aside></div>
  </div>;
}
export default function Cart() {
  const { session, ready } = useAccount();
  if (!ready)
    return (
      <section className="state" role="status">
        Cargando tu cuenta…
      </section>
    );
  return session ? (
    <><PendingCartMerge key={'pending:' + session.user.id} /><BuyerCart key={session.user.id} buyerId={session.user.id} /></>
  ) : (
    <GuestCart />
  );
}
