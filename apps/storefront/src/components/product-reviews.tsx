'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createApi, createKoraClient, type MyReview, type OrderItem, type PublicReview } from '@kora/api';
import { variantDisplayTitle } from '@kora/core';
import { BadgeCheck, Star } from 'lucide-react';
import { useAccount } from '@/lib/providers';
import { captureBuyerApi } from '@/lib/actor-api';
import { authHref } from '@/lib/auth-return';
import { env } from '@/lib/env';
import { QueryError } from './buyer';
import './product-reviews.css';

const PAGE = 8;
const EDIT_WINDOW = 60 * 24 * 60 * 60 * 1000;
const words = ['Muy malo', 'Malo', 'Aceptable', 'Bueno', 'Excelente'];
const reviewKey = (productId: string, buyerId: string | null) => ['product-reviews', productId, buyerId] as const;
const ownKey = (productId: string, buyerId: string) => ['reviewable-purchases', buyerId, productId] as const;
const canEdit = (review: MyReview) =>
  Number.isFinite(Date.parse(review.created_at)) && Date.now() - Date.parse(review.created_at) <= EDIT_WINDOW;
function Rating({ value }: { value: number }) {
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`${value.toLocaleString('es-VE', { maximumFractionDigits: 1 })} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} aria-hidden="true" fill={i <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}
function ReviewEntry({ review: r, storeName }: { review: PublicReview; storeName: string }) {
  const variant = variantDisplayTitle(r.variant_title);
  return (
    <article className="review-entry" data-testid={`product-review-${r.id}`}>
      <div className="review-entry-meta">
        <Rating value={r.rating} />
        <time dateTime={r.created_at}>
          {new Date(r.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </time>
      </div>
      {r.body ? <p className="review-body">{r.body}</p> : <p className="muted">Sin comentario, solo calificación.</p>}
      <p className="review-author">
        <strong>{r.author}</strong>
        <span>
          <BadgeCheck size={15} aria-hidden="true" />
          Compra verificada
        </span>
        {variant && <span>{variant}</span>}
      </p>
      {r.reply_body && (
        <div className="review-reply">
          <strong>Respuesta de {storeName}</strong>
          <p>{r.reply_body}</p>
        </div>
      )}
    </article>
  );
}
type Props = { productId: string; slug: string; routePath?: string; storeName: string };
export function ProductReviews(props: Props) {
  const { session, ready } = useAccount();
  return (
    <ProductReviewsSession
      key={`${props.productId}:${session?.user.id ?? 'guest'}`}
      {...props}
      buyerId={session?.user.id ?? null}
      ready={ready}
    />
  );
}
function ProductReviewsSession({
  productId,
  slug,
  routePath,
  storeName,
  buyerId,
  ready,
}: Props & { buyerId: string | null; ready: boolean }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const heading = useRef<HTMLHeadingElement>(null);
  const returned = useRef(false);
  const [editing, setEditing] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<OrderItem | null>(null);
  const [notice, setNotice] = useState('');
  const [editorBusy, setEditorBusy] = useState(false);
  const back = new URLSearchParams(params?.toString());
  back.set('section', 'opiniones');
  const own = useQuery({
    queryKey: ownKey(productId, buyerId ?? ''),
    enabled: ready && !!buyerId,
    staleTime: 0,
    queryFn: async () => {
      const bound = await captureBuyerApi(buyerId!);
      const items = await bound.api.reviews.deliveredItems(buyerId!, productId);
      await bound.assertCurrent();
      const reviews = await bound.api.reviews.mine(items.map((i) => i.id));
      await bound.assertCurrent();
      return { items, reviews };
    },
  });
  const opinions = useInfiniteQuery({
    queryKey: reviewKey(productId, buyerId),
    enabled: ready,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (buyerId) {
        const bound = await captureBuyerApi(buyerId);
        const result = await bound.api.catalog.reviews(productId, PAGE, pageParam);
        await bound.assertCurrent();
        return result;
      }
      const catalog = createApi(
        createKoraClient({ url: env.url, anonKey: env.anon, accessToken: env.anon, retryReads: false }),
      ).catalog;
      return catalog.reviews(productId, PAGE, pageParam);
    },
    getNextPageParam: (last, pages) =>
      last.items.length < PAGE || pages.reduce((sum, page) => sum + page.items.length, 0) >= last.summary.count
        ? undefined
        : pages.length * PAGE,
  });
  const choices = (own.data?.items ?? []).filter((item) => {
    const review = own.data?.reviews.find((r) => r.order_item_id === item.id);
    return !review || canEdit(review);
  });
  const first = choices.find((item) => !own.data?.reviews.some((r) => r.order_item_id === item.id)) ?? choices[0];
  const selected = selectedPurchase ?? first;
  const selectedEligible = !!selected && choices.some((item) => item.id === selected.id);
  const existing = own.data?.reviews.find((r) => r.order_item_id === selected?.id);
  const freshOwn = own.isSuccess && !own.isFetching && !own.isError;
  const summary = opinions.data?.pages[0]?.summary;
  const items = [
    ...new Map((opinions.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values(),
  ];
  useEffect(() => {
    if (params?.get('section') !== 'opiniones' || returned.current || !ready || (buyerId && !own.isFetched)) return;
    returned.current = true;
    heading.current?.scrollIntoView({ block: 'start' });
    heading.current?.focus({ preventScroll: true });
  }, [params, ready, buyerId, own.isFetched]);
  return (
    <section
      className="product-reviews"
      id="opiniones"
      aria-labelledby="product-reviews-heading"
      data-testid="product-reviews"
    >
      <div className="reviews-heading">
        <div>
          <h2 id="product-reviews-heading" ref={heading} tabIndex={-1}>
            Opiniones de compradores
          </h2>
          <p>Calificaciones de quienes compraron y recibieron este producto.</p>
        </div>
        {ready && !buyerId ? (
          <Link
            prefetch={false}
            className="button secondary"
            href={authHref('/cuenta', (routePath ?? '/p/' + encodeURIComponent(slug)) + '?' + back)}
          >
            Calificar mi compra
          </Link>
        ) : ready && first && !editing ? (
          <button
            type="button"
            className="button secondary"
            disabled={!freshOwn}
            onClick={() => {
              setNotice('');
              setSelectedPurchase(first);
              setEditing(true);
            }}
          >
            {own.data?.reviews.some((r) => r.order_item_id === first.id) ? 'Editar mi opinión' : 'Calificar mi compra'}
          </button>
        ) : null}
      </div>
      {!ready || opinions.isPending ? (
        <p className="muted" role="status">
          Cargando opiniones…
        </p>
      ) : opinions.isError && !opinions.data ? (
        <QueryError error={opinions.error} retry={() => opinions.refetch()} />
      ) : summary?.count ? (
        <div className="review-summary">
          <strong>
            {Number(summary.avg).toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span> / 5</span>
          </strong>
          <Rating value={Number(summary.avg)} />
          <span>
            {summary.count} {summary.count === 1 ? 'opinión' : 'opiniones'}
          </span>
        </div>
      ) : (
        <p className="review-empty" data-testid="product-reviews-empty">
          Aún no hay opiniones de este producto. Tu experiencia puede ayudar a otros compradores.
        </p>
      )}
      {buyerId && own.isPending && (
        <p className="muted" role="status">
          Comprobando tus compras…
        </p>
      )}
      {buyerId && own.isError && (
        <div>
          <p>No pudimos comprobar si puedes calificar esta compra.</p>
          <QueryError error={own.error} retry={() => own.refetch()} />
        </div>
      )}
      {buyerId && freshOwn && !first && (
        <p className="review-eligibility">
          {own.data.items.length
            ? 'Ya calificaste tus compras de este producto. El plazo de edición es de 60 días desde que publicas tu opinión.'
            : 'Podrás calificarlo cuando una compra de este producto figure como entregada en tus pedidos.'}{' '}
          <Link prefetch={false} href="/pedidos">
            Ver mis pedidos
          </Link>
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {editing && selected && freshOwn && !selectedEligible && (
        <p className="notice" role="status">
          Esta compra ya no está disponible para calificar. Conservamos tu comentario mientras revisas tus pedidos.
        </p>
      )}
      {editing && selected && buyerId && (
        <div className="review-editor">
          {choices.length > 1 && (
            <label className="review-purchase-label">
              Compra que quieres calificar
              <select
                disabled={!freshOwn || editorBusy}
                value={selected.id}
                onChange={(e) => setSelectedPurchase(choices.find((item) => item.id === e.target.value) ?? null)}
              >
                {choices.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    Compra {index + 1} · {variantDisplayTitle(item.variant_title) ?? item.title} · {item.quantity}{' '}
                    {item.quantity === 1 ? 'unidad' : 'unidades'}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ReviewForm
            key={selected.id}
            buyerId={buyerId}
            item={selected}
            existing={existing}
            fresh={freshOwn && selectedEligible}
            onBusy={setEditorBusy}
            onCancel={() => setEditing(false)}
            onSaved={async (status) => {
              setEditorBusy(false);
              setEditing(false);
              setNotice(
                status === 'hidden'
                  ? 'Guardamos los cambios. Tu opinión sigue oculta por moderación.'
                  : 'Tu opinión está publicada. Gracias por compartir tu experiencia.',
              );
              await Promise.all([
                qc.invalidateQueries({ queryKey: reviewKey(productId, buyerId) }),
                qc.invalidateQueries({ queryKey: ownKey(productId, buyerId) }),
              ]);
            }}
          />
        </div>
      )}
      <div className="review-list">
        {items.map((review) => (
          <ReviewEntry key={review.id} review={review} storeName={storeName} />
        ))}
      </div>
      {opinions.isError && opinions.data && !opinions.isFetchNextPageError && (
        <QueryError error={opinions.error} retry={() => opinions.refetch()} />
      )}
      {opinions.isFetchNextPageError && <QueryError error={opinions.error} retry={() => opinions.fetchNextPage()} />}
      {opinions.hasNextPage && (
        <button
          type="button"
          className="button secondary"
          disabled={opinions.isFetchingNextPage}
          onClick={() => opinions.fetchNextPage()}
        >
          {opinions.isFetchingNextPage ? 'Cargando…' : 'Ver más opiniones'}
        </button>
      )}
    </section>
  );
}
function ReviewForm({
  buyerId,
  item,
  existing,
  fresh,
  onBusy,
  onCancel,
  onSaved,
}: {
  buyerId: string;
  item: OrderItem;
  existing?: MyReview;
  fresh: boolean;
  onBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (status: MyReview['status']) => Promise<void>;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const submit = useMutation({
    mutationFn: async (snapshot: { rating: number; body: string }) => {
      const bound = await captureBuyerApi(buyerId);
      await bound.assertCurrent();
      if (!mounted.current) throw new Error('La cuenta cambió. Vuelve a abrir tu opinión.');
      const result = await bound.api.reviews.submit(item.id, snapshot.rating, snapshot.body || null);
      await bound.assertCurrent();
      return result;
    },
    onSuccess: async (result) => {
      if (mounted.current) await onSaved(result.status);
    },
    onSettled: () => {
      pending.current = false;
      if (mounted.current) onBusy(false);
    },
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !fresh || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.length > 1000)
      return;
    pending.current = true;
    onBusy(true);
    submit.mutate({ rating, body: body.trim() });
  };
  return (
    <form
      onSubmit={save}
      className="review-form"
      aria-label={existing ? 'Editar mi opinión' : 'Calificar mi compra'}
      data-testid="product-review-form"
    >
      <h3>{existing ? 'Edita tu opinión' : '¿Qué tal tu compra?'}</h3>
      {existing?.status === 'hidden' && (
        <p className="notice">
          Tu opinión está oculta por moderación. Editarla no la publica de nuevo automáticamente.
        </p>
      )}
      <fieldset disabled={submit.isPending || !fresh}>
        <legend>Tu calificación</legend>
        <div className="review-rating-input">
          {words.map((word, i) => (
            <label key={word}>
              <input
                className="sr-only"
                type="radio"
                name="rating"
                value={i + 1}
                checked={rating === i + 1}
                onChange={() => setRating(i + 1)}
                aria-label={`${i + 1} ${i === 0 ? 'estrella' : 'estrellas'}: ${word}`}
              />
              <Star size={25} aria-hidden="true" fill={i < rating ? 'currentColor' : 'none'} />
              <span className="sr-only">{word}</span>
            </label>
          ))}
        </div>
        <p className="review-rating-word" aria-live="polite">
          {rating ? words[rating - 1] : 'Elige de 1 a 5 estrellas'}
        </p>
        <label className="review-body-label" htmlFor={`review-body-${item.id}`}>
          Tu comentario <span>(opcional)</span>
        </label>
        <textarea
          id={`review-body-${item.id}`}
          value={body}
          maxLength={1000}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
          aria-describedby={`review-help-${item.id}`}
          placeholder="Calidad, tamaño, cómo llegó…"
        />
        <p className="review-form-help" id={`review-help-${item.id}`}>
          {body.length}/1000 · Se publica con tu nombre y la inicial de tu apellido.
        </p>
      </fieldset>
      {submit.isError && (
        <p className="error" role="alert">
          {submit.error.message || 'No pudimos guardar tu opinión.'} Conservamos tu comentario; vuelve a intentarlo.
        </p>
      )}
      <div className="review-form-actions">
        <button type="button" className="button secondary" disabled={submit.isPending} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className="button"
          disabled={!fresh || !rating || submit.isPending}
          aria-busy={submit.isPending}
        >
          {submit.isPending ? 'Guardando…' : existing ? 'Guardar cambios' : 'Publicar opinión'}
        </button>
      </div>
    </form>
  );
}
