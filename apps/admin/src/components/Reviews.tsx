'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from './toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Select, Tabs, Textarea } from './ui';
import { ago, dateTime } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, kora, run } from '@/lib/kora';

type Review = {
  id: string; product_id: string; store_id: string; user_id: string; rating: number; body: string | null; status: 'published' | 'hidden';
  hidden_reason: string | null; reply_body: string | null; reply_at: string | null; is_demo: boolean; created_at: string;
  products: { title: string; slug: string } | null; stores: { name: string } | null; order_items: { variant_title: string | null } | null;
};

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
export function ReviewsBoard({ role, storeId }: { role: 'admin' | 'seller'; storeId?: string }) {
  const [tab, setTab] = useState<'published' | 'hidden'>('published');
  const [stars, setStars] = useState<string>('');
  const [pending, setPending] = useState(role === 'seller');
  const [open, setOpen] = useState<Review | null>(null);
  const q = useQuery({
    queryKey: ['reviews', role, storeId, tab, stars, pending],
    queryFn: () => {
      let r = db('reviews').select('*, products(title, slug), stores(name), order_items(variant_title)').eq('status', tab).order('created_at', { ascending: false }).limit(200);
      if (storeId) r = r.eq('store_id', storeId);
      if (stars) r = r.lte('rating', Number(stars));
      if (role === 'seller' && pending && tab === 'published') r = r.is('reply_body', null);
      return run<Review[]>(r);
    },
  });
  const name = useProfiles(role === 'admin' ? (q.data ?? []).map((r) => r.user_id) : []);
  const summary = useQuery({
    queryKey: ['reviews-summary', storeId],
    queryFn: () => run<{ rating_avg: number | null; rating_count: number }>(db('stores').select('rating_avg, rating_count').eq('id', storeId!).single()),
    enabled: role === 'seller' && !!storeId,
  });

  // with the "unanswered" filter on, an empty list means everything is answered only if there is something to answer
  const answeredAll = role === 'seller' && pending && tab === 'published' && !!summary.data?.rating_count;

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
        <Tabs flush value={tab} onChange={setTab} items={[{ value: 'published', label: 'Publicadas' }, { value: 'hidden', label: 'Ocultas' }]} />
        <div className="flex flex-wrap items-center gap-4">
          {role === 'seller' && tab === 'published' ? (
            <label className="flex items-center gap-2 text-[14px] font-semibold text-ink-2">
              <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              Solo sin responder
            </label>
          ) : null}
          <div className="w-60">
            <Select aria-label="Calificación" value={stars} onChange={(e) => setStars(e.target.value)}>
              <option value="">Todas las calificaciones</option>
              <option value="2">2 estrellas o menos</option>
              <option value="3">3 estrellas o menos</option>
            </Select>
          </div>
        </div>
      </div>

      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? (
          <Empty
            title={tab === 'hidden' ? 'No hay opiniones ocultas' : stars ? 'Ninguna opinión con esa calificación' : answeredAll ? 'Respondiste todas las opiniones' : 'Aún no hay opiniones'}
            body={tab === 'hidden' ? 'Aquí quedan las que la plataforma retira por incumplir las normas, con su motivo.' : answeredAll ? 'Desmarca «Solo sin responder» para verlas con tus respuestas.' : 'Aparecen cuando un comprador califica una entrega completada.'}
          />
        ) : (
          <ul className="divide-y divide-line" data-testid="reviews-list">
            {q.data.map((r) => (
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
                    {role === 'admin' ? `${name(r.user_id)} · ` : ''}Compra verificada{r.order_items?.variant_title ? ` · ${r.order_items.variant_title}` : ''} · {ago(r.created_at)}
                  </p>
                  {r.reply_body ? (
                    <div className="mt-1 border-l-2 border-line pl-3">
                      <p className="text-[13px] font-semibold text-ink-2">Respuesta de la tienda · {ago(r.reply_at)}</p>
                      <p className="text-[14px] text-ink-2">{r.reply_body}</p>
                    </div>
                  ) : null}
                  {r.status === 'hidden' && r.hidden_reason ? <Notice tone="warning" title="Oculta">{r.hidden_reason}</Notice> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {role === 'seller' && r.status === 'published' ? (
                    <Button size="sm" variant={r.reply_body ? 'secondary' : 'primary'} onClick={() => setOpen(r)} data-testid={`reply-${r.id}`}>{r.reply_body ? 'Editar respuesta' : 'Responder'}</Button>
                  ) : null}
                  {role === 'admin' ? (
                    <Button size="sm" variant={r.status === 'published' ? 'secondary' : 'primary'} onClick={() => setOpen(r)} data-testid={`moderate-${r.id}`}>{r.status === 'published' ? 'Ocultar' : 'Publicar de nuevo'}</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {open && role === 'seller' ? <ReplyDialog key={open.id} review={open} onClose={() => setOpen(null)} /> : null}
      {open && role === 'admin' ? <ModerateDialog key={open.id} review={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function ReplyDialog({ review: r, onClose }: { review: Review; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState(r.reply_body ?? '');
  const save = useMutation({
    mutationFn: () => kora().api.reviews.reply(r.id, body.trim()),
    onSuccess: () => { toast.ok('Respuesta publicada'); qc.invalidateQueries({ queryKey: ['reviews'] }); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open onClose={onClose} title="Responder opinión"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!body.trim() || body.length > 1000} loading={save.isPending} onClick={() => save.mutate()} data-testid="reply-save">Publicar respuesta</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] bg-sunken px-4 py-3">
          <Stars value={r.rating} />
          <p className="mt-1 text-[15px]">{r.body ?? 'Sin comentario.'}</p>
        </div>
        <Field label="Tu respuesta (pública)" hint={`${body.length}/1000 · El comprador recibe un aviso. Evita datos personales; para resolver un problema usa el reclamo del pedido.`}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} rows={5} data-testid="reply-body" />
        </Field>
      </div>
    </Dialog>
  );
}

function ModerateDialog({ review: r, onClose }: { review: Review; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const hide = r.status === 'published';
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => kora().api.reviews.moderate(r.id, hide, hide ? reason.trim() : undefined),
    onSuccess: () => { toast.ok(hide ? 'Opinión oculta' : 'Opinión publicada'); qc.invalidateQueries({ queryKey: ['reviews'] }); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open onClose={onClose} title={hide ? 'Ocultar opinión' : 'Publicar de nuevo'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={hide ? 'danger' : 'primary'} disabled={hide && !reason.trim()} loading={save.isPending} onClick={() => save.mutate()} data-testid="moderate-save">{hide ? 'Ocultar' : 'Publicar'}</Button></>}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] bg-sunken px-4 py-3">
          <Stars value={r.rating} /> <span className="font-semibold">{r.products?.title}</span>
          <p className="mt-1 text-[15px]">{r.body ?? 'Sin comentario.'}</p>
          <p className="mt-1 text-[13px] text-ink-3">{dateTime(r.created_at)}</p>
        </div>
        {hide ? (
          <>
            <Field label="Motivo (lo ve el autor)" hint="Ocultar no borra la opinión: deja de contar en la calificación y el autor puede verla con este motivo. Queda en auditoría.">
              <Select value={reason} onChange={(e) => setReason(e.target.value)} data-testid="moderate-reason">
                <option value="">Elige un motivo</option>
                <option value="Incluye datos personales">Incluye datos personales</option>
                <option value="Lenguaje ofensivo">Lenguaje ofensivo</option>
                <option value="No habla del producto ni de la compra">No habla del producto ni de la compra</option>
                <option value="Publicidad o enlaces externos">Publicidad o enlaces externos</option>
              </Select>
            </Field>
            <Notice tone="info">Una opinión negativa pero honesta no es motivo para ocultarla.</Notice>
          </>
        ) : (
          <p className="text-[15px] text-ink-2">Vuelve a mostrarse en la ficha y cuenta otra vez en la calificación del producto y de la tienda.{r.hidden_reason ? ` Se ocultó por: ${r.hidden_reason}.` : ''}</p>
        )}
      </div>
    </Dialog>
  );
}
