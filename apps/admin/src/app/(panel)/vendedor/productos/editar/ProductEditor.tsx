'use client';
import type { SellerProductChanges, SellerProductReview } from '@kora/api';
import { AVAILABILITY, MODERATION_LABEL, type Availability } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCosts, productCostsDraft, productCostsErrors, productCostsPatch, type ProductCostsDraft } from '@/components/ProductCosts';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Textarea, cx } from '@/components/ui';
import { dateTime, moderationTone } from '@/lib/format';
import { useCategoriesIndex, useQueryId } from '@/lib/hooks';
import { catalogImage, koraForActor, run } from '@/lib/kora';
import { useStore } from '@/lib/store';
import { CatalogMetadataEditor } from '@/components/CatalogMetadataEditor';

type Variant = { id?: string; title: string; sku: string; price: string; stock: string; active: boolean };
type Img = { id?: string; path?: string; file?: File; preview: string };
type Product = SellerProductReview['product'];

const PRICE = /^\d{1,7}([.,]\d{1,2})?$/;
const SELLER_AVAILABILITY: Availability[] = ['available', 'on_order', 'reservable', 'sold_out', 'unavailable'];
const n = (s: string) => s.trim().replace(',', '.');
const readable = (value: unknown, empty = 'Vacío') => typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value ?? '') || empty;
const costSourceLabel = (value: unknown) => ({ amazon: 'Amazon', proveedor: 'Proveedor', propio: 'Producción propia', otro: 'Otro' })[String(value) as 'amazon' | 'proveedor' | 'propio' | 'otro'] ?? 'Origen no disponible';

const fieldsFrom = (p: Product | null) => ({
  title: p?.title ?? '', subtitle: p?.subtitle ?? '', description: p?.description ?? '', highlights: (p?.highlights ?? []).join('\n'),
  category_id: p?.category_id ?? '', availability: (p?.availability ?? 'available') as Availability,
  compare_at: p?.compare_at_usd != null ? String(Number(p.compare_at_usd)) : '', weight: String(Number(p?.weight_kg ?? 0.5)), max_per_order: String(p?.max_per_order ?? 10),
});
const variantsFrom = (p: Product | null): Variant[] => p ? [...p.product_variants].sort((a,b) => a.sort-b.sort).map(v => ({ id: v.id, title: v.title, sku: v.sku ?? '', price: String(Number(v.price_usd)), stock: v.stock == null ? '' : String(v.stock), active: v.active })) : [{ title: 'Única', sku: '', price: '', stock: '', active: true }];
const imagesFrom = (p: Product | null): Img[] => p ? [...p.product_images].sort((a,b) => a.sort-b.sort).map(i => ({ id: i.id, path: i.path, preview: catalogImage(i.path)! })) : [];
type Fields = ReturnType<typeof fieldsFrom>;
type Backup = { id: string; base: SellerProductReview; fields: Fields; variants: Variant[]; images: Img[]; removedImages: string[]; costs: ProductCostsDraft };
type Pending = { revision: string; key: string; changes: SellerProductChanges };

export default function ProductEditor() {
  const id = useQueryId();
  const { store } = useStore();
  const { userId } = useAuth();
  const isNew = !id;
  const q = useQuery({
    queryKey: ['seller-product-reviewed', userId, store?.id, id],
    queryFn: async () => { const bound=await koraForActor(userId!); const row=await bound.api.seller.productReviewed(store!.id,id!); await bound.assertCurrent(); return row; },
    enabled: !isNew && !!store && !!userId,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  if (!isNew && q.isPending) return <Loading rows={6} />;
  if (!isNew && q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (!isNew && !q.data) return <Notice tone="warning">No encontramos este producto en la tienda seleccionada.</Notice>;
  return <Editor key={`${userId}:${store!.id}:${id || 'nuevo'}`} initialReview={isNew ? null : q.data!} />;
}

function Editor({ initialReview }: { initialReview: SellerProductReview | null }) {
  const { store } = useStore();
  const { userId } = useAuth();
  const s = store!;
  const [review, setReview] = useState(initialReview);
  const p = review?.product ?? null;
  const qc = useQueryClient();
  const toast = useToast();
  // Keep completed writes when a later step fails, so retry updates the same product and rows.
  const savedProductId = useRef<string | null>(p?.id ?? null);
  const activeEditor = useRef(true);
  const uploadedImages = useRef(new Map<string, string>());
  const previewUrls = useRef(new Set<string>());
  const cats = useCategoriesIndex();
  const [f, setF] = useState(() => fieldsFrom(p));
  const [variants, setVariants] = useState<Variant[]>(() => variantsFrom(p));
  const [images, setImages] = useState<Img[]>(() => imagesFrom(p));
  const [costsDraft, setCostsDraft] = useState<ProductCostsDraft | null>(() => review ? productCostsDraft(review.pricing) : null);
  const [costsReviewed, setCostsReviewed] = useState(false);
  const pending = useRef<Pending | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const acceptReview = (next: SellerProductReview) => {
    qc.setQueryData(['seller-product-reviewed', userId, s.id, next.product.id], next);
    setReview(next); setF(fieldsFrom(next.product)); setVariants(variantsFrom(next.product)); setImages(imagesFrom(next.product));
    setRemovedImages([]); setCostsDraft(productCostsDraft(next.pricing)); setCostsReviewed(false); pending.current = null; setRequestPending(false);
  };
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [metadataDirty, setMetadataDirty] = useState(false);
  useEffect(() => {
    activeEditor.current = true;
    const urls = previewUrls.current;
    return () => { activeEditor.current = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  const catOptions = useMemo(() => {
    const byId = new Map(cats.list.map((c) => [c.id, c]));
    return cats.list.filter((c) => c.active).map((c) => ({ id: c.id, label: c.parent_id ? `${byId.get(c.parent_id)?.name ?? ''} › ${c.name}` : c.name, sensitive: c.requires_review || c.risk_level !== 'low' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [cats.list]);
  const sensitive = catOptions.find((c) => c.id === f.category_id)?.sensitive;
  const draftWeight = /^\d{1,3}([.,]\d{1,3})?$/.test(f.weight.trim()) && Number.isFinite(Number(n(f.weight))) ? Number(n(f.weight)) : null;
  const fieldLabel = (key: keyof Fields, value: Fields[keyof Fields]) => key === 'category_id' ? cats.list.find(c => c.id === value)?.name ?? 'Categoría no disponible' : key === 'availability' ? AVAILABILITY[value as Availability]?.label ?? 'Disponibilidad no disponible' : readable(value);
  const costLabel = (key: string, value: unknown) => key === 'source' ? costSourceLabel(value) : readable(value);
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
    weight: !/^\d{1,3}([.,]\d{1,3})?$/.test(f.weight.trim()) ? 'Peso inválido.' : review?.pricing.costs?.auto_price && f.weight !== fieldsFrom(p).weight && !costsReviewed ? 'Confirma la revisión de costos antes de cambiar el peso.' : null,
    max: !/^\d{1,3}$/.test(f.max_per_order.trim()) || Number(f.max_per_order) < 1 || Number(f.max_per_order) > 100 ? 'Entre 1 y 100.' : null,
  };
  const valid = Object.values(errors).every((e) => !e) && (!costsDraft || Object.values(productCostsErrors(costsDraft)).every(e => !e));

  const inspectCurrent = useMutation({
    mutationFn: async () => {
      const operation = await koraForActor(userId!);
      const next = await operation.api.seller.productReviewed(s.id, p!.id);
      await operation.assertCurrent();
      return next;
    },
    onSuccess: (next) => {
      if (!activeEditor.current) return;
      if (!next || !review || !costsDraft) { toast.error(new Error('El producto ya no está disponible para editar. Conservamos tu borrador.')); return; }
      setBackups(rows => [...rows, { id: crypto.randomUUID(), base: review, fields: f, variants, images, removedImages, costs: costsDraft }]);
      acceptReview(next); save.reset();
    },
    onError: toast.error,
  });

  const save = useMutation({
    mutationFn: async () => {
      const operation = await koraForActor(userId!);
      const { client, api } = operation;
      const assertCurrent = async () => {
        await operation.assertCurrent();
        if (!activeEditor.current) throw new Error('El editor se cerró. Vuelve a abrirlo antes de guardar.');
      };
      // The legacy creation path is also bound to the captured actor, never the global client.
      const db = (table: string) => (client.from as unknown as (table: string) => any)(table); // eslint-disable-line @typescript-eslint/no-explicit-any
      await assertCurrent();
      if (review) {
        if (!pending.current) {
          const original = fieldsFrom(review.product);
          const current = { title: f.title.trim(), subtitle: f.subtitle.trim() || null, description: f.description.trim() || null,
            highlights: f.highlights.split('\n').map(h => h.trim()).filter(Boolean).slice(0,6), category_id: f.category_id, availability: f.availability,
            compare_at_usd: f.compare_at.trim() ? Number(n(f.compare_at)) : null, weight_kg: Number(n(f.weight)), max_per_order: Number(f.max_per_order) };
          const names: Record<keyof Fields, keyof typeof current> = { title:'title',subtitle:'subtitle',description:'description',highlights:'highlights',category_id:'category_id',availability:'availability',compare_at:'compare_at_usd',weight:'weight_kg',max_per_order:'max_per_order' };
          const fields: NonNullable<SellerProductChanges['fields']> = {};
          for (const key of Object.keys(names) as (keyof Fields)[]) if (f[key] !== original[key]) Object.assign(fields, { [names[key]]: current[names[key]] });
          const before = variantsFrom(review.product);
          const changedVariants: NonNullable<SellerProductChanges['variants']> = [];
          for (const [sort,v] of variants.entries()) {
            const old = before.find(x => x.id === v.id); const row: NonNullable<SellerProductChanges['variants']>[number] = { id: v.id ?? crypto.randomUUID() };
            if (!old || old.title !== v.title) row.title = v.title.trim();
            if (!old || old.sku !== v.sku) row.sku = v.sku.trim() || null;
            if (!old || old.price !== v.price) row.price_usd = Number(n(v.price));
            if (!old || old.stock !== v.stock) row.stock = v.stock.trim() ? Number(v.stock) : null;
            if (!old || old.active !== v.active) row.active = v.active;
            const oldSort = review.product.product_variants.find(x => x.id === v.id)?.sort;
            if (oldSort !== sort) row.sort = sort;
            if (Object.keys(row).length > 1) changedVariants.push(row);
          }
          const changedImages: NonNullable<SellerProductChanges['images']> = removedImages.map(id => ({ id, remove: true }));
          for (const [sort,img] of images.entries()) {
            if (img.file) {
              let path = uploadedImages.current.get(img.preview);
              if (!path) {
                const ext = img.file.type === 'image/png' ? 'png' : img.file.type === 'image/webp' ? 'webp' : 'jpg';
                path = `${s.id}/${review.product.id}/${crypto.randomUUID()}.${ext}`;
                await api.seller.uploadImage('catalog', path, await img.file.arrayBuffer(), img.file.type);
                await assertCurrent();
                uploadedImages.current.set(img.preview, path);
              }
              changedImages.push({ id: img.id ?? crypto.randomUUID(), path, sort, alt: f.title.trim() });
            } else if (img.id && review.product.product_images.find(x => x.id === img.id)?.sort !== sort) changedImages.push({ id: img.id, sort });
          }
          const costs = costsDraft ? productCostsPatch(review.pricing, costsDraft) : {};
          const changes: SellerProductChanges = { fields, variants: changedVariants, images: changedImages, ...costs };
          if (costsReviewed && !changes.costs) changes.costs = {};
          pending.current = { revision: review.revision, key: crypto.randomUUID(), changes };
          setRequestPending(true);
        }
        const intent = pending.current;
        await assertCurrent();
        await api.seller.saveProductReviewed(s.id, review.product.id, intent.revision, intent.key, intent.changes);
        // A replay is a historical result. Re-read the current product before accepting another edit.
        const fresh = await api.seller.productReviewed(s.id, review.product.id);
        await assertCurrent();
        if (!fresh) throw new Error('Se guardó el cambio, pero falta volver a leer el producto. Reintenta para recuperar el resultado.');
        return { id: fresh.product.id, moderation_status: fresh.product.moderation_status, reviewed: fresh };
      }
      const fields = {
        title: f.title.trim(), subtitle: f.subtitle.trim() || null, description: f.description.trim() || null,
        highlights: f.highlights.split('\n').map((h) => h.trim()).filter(Boolean).slice(0, 6), category_id: f.category_id, availability: f.availability,
        compare_at_usd: f.compare_at.trim() ? n(f.compare_at) : null, weight_kg: n(f.weight), max_per_order: Number(f.max_per_order),
      };
      const saved = savedProductId.current
        ? await run<{ id: string; moderation_status: string }>(db('products').update(fields).eq('id', savedProductId.current).eq('store_id', s.id).select('id, moderation_status').single())
        : await run<{ id: string; moderation_status: string }>(db('products').insert({ ...fields, store_id: s.id, origin: s.kind === 'seller' ? 'seller' : 'local' }).select('id, moderation_status').single());
      savedProductId.current = saved.id;

      for (const [i, v] of variants.entries()) {
        const row = { title: v.title.trim(), sku: v.sku.trim() || null, price_usd: n(v.price), stock: v.stock.trim() ? Number(v.stock) : null, active: v.active, sort: i };
        if (v.id) await run(db('product_variants').update(row).eq('id', v.id).eq('product_id', saved.id).select('id').single());
        else {
          const created = await run<{ id: string }>(db('product_variants').insert({ ...row, product_id: saved.id }).select('id').single());
          setVariants((rows) => rows.map((variant, j) => j === i ? { ...variant, id: created.id } : variant));
        }
      }

      if (removedImages.length) {
        await run(db('product_images').delete().eq('product_id', saved.id).in('id', removedImages));
        setRemovedImages([]);
      }
      for (const [i, img] of images.entries()) {
        if (img.file) {
          let path = uploadedImages.current.get(img.preview);
          if (!path) {
            const ext = img.file.type === 'image/png' ? 'png' : img.file.type === 'image/webp' ? 'webp' : 'jpg';
            path = `${s.id}/${saved.id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await client.storage.from('catalog').upload(path, await img.file.arrayBuffer(), { contentType: img.file.type, upsert: false });
            if (error) throw new Error(`No se pudo subir la imagen ${i + 1}: ${error.message}`);
            uploadedImages.current.set(img.preview, path);
          }
          const created = await run<{ id: string }>(db('product_images').insert({ product_id: saved.id, path, alt: f.title.trim(), sort: i }).select('id').single());
          setImages((rows) => rows.map((image) => image.preview === img.preview ? { ...image, id: created.id, path, file: undefined } : image));
        } else if (img.id) {
          await run(db('product_images').update({ sort: i }).eq('id', img.id).eq('product_id', saved.id).select('id').single());
        }
      }
      const created = await run<{ id: string; moderation_status: string }>(db('products').select('id, moderation_status').eq('id', saved.id).single());
      await assertCurrent();
      return { ...created, reviewed: null };
    },
    onSuccess: (r) => {
      if (!activeEditor.current) return;
      if (r.reviewed) acceptReview(r.reviewed);
      qc.invalidateQueries({ queryKey: ['seller-products'] });
      qc.invalidateQueries({ queryKey: ['seller-product', r.id] });
      qc.invalidateQueries({ queryKey: ['stock'] });
      if (!activeEditor.current) return;
      toast.ok((r.moderation_status === 'published' ? 'Guardado y publicado.' : r.moderation_status === 'suspended' ? 'Guardado. El producto sigue suspendido.' : 'Guardado. Quedó en revisión antes de publicarse.') + (metadataDirty ? ' La condición y las fotos de variantes siguen pendientes de guardar en su apartado.' : ''));
      // a new product gets its address without a page load: Next follows history.replaceState, so useQueryId()
      // gives the new id and the editor opens the saved product
      if (!p) window.history.replaceState(null, '', `/vendedor/productos/editar?id=${r.id}`);
    },
    onError: (error) => { if (activeEditor.current) toast.error(error); },
  });

  const generalDirty = !!review && (
    JSON.stringify(f) !== JSON.stringify(fieldsFrom(review.product)) ||
    JSON.stringify(variants) !== JSON.stringify(variantsFrom(review.product)) ||
    removedImages.length > 0 || images.some((image) => !!image.file) ||
    JSON.stringify(images.map(({ id, path }) => ({ id, path }))) !== JSON.stringify(imagesFrom(review.product).map(({ id, path }) => ({ id, path }))) ||
    (costsDraft !== null && JSON.stringify(costsDraft) !== JSON.stringify(productCostsDraft(review.pricing)))
  );

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

      {save.isError && review ? <Card title="No se completó la confirmación">
        <p className="text-sm text-ink-2">Tu borrador se conserva. Reintenta para recuperar la misma operación o revisa los datos actuales antes de editar.</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => save.mutate()} disabled={inspectCurrent.isPending} loading={save.isPending}>Reintentar guardado</Button><Button variant="secondary" onClick={() => inspectCurrent.mutate()} disabled={save.isPending} loading={inspectCurrent.isPending}>Revisar versión actual</Button></div>
      </Card> : null}
      {backups.length ? <fieldset disabled={save.isPending || requestPending || inspectCurrent.isPending || metadataBusy} className="min-w-0">{backups.map(backup => <Card key={backup.id} title="Tu borrador anterior" className="mb-5">
        <p className="mb-3 text-sm text-ink-2">Se muestran tus cambios anteriores. El formulario contiene la versión actual; recupera sólo los valores que quieras conservar y vuelve a revisar antes de guardar.</p>
        <div className="flex flex-col gap-2">
          {(Object.keys(backup.fields) as (keyof Fields)[]).filter(key => backup.fields[key] !== fieldsFrom(backup.base.product)[key]).map(key => <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span><b>{({ title:'Nombre',subtitle:'Subtítulo',description:'Descripción',highlights:'Puntos destacados',category_id:'Categoría',availability:'Disponibilidad',compare_at:'Precio anterior',weight:'Peso',max_per_order:'Máximo por pedido' })[key]}</b><span className="block break-words">Actual: {fieldLabel(key, f[key])} · Borrador: {fieldLabel(key, backup.fields[key])}</span></span><Button size="sm" variant="secondary" onClick={() => { setF(x => ({ ...x, [key]: backup.fields[key] })); if (key === 'weight') setCostsReviewed(false); }}>Usar valor del borrador</Button></div>)}
          {backup.variants.map((variant,i) => {
            const old = variantsFrom(backup.base.product).find(x => x.id === variant.id); const current = variants.find(x => x.id === variant.id);
            if (!old) return <Button key={`new-${i}`} variant="secondary" disabled={!!variant.id && variants.some(row => row.id === variant.id)} onClick={() => setVariants(rows => [...rows, { ...variant }])}>Recuperar variante nueva: {variant.title}</Button>;
            return (['title','sku','price','stock','active'] as const).filter(key => variant[key] !== old[key]).map(key => <div key={`${variant.id}:${key}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span><b>{variant.title}: {({title:'Nombre',sku:'SKU',price:'Precio',stock:'Inventario',active:'Activa'})[key]}</b><span className="block">Actual: {current ? readable(current[key], key === 'stock' ? 'Sin control' : 'Vacío') : 'Variante eliminada'} · Borrador: {readable(variant[key], key === 'stock' ? 'Sin control' : 'Vacío')}</span></span><Button size="sm" variant="secondary" disabled={!current} onClick={() => setVariants(rows => rows.map(row => row.id === variant.id ? { ...row, [key]: variant[key] } : row))}>Usar valor del borrador</Button></div>);
          })}
          {JSON.stringify(backup.images.filter(img => !!img.id).map(img => img.id)) !== JSON.stringify(imagesFrom(backup.base.product).map(img => img.id)) ? <Button variant="secondary" onClick={() => setImages(rows => { const ordered = backup.images.flatMap(img => { const found = rows.find(row => !!row.id && row.id === img.id); return found ? [found] : []; }); const used = new Set(ordered.map(img => img.id)); return [...ordered,...rows.filter(img => !used.has(img.id))]; })}>Usar orden de fotos del borrador</Button> : null}
          {backup.images.filter(img => !!img.file).map(img => <Button key={img.preview} variant="secondary" disabled={images.some(x => x.preview === img.preview)} onClick={() => setImages(rows => [...rows,img])}>Recuperar foto adjunta del borrador</Button>)}
          {backup.removedImages.map(id => <Button key={id} variant="secondary" disabled={!images.some(img => img.id === id)} onClick={() => { setImages(rows => rows.filter(img => img.id !== id)); setRemovedImages(rows => rows.includes(id) ? rows : [...rows,id]); }}>Volver a quitar la foto elegida en el borrador</Button>)}
          {costsDraft ? (['source','url','freight','logistics','margin','auto'] as const).filter(key => backup.costs[key] !== productCostsDraft(backup.base.pricing)[key]).map(key => <div key={`cost:${key}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span><b>Costos: {({source:'Origen',url:'Enlace',freight:'Flete',logistics:'Gastos',margin:'Recargo',auto:'Precio automático'})[key]}</b><span className="block">Actual: {costLabel(key, costsDraft[key])} · Borrador: {costLabel(key, backup.costs[key])}</span></span><Button size="sm" variant="secondary" onClick={() => { setCostsDraft(x => x && ({ ...x, [key]: backup.costs[key] })); setCostsReviewed(false); }}>Usar valor del borrador</Button></div>) : null}
          {costsDraft ? Object.keys(backup.costs.costs).filter(id => backup.costs.costs[id] !== productCostsDraft(backup.base.pricing).costs[id]).map(id => <div key={`cost-variant:${id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span><b>Costo de variante</b><span className="block">Actual: {costsDraft.costs[id] || 'Sin costo'} · Borrador: {backup.costs.costs[id] || 'Sin costo'}</span></span><Button size="sm" variant="secondary" disabled={!(id in costsDraft.costs)} onClick={() => { setCostsDraft(x => x && ({ ...x,costs:{...x.costs,[id]:backup.costs.costs[id]!} })); setCostsReviewed(false); }}>Usar valor del borrador</Button></div>) : null}
        </div>
      </Card>)}</fieldset> : null}
      <fieldset disabled={save.isPending || requestPending || inspectCurrent.isPending || metadataBusy} aria-busy={save.isPending || metadataBusy} className="min-w-0 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-5">
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

          <Card className="@container" title="Variantes, precio e inventario" actions={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setVariants([...variants, { id: review ? crypto.randomUUID() : undefined, title: '', sku: '', price: variants[0]?.price ?? '', stock: '', active: true }])}>Agregar variante</Button>}>
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_150px_76px] gap-2 pb-1.5 text-[12px] font-bold uppercase tracking-wide text-ink-3 @min-[680px]:grid">
              <span>Variante</span><span>Precio USD</span><span>Inventario</span><span>SKU</span><span />
            </div>
            <div className="flex flex-col gap-2">
              {variants.map((v, i) => (
                <div key={v.id ?? `new-${i}`} className={cx('grid grid-cols-2 gap-2 @min-[680px]:grid-cols-[minmax(0,1fr)_110px_110px_150px_76px]', !v.active && 'opacity-50')}>
                  <label className="col-span-2 flex min-w-0 flex-col gap-1.5 @min-[680px]:col-span-1">
                    <span className="text-[13px] font-semibold text-ink-2 @min-[680px]:hidden">Variante</span>
                    <Input aria-label={`Variante ${i + 1}`} value={v.title} placeholder="Negro / Talla M" onChange={(e) => setVariant(i, { title: e.target.value })} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-ink-2 @min-[680px]:hidden">Precio (USD)</span>
                    <Input disabled={!!costsDraft?.auto && !!review?.pricing.costs?.auto_price && !!v.id} aria-label={`Precio de la variante ${i + 1}`} inputMode="decimal" className="tabular" placeholder="0.00" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-ink-2 @min-[680px]:hidden">Inventario</span>
                    <Input aria-label={`Inventario de la variante ${i + 1}`} inputMode="numeric" className="tabular" placeholder="Sin control" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} />
                  </label>
                  <label className="col-span-2 flex min-w-0 flex-col gap-1.5 @min-[680px]:col-span-1">
                    <span className="text-[13px] font-semibold text-ink-2 @min-[680px]:hidden">SKU</span>
                    <Input aria-label={`SKU de la variante ${i + 1}`} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                  </label>
                  {v.id && (!review || review.product.product_variants.some(row => row.id === v.id)) ? (
                    <Button size="sm" variant="ghost" className="col-span-2 justify-self-end @min-[680px]:col-span-1 @min-[680px]:self-center @min-[680px]:justify-self-stretch" onClick={() => setVariant(i, { active: !v.active })}>{v.active ? 'Pausar' : 'Activar'}</Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={Trash2} className="col-span-2 justify-self-end @min-[680px]:col-span-1 @min-[680px]:self-center @min-[680px]:justify-self-stretch" aria-label={`Quitar variante ${i + 1}`} onClick={() => setVariants(variants.filter((_, j) => j !== i))} />
                  )}
                </div>
              ))}
            </div>
            {tried && errors.variants ? <p className="mt-2 text-[12.5px] font-medium text-danger">{errors.variants}</p> : null}
            <p className="mt-3 text-[12.5px] text-ink-3">El precio del producto es el de la variante activa más barata. Las variantes con ventas no se borran: se pausan. Inventario vacío significa que no se controla (por ejemplo, por encargo).</p>
            <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
              <Field label="Precio anterior (USD)" hint="Solo si de verdad lo vendiste a ese precio." error={tried ? errors.compare : null}><Input inputMode="decimal" className="tabular" value={f.compare_at} onChange={(e) => setF({ ...f, compare_at: e.target.value })} /></Field>
              <Field label="Peso (kg)" hint="Para calcular el envío." error={tried ? errors.weight : null}><Input inputMode="decimal" className="tabular" value={f.weight} onChange={(e) => { setF({ ...f, weight: e.target.value }); setCostsReviewed(false); }} /></Field>
              <Field label="Máximo por pedido" error={tried ? errors.max : null}><Input inputMode="numeric" className="tabular" value={f.max_per_order} onChange={(e) => setF({ ...f, max_per_order: e.target.value })} /></Field>
            </div>
          </Card>
          {review && costsDraft ? <ProductCosts data={review.pricing} weightKg={draftWeight} draft={costsDraft} onChange={(next) => { setCostsDraft(next); setCostsReviewed(false); }} reviewed={costsReviewed} onReviewed={() => setCostsReviewed(true)} /> : <Card title="Costos y precio"><p className="text-[13px] text-ink-3">Crea el producto y luego registra aquí su costo: el precio puede seguir al costo y a la brecha del día.</p></Card>}
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title={`Fotos (${images.length})`}
            actions={
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft focus-within:ring-2 focus-within:ring-brand">
                <ImagePlus size={16} /> Agregar
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = '';
                  const ok = files.filter((x) => x.size <= 5 * 1024 * 1024);
                  if (ok.length < files.length) toast.error(new Error('Cada foto debe pesar menos de 5 MB.'));
                  const added = ok.slice(0, Math.max(0, 10 - images.length)).map((file) => { const preview = URL.createObjectURL(file); previewUrls.current.add(preview); return { id: review ? crypto.randomUUID() : undefined, file, preview }; });
                  setImages((l) => [...l, ...added]);
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
                    <div className="grid grid-cols-2 bg-surface/90 px-1 min-[368px]:grid-cols-3">
                      <button aria-label="Mover a la izquierda" style={{ outlineOffset: -2 }} disabled={i === 0} onClick={() => moveImage(i, -1)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-2 disabled:opacity-30"><ArrowLeft size={16} /></button>
                      <button aria-label="Mover a la derecha" style={{ outlineOffset: -2 }} disabled={i === images.length - 1} onClick={() => moveImage(i, 1)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-2 disabled:opacity-30"><ArrowRight size={16} /></button>
                      <button aria-label={`Quitar foto ${i + 1}`} style={{ outlineOffset: -2 }} onClick={() => { if (img.id && (!review || review.product.product_images.some(row => row.id === img.id))) setRemovedImages((r) => [...r, img.id!]); else if (!review) { URL.revokeObjectURL(img.preview); previewUrls.current.delete(img.preview); } setImages((l) => l.filter((_, j) => j !== i)); }} className="col-span-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-2 hover:text-danger min-[368px]:col-span-1"><Trash2 size={16} /></button>
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
            <Button className="w-full" disabled={metadataBusy || (!!review && metadataDirty && !generalDirty)} loading={save.isPending} onClick={() => { setTried(true); if (valid) save.mutate(); else toast.error(new Error('Revisa los campos marcados.')); }}>
              {p ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </div>
      </fieldset>
      {review ? <CatalogMetadataEditor review={review} actorId={userId!} storeId={s.id} generalDirty={generalDirty}
        locked={save.isPending || requestPending || inspectCurrent.isPending} onBusy={setMetadataBusy}
        onAccepted={acceptReview} onInspect={() => inspectCurrent.mutateAsync()} onDraftChange={setMetadataDirty} /> : null}
    </>
  );
}
