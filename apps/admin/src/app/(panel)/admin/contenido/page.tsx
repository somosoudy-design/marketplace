'use client';
import { photoTones, type PhotoTone } from '@kora/design-tokens';
import { MODERATION_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Thumb, Toggle, cx } from '@/components/ui';
import { date, money } from '@/lib/format';
import { catalogImage, db, run } from '@/lib/kora';

interface Collection {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  tone: PhotoTone;
  sort: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  collection_products: { product_id: string; sort: number }[];
}
interface ProductCard {
  id: string;
  title: string;
  store_name: string;
  image_path: string | null;
  price_usd: string;
  moderation_status: string;
  store_status: string;
}

const TONE_LABEL: Record<PhotoTone, string> = { sand: 'Arena', sage: 'Salvia', blush: 'Rubor', mist: 'Bruma', clay: 'Arcilla', lilac: 'Lila', night: 'Noche' };
const TONES = Object.keys(photoTones) as PhotoTone[];

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const toLocalInput = (v: string | null) => (v ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function live(c: Collection) {
  const now = Date.now();
  if (!c.active) return { label: 'Oculta', tone: 'neutral' as const };
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return { label: `Desde ${date(c.starts_at)}`, tone: 'info' as const };
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return { label: 'Finalizada', tone: 'neutral' as const };
  return { label: 'Visible', tone: 'success' as const };
}

export default function ContentPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['collections'],
    queryFn: () => run<Collection[]>(db('collections').select('id, slug, title, subtitle, tone, sort, active, starts_at, ends_at, collection_products(product_id, sort)').order('sort').order('created_at')),
  });
  useEffect(() => {
    if (!selected && list.data?.length) setSelected(list.data[0]!.id);
  }, [list.data, selected]);

  const reorder = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const rows = [...(list.data ?? [])];
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved!);
      await Promise.all(rows.map((r, i) => (r.sort === i + 1 ? null : run(db('collections').update({ sort: i + 1 }).eq('id', r.id)))));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
    onError: toast.error,
  });
  const toggle = useMutation({
    mutationFn: (c: Collection) => run(db('collections').update({ active: !c.active }).eq('id', c.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
    onError: toast.error,
  });

  const current = list.data?.find((c) => c.id === selected) ?? null;
  const firstVisible = list.data?.find((c) => live(c).tone === 'success');

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Contenido editorial"
        description="Las colecciones arman el inicio de la app. La primera visible aparece destacada; las demás, como carruseles en el orden que definas. Solo se muestran productos publicados de tiendas activas."
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>Nueva colección</Button>}
      />
      {list.isPending ? <Loading /> : list.isError ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : !list.data.length ? (
        <Card><Empty title="Sin colecciones" body="Crea la primera para darle forma al inicio de la app." action={<Button icon={Plus} onClick={() => setCreating(true)}>Nueva colección</Button>} /></Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {list.data.map((c, i) => {
                const st = live(c);
                return (
                  <li key={c.id} className={cx('flex items-center gap-3 px-4 py-3', c.id === selected && 'bg-brand-soft/60')}>
                    <span className="size-9 shrink-0 rounded-[10px] border border-line" style={{ background: photoTones[c.tone]?.bg }} aria-hidden />
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(c.id)} aria-current={c.id === selected ? 'true' : undefined}>
                      <span className="block truncate font-semibold text-ink">{c.title}</span>
                      <span className="flex items-center gap-2 text-[12.5px] text-ink-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {c.collection_products.length} productos{firstVisible?.id === c.id ? ' · destacada' : ''}
                      </span>
                    </button>
                    <div className="flex flex-col">
                      <button aria-label={`Subir ${c.title}`} disabled={i === 0 || reorder.isPending} onClick={() => reorder.mutate({ from: i, to: i - 1 })} className="rounded p-0.5 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowUp size={15} /></button>
                      <button aria-label={`Bajar ${c.title}`} disabled={i === list.data.length - 1 || reorder.isPending} onClick={() => reorder.mutate({ from: i, to: i + 1 })} className="rounded p-0.5 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowDown size={15} /></button>
                    </div>
                    <Toggle checked={c.active} label={`Mostrar ${c.title}`} onChange={() => toggle.mutate(c)} />
                  </li>
                );
              })}
            </ul>
          </Card>
          {current ? <CollectionEditor key={current.id} collection={current} onDeleted={() => setSelected(null)} /> : null}
        </div>
      )}
      <CreateCollection open={creating} nextSort={(list.data?.length ?? 0) + 1} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelected(id); }} />
    </>
  );
}

function CreateCollection({ open, nextSort, onClose, onCreated }: { open: boolean; nextSort: number; onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tone, setTone] = useState<PhotoTone>('sand');
  const create = useMutation({
    mutationFn: () => run<{ id: string }>(db('collections').insert({ title: title.trim(), subtitle: subtitle.trim() || null, tone, slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`, sort: nextSort, active: false }).select('id').single()),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      toast.ok('Colección creada. Agrega productos y actívala cuando esté lista.');
      setTitle('');
      setSubtitle('');
      onCreated(r.id);
    },
    onError: toast.error,
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nueva colección"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={title.trim().length < 3} loading={create.isPending} onClick={() => create.mutate()}>Crear</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Título"><Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ideas para regalar" /></Field>
        <Field label="Subtítulo" hint="Opcional. Una línea corta."><Input value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.target.value)} placeholder="Menos de 50 USD" /></Field>
        <ToneField value={tone} onChange={setTone} />
        <Notice tone="info">Se crea oculta para que puedas armarla antes de mostrarla.</Notice>
      </div>
    </Dialog>
  );
}

function ToneField({ value, onChange }: { value: PhotoTone; onChange: (t: PhotoTone) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Tono de fondo</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            onClick={() => onChange(t)}
            className={cx('flex items-center gap-2 rounded-full border px-2.5 py-1 text-[13px] font-semibold', value === t ? 'border-brand text-brand' : 'border-line-strong text-ink-2')}
          >
            <span className="size-4 rounded-full border border-line" style={{ background: photoTones[t].bg }} />
            {TONE_LABEL[t]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function CollectionEditor({ collection: c, onDeleted }: { collection: Collection; onDeleted: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ title: c.title, subtitle: c.subtitle ?? '', tone: c.tone, starts: toLocalInput(c.starts_at), ends: toLocalInput(c.ends_at) });
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = [...c.collection_products].sort((a, b) => a.sort - b.sort).map((p) => p.product_id);

  const products = useQuery({
    queryKey: ['collection-products', c.id, ids],
    queryFn: () => run<ProductCard[]>(db('product_cards').select('id, title, store_name, image_path, price_usd, moderation_status, store_status').in('id', ids)),
    enabled: ids.length > 0,
  });
  const ordered = ids.map((id) => products.data?.find((p) => p.id === id)).filter((p): p is ProductCard => !!p);
  const search = useQuery({
    queryKey: ['collection-search', q],
    queryFn: () => run<ProductCard[]>(db('product_cards').select('id, title, store_name, image_path, price_usd, moderation_status, store_status').ilike('title', `%${q.trim()}%`).order('popularity', { ascending: false }).limit(8)),
    enabled: q.trim().length >= 2,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['collections'] });
  const save = useMutation({
    mutationFn: () => {
      const starts = fromLocalInput(form.starts);
      const ends = fromLocalInput(form.ends);
      if (starts && ends && ends <= starts) throw new Error('La fecha de fin debe ser posterior al inicio.');
      return run(db('collections').update({ title: form.title.trim(), subtitle: form.subtitle.trim() || null, tone: form.tone, starts_at: starts, ends_at: ends }).eq('id', c.id));
    },
    onSuccess: () => { invalidate(); toast.ok('Colección guardada.'); },
    onError: toast.error,
  });
  const add = useMutation({
    mutationFn: (productId: string) => run(db('collection_products').insert({ collection_id: c.id, product_id: productId, sort: ids.length })),
    onSuccess: invalidate,
    onError: toast.error,
  });
  const remove = useMutation({
    mutationFn: (productId: string) => run(db('collection_products').delete().eq('collection_id', c.id).eq('product_id', productId)),
    onSuccess: invalidate,
    onError: toast.error,
  });
  const move = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const next = [...ids];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m!);
      await Promise.all(next.map((id, i) => run(db('collection_products').update({ sort: i }).eq('collection_id', c.id).eq('product_id', id))));
    },
    onSuccess: invalidate,
    onError: toast.error,
  });
  const del = useMutation({
    mutationFn: () => run(db('collections').delete().eq('id', c.id)),
    onSuccess: () => { invalidate(); onDeleted(); toast.ok('Colección eliminada.'); },
    onError: toast.error,
  });

  const hiddenCount = ordered.filter((p) => p.moderation_status !== 'published' || p.store_status !== 'active').length;
  const dirty = form.title !== c.title || form.subtitle !== (c.subtitle ?? '') || form.tone !== c.tone || form.starts !== toLocalInput(c.starts_at) || form.ends !== toLocalInput(c.ends_at);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Datos de la colección" actions={<Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Eliminar</Button>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título"><Input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Subtítulo"><Input value={form.subtitle} maxLength={80} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
          <Field label="Visible desde" hint="Opcional. Hora de Venezuela."><Input type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} /></Field>
          <Field label="Visible hasta" hint="Opcional."><Input type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} /></Field>
          <div className="md:col-span-2"><ToneField value={form.tone} onChange={(tone) => setForm({ ...form, tone })} /></div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button disabled={!dirty || form.title.trim().length < 3} loading={save.isPending} onClick={() => save.mutate()}>Guardar cambios</Button>
        </div>
      </Card>

      <Card title={`Productos (${ids.length})`}>
        {hiddenCount ? <div className="mb-4"><Notice tone="warning">{hiddenCount === 1 ? 'Un producto no se muestra' : `${hiddenCount} productos no se muestran`} porque no está publicado o su tienda no está activa.</Notice></div> : null}
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <Input aria-label="Buscar productos para agregar" placeholder="Buscar productos para agregar" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        {q.trim().length >= 2 ? (
          <ul className="mb-5 divide-y divide-line rounded-[14px] border border-line">
            {search.isPending ? <li className="px-4 py-3 text-sm text-ink-3">Buscando…</li> : !search.data?.length ? <li className="px-4 py-3 text-sm text-ink-3">Sin resultados.</li> : search.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Thumb src={catalogImage(p.image_path)} alt={p.title} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-[12px] text-ink-3">{p.store_name} · {money(p.price_usd, 'USD')}{p.moderation_status !== 'published' ? ` · ${MODERATION_LABEL[p.moderation_status as keyof typeof MODERATION_LABEL] ?? p.moderation_status}` : ''}</p>
                </div>
                {ids.includes(p.id) ? <Badge>Ya incluido</Badge> : <Button size="sm" variant="secondary" icon={Plus} loading={add.isPending && add.variables === p.id} onClick={() => add.mutate(p.id)}>Agregar</Button>}
              </li>
            ))}
          </ul>
        ) : null}
        {!ids.length ? <p className="py-6 text-center text-sm text-ink-3">Busca productos para agregarlos a esta colección.</p> : products.isPending ? <Loading rows={3} /> : (
          <ol className="divide-y divide-line">
            {ordered.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right text-[12px] font-bold text-ink-3 tabular">{i + 1}</span>
                <Thumb src={catalogImage(p.image_path)} alt={p.title} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-[12px] text-ink-3">{p.store_name} · {money(p.price_usd, 'USD')}</p>
                </div>
                {p.moderation_status !== 'published' || p.store_status !== 'active' ? <Badge tone="warning">No visible</Badge> : null}
                <div className="flex">
                  <button aria-label={`Subir ${p.title}`} disabled={i === 0 || move.isPending} onClick={() => move.mutate({ from: i, to: i - 1 })} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button aria-label={`Bajar ${p.title}`} disabled={i === ordered.length - 1 || move.isPending} onClick={() => move.mutate({ from: i, to: i + 1 })} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30"><ArrowDown size={15} /></button>
                  <button aria-label={`Quitar ${p.title}`} onClick={() => remove.mutate(p.id)} className="rounded p-1 text-ink-3 hover:text-danger"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar colección"
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>Eliminar</Button></>}
      >
        <p className="text-sm text-ink-2">Se elimina «{c.title}» del inicio. Los productos no se borran. Si solo quieres ocultarla, usa el interruptor de la lista.</p>
      </Dialog>
    </div>
  );
}
