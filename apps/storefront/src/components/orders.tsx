'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_RECORD_LABEL,
  OBLIGATION_KIND_LABEL,
  OBLIGATION_STATUS_LABEL,
} from '@kora/core';
import { browser } from '@/lib/browser';
import { money } from '@/lib/format';
import { date, currency } from '@/lib/purchase';
import { QueryError } from './buyer';
import { Empty } from './states';
import { ReviewLine } from './review-line';
export const ownOrderKey = (buyerId: string, id: string) => ['order', buyerId, id] as const;
export function useOwnOrder(buyerId: string, id: string) {
  return useQuery({
    queryKey: ownOrderKey(buyerId, id),
    queryFn: () => browser().api.orders.detail(id, buyerId),
    staleTime: 0,
    refetchInterval: 20_000,
  });
}
export function Orders({ buyerId }: { buyerId: string }) {
  const orders = useQuery({
    queryKey: ['orders', buyerId],
    queryFn: () => browser().api.orders.list(buyerId),
    staleTime: 0,
  });
  return (
    <div className="wrap commerce-page">
      <div className="section-heading">
        <h1>Mis pedidos</h1>
        <Link href="/buscar" className="text-link">
          Seguir comprando
        </Link>
      </div>
      {orders.isPending && <p role="status">Cargando pedidos…</p>}
      {orders.isError && <QueryError error={orders.error} retry={() => orders.refetch()} />}
      {orders.data?.length === 0 && (
        <Empty
          title="Tus compras aparecerán aquí"
          text="Cuando confirmes un pedido podrás consultar sus pagos y entregas."
        />
      )}
      <div className="order-list">
        {orders.data?.map((o) => (
          <Link className="order-list-row" key={o.id} href={`/pedidos/${o.id}`}>
            <div>
              <h2>Pedido {o.number}</h2>
              <p>
                {date(o.placed_at)} · {o.order_items.length} productos
              </p>
              <span className="status-label">
                {ORDER_STATUS_LABEL[o.status]} · {PAYMENT_STATUS_LABEL[o.payment_status]}
              </span>
            </div>
            <strong>{money(o.total_usd)}</strong>
            <span>Ver pedido →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
export function Order({ buyerId, id }: { buyerId: string; id: string }) {
  const order = useOwnOrder(buyerId, id);
  const qc = useQueryClient();
  const steps = useQuery({ queryKey: ['fulfillment-steps'], queryFn: () => browser().api.orders.steps() });
  const cancel = useMutation({
    mutationFn: () => browser().api.orders.cancel(id, 'Cancelado por el comprador desde la web'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ownOrderKey(buyerId, id) });
      await qc.invalidateQueries({ queryKey: ['orders', buyerId] });
      await qc.invalidateQueries({ queryKey: ['cart', buyerId] });
    },
  });
  if (order.isPending)
    return (
      <section className="state" role="status">
        Cargando tu pedido…
      </section>
    );
  if (order.isError) return <QueryError error={order.error} retry={() => order.refetch()} />;
  const o = order.data;
  if (!o)
    return (
      <Empty
        title="Este pedido no está disponible"
        text="Comprueba el enlace o entra con la cuenta que realizó la compra."
        href="/pedidos"
        action="Ver mis pedidos"
      />
    );
  const pending = o.payments.some((p) => p.status === 'pending_verification' || p.status === 'processing');
  const canPay =
    o.status !== 'cancelled' &&
    o.payment_obligations.some((x) => x.status === 'pending' || x.status === 'partially_paid');
  const canCancel = o.status === 'placed' && Number(o.paid_usd) === 0 && !pending;
  return (
    <div className="wrap commerce-page">
      <Link className="text-link" href="/pedidos">
        ← Mis pedidos
      </Link>
      <div className="commerce-heading">
        <span className="eyebrow">{date(o.placed_at)}</span>
        <h1>Pedido {o.number}</h1>
        <p>
          {ORDER_STATUS_LABEL[o.status]} · {pending ? 'Pago en revisión' : PAYMENT_STATUS_LABEL[o.payment_status]}
        </p>
      </div>
      <div className="purchase-layout">
        <section className="purchase-content">
          {pending && (
            <div className="notice" role="status">
              <h2>Tu pago está en revisión</h2>
              <p>Te avisaremos cuando se confirme. No necesitas enviarlo de nuevo.</p>
            </div>
          )}
          {canPay && !pending && (
            <Link className="button" href={`/pagar/${id}`}>
              Continuar al pago
            </Link>
          )}
          {o.fulfillments.map((f) => (
            <section className="delivery-block" key={f.id}>
              <h2>Entrega {f.seq}</h2>
              <p>
                {steps.data?.find((s) => s.flow === f.flow && s.code === f.status)?.buyer_label ||
                  (f.status === 'delivered'
                    ? 'Entregado'
                    : f.status === 'cancelled'
                      ? 'Cancelado'
                      : 'Preparando tu entrega')}
              </p>
              <p className="muted">
                {f.shipping_method_name} {f.carrier_name}
              </p>
              {f.tracking_number && (
                <p>
                  Guía: <strong>{f.tracking_number}</strong>
                </p>
              )}
              {o.order_items
                .filter((i) => i.fulfillment_id === f.id)
                .map((i) => (
                  <ReviewLine key={i.id} line={i} />
                ))}
              <ol className="timeline">
                {f.fulfillment_events
                  .filter((e) => e.visible_to_buyer)
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((e) => (
                    <li key={e.id}>
                      <strong>
                        {steps.data?.find((s) => s.flow === f.flow && s.code === e.step_code)?.buyer_label ??
                          'Actualización de la entrega'}
                      </strong>
                      <span>{date(e.created_at)}</span>
                      {e.note && <p>{e.note}</p>}
                    </li>
                  ))}
              </ol>
            </section>
          ))}
          <section className="payment-schedule">
            <h2>Plan de pago</h2>
            {o.payment_obligations.map((p) => (
              <div key={p.id}>
                <span>
                  {OBLIGATION_KIND_LABEL[p.kind]}
                  {p.kind === 'installment' ? ` ${p.seq}` : ''}
                  <small>
                    {OBLIGATION_STATUS_LABEL[p.status]}
                    {p.due_date ? ` · ${date(p.due_date)}` : ''}
                  </small>
                </span>
                <strong>{money(p.amount_usd)}</strong>
              </div>
            ))}
          </section>
          {o.payments.length > 0 && (
            <section className="payment-schedule">
              <h2>Pagos reportados</h2>
              {o.payments.map((p) => (
                <div key={p.id}>
                  <span>
                    {p.number}
                    <small>
                      {PAYMENT_RECORD_LABEL[p.status]}
                      {p.reference ? ` · Referencia ${p.reference}` : ''}
                    </small>
                    {p.rejection_reason && <small className="error">{p.rejection_reason}</small>}
                  </span>
                  <strong>{currency(p.amount, p.currency)}</strong>
                </div>
              ))}
            </section>
          )}
          {canCancel && (
            <button
              className="button secondary"
              disabled={cancel.isPending}
              onClick={() => {
                if (window.confirm('¿Cancelar este pedido? Los productos volverán a estar disponibles.'))
                  cancel.mutate();
              }}
            >
              {cancel.isPending ? 'Cancelando…' : 'Cancelar pedido'}
            </button>
          )}
          {cancel.isError && <QueryError error={cancel.error} retry={() => cancel.reset()} />}
        </section>
        <aside className="purchase-summary">
          <h2>Resumen del pedido</h2>
          <div>
            <span>Productos</span>
            <strong>{money(o.items_usd)}</strong>
          </div>
          <div>
            <span>Envío</span>
            <strong>{money(o.shipping_usd)}</strong>
          </div>
          {o.financing_usd > 0 && (
            <div>
              <span>Financiamiento</span>
              <strong>{money(o.financing_usd)}</strong>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(o.total_usd)}</strong>
          </div>
          <div>
            <span>Pagado y confirmado</span>
            <strong>{money(o.paid_usd)}</strong>
          </div>
          {Number(o.refunded_usd) > 0 && (
            <div>
              <span>Reembolsado</span>
              <strong>{money(o.refunded_usd)}</strong>
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
