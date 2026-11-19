'use client';
import { variantDisplayTitle } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { UgcStaffReview } from '@kora/api';
import { useToast } from './toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Select, Tabs, Textarea } from './ui';
import { ago, dateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { run } from '@/lib/kora';
import { useUgc } from '@/lib/ugc';
import { UgcReportsBoard } from './UgcReports';

type Review = UgcStaffReview & {
  is_demo?: boolean;
  products: { title: string; slug: string } | null;
  stores: { name: string } | null;
  order_items: { variant_title: string | null } | null;
};
const PAGE_SIZE = 20;


export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span aria-label={`${value} de 5 estrellas`} className="whitespace-nowrap tracking-[1px]" style={{ fontSize: size }}>
      <span className="text-[var(--accent,#F2A541)]">{'★'.repeat(value)}</span>
      <span className="text-line-strong">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

/**
 * Admin moderates (hide with a reason, publish again); a store answers its buyers publicly. Ratings shown in the
 * app are recalculated by the database whenever a review changes state, so neither role edits scores.
 */
export function ReviewsBoard(props: { role: 'admin' | 'seller'; storeId?: string }) {
  const { userId } = useAuth();
  return <ReviewsForActor key={`${userId ?? 'guest'}:${props.role}:${props.storeId ?? 'all'}`} {...props} />;
}

function ReviewsForActor({ role, storeId }: { role: 'admin' | 'seller'; storeId?: string }) {
  const ugc = useUgc();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'published' | 'hidden'>('published');
  const [stars, setStars] = useState('');
  const [pending, setPending] = useState(role === 'seller');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<{ review: Review; target: 'review' | 'reply' } | null>(null);
  const q = useQuery({
    queryKey: ['ugc-staff-reviews', ugc.actorId, role, storeId, tab, stars, pending, page],
    enabled: ugc.actorReady !== false && !!ugc.actorId && (role === 'admin' || !!storeId),
    queryFn: () => ugc.run(api => api.ugc.staffPage({
      storeId: storeId ?? null, status: tab, maxRating: stars ? Number(stars) : null,
      pending: role === 'seller' && pending && tab === 'published', limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    })),
  });
  const rows = (q.data?.items ?? []) as Review[];
  const ids = role === 'admin' ? [...new Set(rows.map(row => row.user_id))].sort() : [];
  const names = useQuery({
    queryKey: ['ugc-review-authors', ugc.actorId, ids],
    enabled: ugc.actorReady !== false && !!ugc.actorId && ids.length > 0,
    queryFn: () => ugc.run(api => run<{ id: string; full_name: string | null }[]>(api.client.from('profiles').select('id, full_name').in('id', ids))),
  });
  const name = (id: string) => names.data?.find(row => row.id === id)?.full_name ?? 'Cliente';
  const summary = useQuery({
    queryKey: ['ugc-reviews-summary', ugc.actorId, storeId],
    queryFn: () => ugc.run(api => run<{ rating_avg: number | null; rating_count: number }>(api.client.from('stores').select('rating_avg, rating_count').eq('id', storeId!).single())),
    enabled: ugc.actorReady !== false && !!ugc.actorId && role === 'seller' && !!storeId,
  });
  const refresh = async () => {
    if (!ugc.isCurrent()) return;
    await Promise.all([
      ugc.refresh(),
      qc.invalidateQueries({ queryKey: ['ugc-staff-reviews', ugc.actorId] }),
      qc.invalidateQueries({ queryKey: ['ugc-reviews-summary', ugc.actorId] }),
    ]);
  };

  // with the "unanswered" filter on, an empty list means everything is answered only if there is something to answer
  const answeredAll = role === 'seller' && pending && tab === 'published' && !!summary.data?.rating_count;

  if (ugc.actorReady === false) return <Loading />;
  return (
    <>
      {role === 'seller' && summary.data ? (
        <div className="mb-5 flex flex-wrap items-center gap-6 rounded-[20px] border border-line bg-surface px-6 py-5">
          <div>
            <p className="text-[13px] font-semibold text-ink-3">Calificación de la tienda</p>
            {summary.data.rating_count ? (
              <p className="font-display text-3xl font-semibold">{Number(summary.data.rating_avg).toFixed(1).replace('.', ',')}</p>
            ) : (
              <p className="mt-1 font-display text-xl font-semibold text-ink-2">Aún sin opiniones</p>
            )}
          </div>
          {summary.data.rating_count ? (
            <div className="text-[14px] text-ink-2">
              <Stars value={Math.round(Number(summary.data.rating_avg))} size={18} />
              <p>{summary.data.rating_count === 1 ? '1 opinión publicada' : `${summary.data.rating_count} opiniones publicadas`}</p>
            </div>
          ) : null}
          <p className="max-w-md text-[13px] text-ink-3">Solo opinan compradores con la entrega completada. Responder con amabilidad y una solución concreta es lo que más confianza genera.</p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs flush value={tab} onChange={value => { setTab(value); setPage(0); }} items={[{ value: 'published', label: 'Publicadas' }, { value: 'hidden', label: 'Ocultas' }]} />
        <div className="flex flex-wrap items-center gap-4">
          {role === 'seller' && tab === 'published' ? (
            <label className="flex items-center gap-2 text-[14px] font-semibold text-ink-2">
              <input type="checkbox" checked={pending} onChange={(e) => { setPending(e.target.checked); setPage(0); }} className="size-4 accent-[var(--brand)]" />
              Solo sin responder
            </label>
          ) : null}
          <div className="w-60">
            <Select aria-label="Calificación" value={stars} onChange={(e) => { setStars(e.target.value); setPage(0); }}>
              <option value="">Todas las calificaciones</option>
              <option value="2">2 estrellas o menos</option>
              <option value="3">3 estrellas o menos</option>
            </Select>
          </div>
        </div>
      </div>

      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
          <Empty
            title={tab === 'hidden' ? 'No hay opiniones ocultas' : stars ? 'Ninguna opinión con esa calificación' : answeredAll ? 'Respondiste todas las opiniones' : 'Aún no hay opiniones'}
            body={tab === 'hidden' ? 'Aquí quedan las que la plataforma retira por incumplir las normas, con su motivo.' : answeredAll ? 'Desmarca «Solo sin responder» para verlas con tus respuestas.' : 'Aparecen cuando un comprador califica una entrega completada.'}
          />
        ) : (
          <ul className="divide-y divide-line" data-testid="reviews-list">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:gap-5" data-testid={`review-row-${r.id}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    <span className="font-semibold">{r.products?.title}</span>
                    {role === 'admin' ? <span className="text-[13px] text-ink-3">{r.stores?.name}</span> : null}
                    {r.is_demo ? <Badge tone="neutral">Demostración</Badge> : null}
                  </div>
                  {r.body ? <p className="text-[15px] text-ink">{r.body}</p> : <p className="text-[14px] italic text-ink-3">Sin comentario, solo calificación.</p>}
                  <p className="text-[13px] text-ink-3">
                    {role === 'admin' ? `${name(r.user_id)} · ` : ''}Compra verificada{variantDisplayTitle(r.order_items?.variant_title) ? ` · ${variantDisplayTitle(r.order_items?.variant_title)}` : ''} · {ago(r.created_at)}
                  </p>
                  {r.reply_body ? (
                    <div className="mt-1 border-l-2 border-line pl-3">
                      <p className="text-[13px] font-semibold text-ink-2">Respuesta de la tienda · {ago(r.reply_at)}</p>
                      <p className="text-[14px] text-ink-2">{r.reply_body}</p>
                      {r.reply_status === 'hidden' ? <Notice tone="warning" title="Respuesta oculta">{r.reply_hidden_reason ?? 'Retirada por moderación.'}</Notice> : null}
                    </div>
                  ) : null}
                  {r.status === 'hidden' && r.hidden_reason ? <Notice tone="warning" title="Oculta">{r.hidden_reason}</Notice> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {role === 'seller' && r.status === 'published' ? (
                    <Button size="sm" variant={r.reply_body ? 'secondary' : 'primary'} onClick={() => setOpen({ review: r, target: 'reply' })} data-testid={`reply-${r.id}`}>{r.reply_body ? 'Editar respuesta' : 'Responder'}</Button>
                  ) : null}
                  {role === 'admin' ? (
                    <Button size="sm" variant={r.status === 'published' ? 'secondary' : 'primary'} onClick={() => setOpen({ review: r, target: 'review' })} data-testid={`moderate-${r.id}`}>{r.status === 'published' ? 'Ocultar' : 'Publicar de nuevo'}</Button>
                  ) : null}
                  {role === 'admin' && r.reply_body ? (
                    <Button size="sm" variant="secondary" disabled={!ugc.enabled} onClick={() => setOpen({ review: r, target: 'reply' })} data-testid={`moderate-reply-${r.id}`}>
                      {r.reply_status === 'hidden' ? 'Restaurar respuesta' : 'Ocultar respuesta'}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {q.data && (q.data.total > PAGE_SIZE || page > 0) ? (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Páginas de opiniones">
          <Button variant="secondary" disabled={page === 0 || q.isFetching} onClick={() => setPage(value => value - 1)}>Anterior</Button>
          <span className="text-sm text-ink-3" aria-live="polite">Página {page + 1} · {q.data.total} opiniones</span>
          <Button variant="secondary" disabled={(page + 1) * PAGE_SIZE >= q.data.total || q.isFetching} onClick={() => setPage(value => value + 1)}>Siguiente</Button>
        </nav>
      ) : null}
      {open && role === 'seller' ? <ReplyDialog key={`${ugc.actorId}:${storeId}:${open.review.id}`} review={open.review} onClose={() => setOpen(null)} onSaved={refresh} /> : null}
      {open && role === 'admin' ? <ModerateDialog key={`${ugc.actorId}:${open.target}:${open.review.id}`} review={open.review} target={open.target} onClose={() => setOpen(null)} onSaved={refresh} /> : null}
      {role === 'admin' ? <div className="mt-8"><UgcReportsBoard /></div> : null}
    </>
  );
}

function ReplyDialog({ review: r, onClose, onSaved }: { review: Review; onClose: () => void; onSaved: () => Promise<void> }) {
  const ugc = useUgc();
  const toast = useToast();
  const sending = useRef(false);
  const cancel = () => { if (!sending.current) onClose(); };
  const [body, setBody] = useState(r.reply_body ?? '');
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);
  const policy = ugc.state.data;
  const accepted = !!policy && 'accepted' in policy && policy.accepted;
  const consent = !!policy && (accepted || acceptedVersion === policy.version);
  const save = useMutation({
    onSettled: () => { sending.current = false; },
    mutationFn: async () => {
      const fresh = await ugc.run(api => api.ugc.status());
      if (!fresh.accepted) {
        if (acceptedVersion !== fresh.version) throw new Error('Lee y acepta las normas vigentes antes de publicar.');
        await ugc.run(api => api.ugc.accept(fresh.version));
      }
      return ugc.run(api => api.reviews.reply(r.id, body.trim()));
    },
    onSuccess: () => {
      if (!ugc.isCurrent()) return;
      toast.ok(r.reply_status === 'hidden' ? 'Respuesta guardada; sigue oculta por moderación.' : 'Respuesta publicada');
      onClose(); void onSaved().catch(error => { if (ugc.isCurrent()) toast.error(error); });
    },
    onError: () => { if (ugc.isCurrent()) void ugc.state.refetch(); },
  });
  if (ugc.actorReady === false) return null;
  return (
    <Dialog open busy={save.isPending} onClose={cancel} title="Responder opinión"
      footer={<><Button variant="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</Button><Button disabled={!body.trim() || body.length > 1000 || !consent || !ugc.state.isSuccess || ugc.state.isFetching} loading={save.isPending} onClick={() => { if (!sending.current) { sending.current = true; save.mutate(); } }} data-testid="reply-save">{r.reply_status === 'hidden' ? 'Guardar respuesta oculta' : 'Publicar respuesta'}</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] bg-sunken px-4 py-3"><Stars value={r.rating} /><p className="mt-1 text-[15px]">{r.body ?? 'Sin comentario.'}</p></div>
        <Field label="Tu respuesta (pública)" hint={`${body.length}/1000 · Evita datos personales; para resolver un problema usa el reclamo del pedido.`}>
          <Textarea value={body} disabled={save.isPending} onChange={event => setBody(event.target.value.slice(0, 1000))} rows={5} data-testid="reply-body" />
        </Field>
        {ugc.state.isPending ? <Loading /> : ugc.state.isError ? <ErrorBox error={ugc.state.error} onRetry={() => ugc.state.refetch()} /> : policy ? (
          <section aria-label="Normas de opiniones y respuestas" className="rounded-[14px] border border-line p-4 text-sm text-ink-2">
            <p className="font-semibold">{policy.policy.title}</p>
            <div className="my-3 space-y-2">{policy.policy.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
            {accepted ? <p>Ya aceptaste estas normas vigentes.</p> : <label className="flex items-start gap-2 font-semibold"><input type="checkbox" checked={acceptedVersion === policy.version} disabled={save.isPending} onChange={event => setAcceptedVersion(event.target.checked ? policy.version : null)} className="mt-0.5 size-4 accent-[var(--brand)]" data-testid="reply-accept-policy" />He leído y acepto estas normas para publicar mi respuesta.</label>}
          </section>
        ) : null}
        {r.reply_status === 'hidden' ? <Notice tone="warning">Editar no vuelve a publicar una respuesta retirada por moderación.</Notice> : null}
        {save.error ? <ErrorBox error={save.error} /> : null}
      </div>
    </Dialog>
  );
}

function ModerateDialog({ review: r, target, onClose, onSaved }: { review: Review; target: 'review' | 'reply'; onClose: () => void; onSaved: () => Promise<void> }) {
  const ugc = useUgc();
  const toast = useToast();
  const sending = useRef(false);
  const cancel = () => { if (!sending.current) onClose(); };
  const reply = target === 'reply';
  const hide = reply ? r.reply_status !== 'hidden' : r.status === 'published';
  const [reason, setReason] = useState('');
  const save = useMutation({
    onSettled: () => { sending.current = false; },
    mutationFn: () => ugc.run(api => reply ? api.ugc.moderateReply(r.id, hide, hide ? reason.trim() : null) : api.reviews.moderate(r.id, hide, hide ? reason.trim() : undefined)),
    onSuccess: () => {
      if (!ugc.isCurrent()) return;
      toast.ok(reply ? (hide ? 'Respuesta oculta; la opinión se conserva.' : 'Respuesta restaurada') : (hide ? 'Opinión oculta' : 'Opinión publicada'));
      onClose(); void onSaved().catch(error => { if (ugc.isCurrent()) toast.error(error); });
    },
  });
  const noun = reply ? 'respuesta' : 'opinión';
  if (ugc.actorReady === false) return null;
  return (
    <Dialog open busy={save.isPending} onClose={cancel} title={hide ? `Ocultar ${noun}` : `Restaurar ${noun}`}
      footer={<><Button variant="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</Button><Button variant={hide ? 'danger' : 'primary'} disabled={(hide && !reason.trim()) || (reply && !ugc.enabled)} loading={save.isPending} onClick={() => { if (!sending.current) { sending.current = true; save.mutate(); } }} data-testid="moderate-save">{hide ? 'Ocultar' : 'Restaurar'}</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] bg-sunken px-4 py-3"><Stars value={r.rating} /> <span className="font-semibold">{r.products?.title}</span><p className="mt-1 text-[15px]">{reply ? r.reply_body : r.body ?? 'Sin comentario.'}</p><p className="mt-1 text-[13px] text-ink-3">{dateTime(reply ? r.reply_at ?? r.created_at : r.created_at)}</p></div>
        {hide ? <Field label={reply ? 'Motivo para la tienda' : 'Motivo (lo ve el autor)'} hint={reply ? 'Sólo se oculta la respuesta. La opinión y su calificación se conservan.' : 'Ocultar conserva la opinión y el motivo; deja de contar en la calificación.'}>
          <Select value={reason} disabled={save.isPending} onChange={event => setReason(event.target.value)} data-testid="moderate-reason"><option value="">Elige un motivo</option><option value="Incluye datos personales">Incluye datos personales</option><option value="Lenguaje ofensivo">Lenguaje ofensivo</option><option value="No habla del producto ni de la compra">No habla del producto ni de la compra</option><option value="Publicidad o enlaces externos">Publicidad o enlaces externos</option></Select>
        </Field> : <p className="text-[15px] text-ink-2">{reply ? 'Se restaura sólo la respuesta de la tienda.' : 'Vuelve a mostrarse y a contar en la calificación.'}</p>}
        <Notice tone="info">Una opinión negativa pero honesta no es motivo para ocultarla.</Notice>
        {reply && !ugc.enabled ? <Notice tone="warning">La moderación de respuestas aún no está disponible.</Notice> : null}
        {save.error ? <ErrorBox error={save.error} /> : null}
      </div>
    </Dialog>
  );
}
