'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import type { CartLine } from '@kora/api';
import { useAccount } from '@/lib/providers';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { ProductPhoto } from '@/components/photo';
import { Empty } from '@/components/states';
function Line({ line, buyerId }: { line: CartLine; buyerId: string }) {
  const qc = useQueryClient();
  const [remove, setRemove] = useState(false);
  const product = useQuery({
    queryKey: ['product', line.product_id],
    queryFn: () => browser().api.catalog.product(line.product_id),
  });
  const update = useMutation({
    mutationFn: (quantity: number) => browser().api.cart.setQuantity(line.variant_id, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', buyerId] }),
  });
  return (
    <article className="cart-line">
      <ProductPhoto
        id={line.product_id}
        path={line.image_path}
        demo={product.data?.is_demo === true}
        title={line.title}
        variant={line.variant_id}
      />
      <div className="cart-line-copy">
        {product.data ? (
          <Link href={`/p/${product.data.slug}`}>
            <h3>{line.title}</h3>
          </Link>
        ) : (
          <h3>{line.title}</h3>
        )}
        {line.variant_title && <p>{line.variant_title}</p>}
        <span className="muted">{money(line.unit_price_usd)} por unidad</span>
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
      <strong className="cart-line-total">{money(line.line_total_usd)}</strong>
    </article>
  );
}
function BuyerCart({ buyerId }: { buyerId: string }) {
  const cart = useQuery({ queryKey: ['cart', buyerId], queryFn: () => browser().api.cart.summary() });
  if (cart.isPending)
    return (
      <section className="state" role="status">
        Cargando tu carrito…
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
  return (
    <div className="wrap cart-page">
      <div className="section-heading">
        <h1>Mi carrito</h1>
        <span className="muted">{cart.data.line_count} productos</span>
      </div>
      <div className="cart-layout">
        <div>
          {cart.data.groups.map((g) => (
            <section className="cart-group" key={g.key}>
              <h2>{g.store.name}</h2>
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
            <Link className="button" data-testid="cart-checkout" href="/checkout">
              Continuar con la compra
            </Link>
          )}
          <Link className="text-link" href="/buscar">
            Seguir explorando <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
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
    <BuyerCart key={session.user.id} buyerId={session.user.id} />
  ) : (
    <Empty
      title="Tu carrito, en todos tus dispositivos"
      text="Inicia sesión con tu cuenta para consultar y agregar productos."
      href="/cuenta?volver=/carrito"
      action="Iniciar sesión"
    />
  );
}
