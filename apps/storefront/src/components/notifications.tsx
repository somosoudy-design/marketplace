'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronRight, Package, CreditCard, Truck, Store, RefreshCw } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@kora/api';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
import { QueryError } from './buyer';
import { Empty } from './states';

const PAGE = 50;
const key = (id: string) => ['notifications', id] as const;
const uuid = (x: unknown): x is string =>
  typeof x === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
function useUnread(buyerId: string | undefined) {
  return useQuery({
    queryKey: [...key(buyerId ?? ''), 'unread'],
    queryFn: () => browser().api.account.notificationUnreadCount(buyerId!),
    enabled: !!buyerId,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
export function NotificationLink() {
  const { session } = useAccount();
  const q = useUnread(session?.user.id);
  if (!session) return null;
  const total = q.isError ? undefined : q.data;
  return (
    <Link
      href="/notificaciones"
      className="notification-link"
      aria-label={total ? `Notificaciones, ${total} sin leer` : 'Notificaciones'}
    >
      <Bell size={21} aria-hidden="true" />
      <span>Notificaciones</span>
      {!!total && (
        <b className="count" aria-hidden="true">
          {total > 99 ? '99+' : total}
        </b>
      )}
    </Link>
  );
}
function NoticeIcon({ kind, store }: { kind: string; store: boolean }) {
  if (store) return <Store size={19} />;
  if (/payment|installment/.test(kind)) return <CreditCard size={19} />;
  if (/dispatch|fulfillment|delivered/.test(kind)) return <Truck size={19} />;
  if (/order|stock/.test(kind)) return <Package size={19} />;
  return <Bell size={19} />;
}
const date = (value: string) =>
  new Date(value).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
async function destination(n: Notification): Promise<string | null> {
  const d = (n.data ?? {}) as Record<string, unknown>;
  // Store notices must never open another buyer's order in the buyer surface.
  if (d.audience === 'store') return null;
  if (uuid(d.order_id)) return `/pedidos/${d.order_id}`;
  if (uuid(d.product_id)) {
    const product = await browser().api.catalog.product(d.product_id);
    if (product?.slug) return `/p/${encodeURIComponent(product.slug)}`;
    throw new Error('Este producto ya no está disponible.');
  }
  return null;
}
export function Notifications({ buyerId }: { buyerId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [feedback, setFeedback] = useState('');
  const unread = useUnread(buyerId);
  const q = useInfiniteQuery({
    queryKey: [...key(buyerId), 'pages'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => browser().api.account.notificationPage(buyerId, pageParam, PAGE),
    getNextPageParam: (last, _pages, offset) => (last.hasMore ? offset + PAGE : undefined),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const notices = useMemo(() => Array.from(new Map((q.data?.pages.flatMap((p) => p.items) ?? []).map(n => [n.id, n])).values()), [q.data]);
  const ids = notices.filter((n) => !n.read_at).map((n) => n.id);
  const mark = useMutation({
    mutationFn: async ({ ids, open }: { ids: string[]; open?: Notification }) => {
      // Resolve the public product first: a broken link must keep its notice unread.
      const href = open ? await destination(open) : null;
      if (ids.length) await browser().api.account.markNotificationsRead(ids);
      return href;
    },
    onSuccess: async (href, variables) => {
      await qc.invalidateQueries({ queryKey: key(buyerId) });
      if (!alive.current) return;
      if (href) router.push(href);
      else
        setFeedback(
          variables.ids.length === 1 ? 'Notificación marcada como leída.' : 'Notificaciones marcadas como leídas.',
        );
    },
  });
  return (
    <div className="wrap commerce-page notifications-page">
      <div className="section-heading">
        <div>
          <h1>Notificaciones</h1>
          <p>
            {unread.isError
              ? 'No pudimos actualizar los avisos.'
              : unread.data
                ? `${unread.data} sin leer`
                : 'Pedidos, pagos y entregas'}
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            q.refetch();
            unread.refetch();
          }}
          disabled={q.isFetching}
          aria-label="Actualizar notificaciones"
        >
          <RefreshCw size={17} />
          <span>Actualizar</span>
        </button>
      </div>
      {q.isPending && <p role="status">Cargando notificaciones…</p>}
      {q.isError && (
        <QueryError error={q.error} retry={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())} />
      )}
      {mark.isError && <QueryError error={mark.error} retry={() => mark.variables && mark.mutate(mark.variables)} />}
      <p className="sr-only" role="status">
        {feedback}
      </p>
      {notices.length > 0 && (
        <div className="inbox-tools">
          <Link className="text-link" href="/pedidos">
            Mis pedidos
          </Link>
          <button
            className="text-link"
            type="button"
            disabled={!ids.length || mark.isPending}
            onClick={() => mark.mutate({ ids })}
            aria-label="Marcar las notificaciones cargadas como leídas"
          >
            <Check size={16} />
            Marcar leídas
          </button>
        </div>
      )}
      {!q.isPending && !q.isError && !notices.length && (
        <Empty
          title="Todo al día"
          text="Aquí encontrarás las novedades de tus compras."
          href="/buscar"
          action="Explorar productos"
        />
      )}
      <div className="inbox-list" aria-busy={mark.isPending}>
        {notices.map((n) => {
          const d = (n.data ?? {}) as Record<string, unknown>;
          const store = d.audience === 'store';
          const actionable = !store && (uuid(d.order_id) || uuid(d.product_id));
          return (
            <article
              className={`inbox-row ${!n.read_at ? 'inbox-unread' : ''}`}
              key={n.id}
              data-testid={`notification-${n.id}`}
            >
              <span className="inbox-icon" aria-hidden="true">
                <NoticeIcon kind={n.kind} store={store} />
              </span>
              <div className="inbox-copy">
                <div className="inbox-meta">
                  <time dateTime={n.created_at}>{date(n.created_at)}</time>
                  {!n.read_at && <span className="inbox-new">Sin leer</span>}
                </div>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
                {store && <p className="muted">Para tu tienda · disponible en Mi tienda de la app o en el panel.</p>}
                {actionable ? (
                  <button
                    className="text-link inbox-action"
                    type="button"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ ids: n.read_at ? [] : [n.id], open: n })}
                  >
                    {uuid(d.order_id) ? 'Ver pedido' : 'Ver producto'}
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  !n.read_at && (
                    <button
                      className="text-link inbox-action"
                      type="button"
                      disabled={mark.isPending}
                      onClick={() => mark.mutate({ ids: [n.id] })}
                    >
                      Marcar como leída
                      <Check size={16} />
                    </button>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
      {q.hasNextPage && (
        <button
          className="button secondary inbox-more"
          type="button"
          disabled={q.isFetching || mark.isPending}
          onClick={() => q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? 'Cargando…' : 'Ver más notificaciones'}
        </button>
      )}
    </div>
  );
}
