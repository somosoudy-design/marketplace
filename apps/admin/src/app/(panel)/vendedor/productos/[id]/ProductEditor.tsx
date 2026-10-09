'use client';
import { AVAILABILITY, MODERATION_LABEL, type Availability } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Textarea, cx } from '@/components/ui';
import { dateTime, moderationTone } from '@/lib/format';
import { useCategoriesIndex, useRouteId } from '@/lib/hooks';
import { catalogImage, db, kora, run } from '@/lib/kora';
import { useStore } from '@/lib/store';

type Variant = { id?: string; title: string; sku: string; price: string; stock: string; active: boolean };
type Img = { id?: string; path?: string; file?: File; preview: string };
type Product = {
  id: string; store_id: string; title: string; subtitle: string | null; description: string | null; highlights: string[]; category_id: string;
  availability: Availability; moderation_status: string; moderation_note: string | null; compare_at_usd: string | null; weight_kg: string; max_per_order: number;
  product_images: { id: string; path: string; sort: number }[];
  product_variants: { id: string; title: string; sku: string | null; price_usd: string; stock: number | null; active: boolean; sort: number }[];
  moderation_events: { id: number; to_status: string; note: string | null; automatic: boolean; created_at: string }[];
};

const PRICE = /^\d{1,7}([.,]\d{1,2})?$/;
const SELLER_AVAILABILITY: Availability[] = ['available', 'on_order', 'reservable', 'sold_out', 'unavailable'];
const n = (s: string) => s.trim().replace(',', '.');

export default function ProductEditor() {
  const id = useRouteId();
  const { store } = useStore();
  const isNew = id === 'nuevo';
  const q = useQuery({
    queryKey: ['seller-product', id],
    queryFn: () => run<Product>(db('products').select('*, product_images(id, path, sort), product_variants(id, title, sku, price_usd, stock, active, sort), moderation_events(id, to_status, note, automatic, created_at)').eq('id', id).single()),
    enabled: !isNew,
  });
  if (!isNew && q.isPending) return <Loading rows={6} />;
  if (!isNew && q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (!isNew && q.data!.store_id !== store!.id) return <Notice tone="warning">Este producto pertenece a otra de tus tiendas. Cámbiala en el selector para editarlo.</Notice>;
  return <Editor key={id} product={isNew ? null : q.data!} />;
}

function Editor({ product: p }: { product: Product | null }) {
  const { store } = useStore();
  const s = store!;
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useCategoriesIndex();
  const [f, setF] = useState({
    title: p?.title ?? '', subtitle: p?.subtitle ?? '', description: p?.description ?? '', highlights: (p?.highlights ?? []).join('\n'),
    category_id: p?.category_id ?? '', availability: (p?.availability ?? 'available') as Availability, compare_at: p?.compare_at_usd ? String(Number(p.compare_at_usd)) : '',
    weight: String(Number(p?.weight_kg ?? 0.5)), max_per_order: String(p?.max_per_order ?? 10),
  });
  const [variants, setVariants] = useState<Variant[]>(
    p ? [...p.product_variants].sort((a, b) => a.sort - b.sort).map((v) => ({ id: v.id, title: v.title, sku: v.sku ?? '', price: String(Number(v.price_usd)), stock: v.stock == null ? '' : String(v.stock), active: v.active }))
      : [{ title: 'Única', sku: '', price: '', stock: '', active: true }],
  );
  const [images, setImages] = useState<Img[]>(p ? [...p.product_images].sort((a, b) => a.sort - b.sort).map((i) => ({ id: i.id, path: i.path, preview: catalogImage(i.path)! })) : []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  useEffect(() => () => images.forEach((i) => i.file && URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const catOptions = useMemo(() => {
    const byId = new Map(cats.list.map((c) => [c.id, c]));
    return cats.list.filter((c) => c.active).map((c) => ({ id: c.id, label: c.parent_id ? `${byId.get(c.parent_id)?.name ?? ''} › ${c.name}` : c.name, sensitive: c.requires_review || c.risk_level !== 'low' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [cats.list]);
  const sensitive = catOptions.find((c) => c.id === f.category_id)?.sensitive;
  const active = variants.filter((v) => v.active);
  const minPrice = Math.min(...active.map((v) => Number(n(v.price)) || Infinity));

  const errors = {
    title: f.title.trim().length < 3 ? 'Escribe un nombre de al menos 3 caracteres.' : null,
    category: !f.category_id ? 'Elige una categoría.' : null,
    variants: !active.length ? 'Deja al menos una variante activa.'
      : variants.some((v) => !v.title.trim()) ? 'Cada variante necesita un nombre.'
      : variants.some((v) => !PRICE.test(v.price.trim()) || Number(n(v.price)) <= 0) ? 'Cada variante necesita un precio en USD mayor que 0 (hasta 2 decimales).'
      : variants.some((v) => v.stock.trim() && !/^\d{1,6}$/.test(v.stock.trim())) ? 'El inventario debe ser un número entero o quedar vacío.'
      : null,
    compare: f.compare_at.trim() && (!PRICE.test(f.compare_at.trim()) || Number(n(f.compare_at)) <= minPrice) ? 'Debe ser mayor que el precio más bajo.' : null,
    weight: !/^\d{1,3}([.,]\d{1,3})?$/.test(f.weight.trim()) ? 'Peso inválido.' : null,
    max: !/^\d{1,3}$/.test(f.max_per_order.trim()) || Number(f.max_per_order) < 1 || Number(f.max_per_order) > 100 ? 'Entre 1 y 100.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = useMutation({
    mutationFn: async () => {
      const { client } = kora();
      const fields = {
        title: f.title.trim(), subtitle: f.subtitle.trim() || null, description: f.description.trim() || null,
        highlights: f.highlights.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 6), category_id: f.category_id, availability: f.availability,
        compare_at_usd: f.compare_at.trim() ? n(f.compare_at) : null, weight_kg: n(f.weight), max_per_order: Number(f.max_per_order),
      };
      const saved = p
        ? await run<{ id: string; moderation_status: string }>(db('products').update(fields).eq('id', p.id).select('id, moderation_status').single())
        : await run<{ id: string; moderation_status: string }>(db('products').insert({ ...fields, store_id: s.id, origin: s.kind === 'seller' ? 'seller' : 'local' }).select('id, moderation_status').single());

      for (const [i, v] of variants.entries()) {
        const row = { title: v.title.trim(), sku: v.sku.trim() || null, price_usd: n(v.price), stock: v.stock.trim() ? Number(v.stock) : null, active: v.active, sort: i };
        if (v.id) await run(db('product_variants').update(row).eq('id', v.id));
        else await run(db('product_variants').insert({ ...row, product_id: saved.id }));
      }

      if (removedImages.length) await run(db('product_images').delete().in('id', removedImages));
      for (const [i, img] of images.entries()) {
        if (img.file) {
          const ext = img.file.type === 'image/png' ? 'png' : img.file.type === 'image/webp' ? 'webp' : 'jpg';
          const path = `${s.id}/${saved.id}/${Date.now()}-${i}.${ext}`;
          const { error } = await client.storage.from('catalog').upload(path, await img.file.arrayBuffer(), { contentType: img.file.type, upsert: true });
          if (error) throw new Error(`No se pudo subir la imagen ${i + 1}: ${error.message}`);
          await run(db('product_images').insert({ product_id: saved.id, path, alt: f.title.trim(), sort: i }));
        } else if (img.id) {
          await run(db('product_images').update({ sort: i }).eq('id', img.id));
        }
      }
      return run<{ id: string; moderation_status: string }>(db('products').select('id, moderation_status').eq('id', saved.id).single());
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      qc.invalidateQueries({ queryKey: ['seller-product', r.id] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      toast.ok(r.moderation_status === 'published' ? 'Guardado y publicado.' : r.moderation_status === 'suspended' ? 'Guardado. El producto sigue suspendido.' : 'Guardado. Quedó en revisión antes de publicarse.');
      // the address changes without a page load (the hosted panel has no page per product to navigate to);
      // Next follows history.replaceState, so useRouteId() gives the new id and the editor loads it
      if (!p) window.history.replaceState(null, '', `/vendedor/productos/${r.id}`);
    },
    onError: toast.error,
  });

  const setVariant = (i: number, patch: Partial<Variant>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const moveImage = (i: number, d: -1 | 1) => setImages((l) => { const x = [...l]; [x[i], x[i + d]] = [x[i + d]!, x[i]!]; return x; });
  const status = p?.moderation_status;

  return (
    <>
      <Link href="/vendedor/productos" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Productos</Link>
      <PageHeader
        eyebrow={s.name}
        title={p ? p.title : 'Nuevo producto'}
        actions={status ? <Badge tone={moderationTone[status]}>{MODERATION_LABEL[status]}</Badge> : undefined}
      />
      {status === 'rejected' || status === 'suspended' ? (
        <div className="mb-5"><Notice tone="danger" title={status === 'rejected' ? 'Producto rechazado' : 'Producto suspendido'}>{p?.moderation_note ?? 'Sin motivo indicado.'}{status === 'rejected' ? ' Corrige y guarda para enviarlo de nuevo a revisión.' : ' Escríbenos para revisarlo.'}</Notice></div>
      ) : null}
      {s.status !== 'active' ? <div className="mb-5"><Notice tone="warning">Tu tienda está en revisión: los productos se publicarán cuando la activemos.</Notice></div> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card title="Información">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre" error={tried ? errors.title : null} className="md:col-span-2"><Input value={f.title} maxLength={140} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Subtítulo" hint="Marca, modelo o detalle corto." className="md:col-span-2"><Input value={f.subtitle} maxLength={140} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></Field>
              <Field label="Descripción" hint={`${f.description.length}/8000`} className="md:col-span-2"><Textarea rows={6} maxLength={8000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
              <Field label="Puntos destacados" hint="Uno por línea, máximo 6." className="md:col-span-2"><Textarea rows={3} value={f.highlights} onChange={(e) => setF({ ...f, highlights: e.target.value })} placeholder={'Carga rápida de 65 W\nIncluye cable de 1,5 m'} /></Field>
              <Field label="Categoría" error={tried ? errors.category : null} hint={sensitive ? 'Categoría sensible: un equipo revisa el producto antes de publicarlo.' : undefined}>
                <Select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
                  <option value="">Elegir categoría</option>
                  {catOptions.map((c) => <option key={c.id} value={c.id}>{c.label}{c.sensitive ? ' · sensible' : ''}</option>)}
                </Select>
              </Field>
              <Field label="Disponibilidad" hint={f.availability === 'available' ? 'Pasa a «Agotado» sola cuando el inventario llega a 0.' : AVAILABILITY[f.availability].action === 'Encargar' ? 'Se vende por encargo; indica el tiempo en la descripción.' : undefined}>
                <Select value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value as Availability })}>
                  {SELLER_AVAILABILITY.map((a) => <option key={a} value={a}>{AVAILABILITY[a].label}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Variantes, precio e inventario" actions={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setVariants([...variants, { title: '', sku: '', price: variants[0]?.price ?? '', stock: '', active: true }])}>Agregar variante</Button>}>
            <div className="hidden grid-cols-[1fr_110px_110px_120px_76px] gap-2 pb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-3 md:grid">
              <span>Variante</span><span>Precio USD</span><span>Inventario</span><span>SKU</span><span />
            </div>
            <div className="flex flex-col gap-2">
              {variants.map((v, i) => (
                <div key={v.id ?? `new-${i}`} className={cx('grid grid-cols-2 gap-2 md:grid-cols-[1fr_110px_110px_120px_76px]', !v.active && 'opacity-50')}>
                  <Input aria-label={`Variante ${i + 1}`} className="col-span-2 md:col-span-1" value={v.title} placeholder="Negro / Talla M" onChange={(e) => setVariant(i, { title: e.target.value })} />
                  <Input aria-label={`Precio de la variante ${i + 1}`} inputMode="decimal" className="tabular" placeholder="0.00" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                  <Input aria-label={`Inventario de la variante ${i + 1}`} inputMode="numeric" className="tabular" placeholder="Sin control" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} />
                  <Input aria-label={`SKU de la variante ${i + 1}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                  {v.id ? (
                    <Button size="sm" variant="ghost" onClick={() => setVariant(i, { active: !v.active })}>{v.active ? 'Pausar' : 'Activar'}</Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Quitar variante ${i + 1}`} onClick={() => setVariants(variants.filter((_, j) => j !== i))} />
                  )}
                </div>
              ))}
            </div>
            {tried && errors.variants ? <p className="mt-2 text-[12.5px] font-medium text-danger">{errors.variants}</p> : null}
            <p className="mt-3 text-[12.5px] text-ink-3">El precio del producto es el de la variante activa más barata. Las variantes con ventas no se borran: se pausan. Inventario vacío significa que no se controla (por ejemplo, por encargo).</p>
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
              <Field label="Precio anterior (USD)" hint="Solo si de verdad lo vendiste a ese precio." error={tried ? errors.compare : null}><Input inputMode="decimal" className="tabular" value={f.compare_at} onChange={(e) => setF({ ...f, compare_at: e.target.value })} /></Field>
              <Field label="Peso (kg)" hint="Para calcular el envío." error={tried ? errors.weight : null}><Input inputMode="decimal" className="tabular" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
              <Field label="Máximo por pedido" error={tried ? errors.max : null}><Input inputMode="numeric" className="tabular" value={f.max_per_order} onChange={(e) => setF({ ...f, max_per_order: e.target.value })} /></Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title={`Fotos (${images.length})`}
            actions={
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft">
                <ImagePlus size={16} /> Agregar
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = '';
                  const ok = files.filter((x) => x.size <= 5 * 1024 * 1024);
                  if (ok.length < files.length) toast.error(new Error('Cada foto debe pesar menos de 5 MB.'));
                  setImages((l) => [...l, ...ok.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 10));
                }} />
              </label>
            }
          >
            {!images.length ? <p className="py-6 text-center text-sm text-ink-3">Usa fotos propias o con permiso del fabricante. La primera es la portada.</p> : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, i) => (
                  <div key={img.id ?? img.preview} className="group relative overflow-hidden rounded-[12px] border border-line bg-sunken">
                    <img src={img.preview} alt={`Foto ${i + 1}`} className="aspect-[4/5] w-full object-cover" />
                    {i === 0 ? <span className="absolute top-1.5 left-1.5 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-bold">Portada</span> : null}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-surface/90 px-1 py-0.5">
                      <button aria-label="Mover a la izquierda" disabled={i === 0} onClick={() => moveImage(i, -1)} className="p-1 text-ink-2 disabled:opacity-30"><ArrowLeft size={14} /></button>
                      <button aria-label={`Quitar foto ${i + 1}`} onClick={() => { if (img.id) setRemovedImages((r) => [...r, img.id!]); else URL.revokeObjectURL(img.preview); setImages((l) => l.filter((_, j) => j !== i)); }} className="p-1 text-ink-2 hover:text-danger"><Trash2 size={14} /></button>
                      <button aria-label="Mover a la derecha" disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} className="p-1 text-ink-2 disabled:opacity-30"><ArrowRight size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {p?.moderation_events.length ? (
            <Card title="Historial de revisión">
              <ol className="flex flex-col gap-2 text-[13px]">
                {[...p.moderation_events].sort((a, b) => b.id - a.id).slice(0, 6).map((e) => (
                  <li key={e.id}><span className="text-ink-3">{dateTime(e.created_at)}</span> · <b>{MODERATION_LABEL[e.to_status]}</b>{e.automatic ? ' (automático)' : ''}{e.note && !e.note.startsWith('auto:') ? <span className="block text-ink-2">{e.note}</span> : null}</li>
                ))}
              </ol>
            </Card>
          ) : null}
          <div className="sticky bottom-4">
            <Button className="w-full" loading={save.isPending} onClick={() => { setTried(true); if (valid) save.mutate(); else toast.error(new Error('Revisa los campos marcados.')); }}>
              {p ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
