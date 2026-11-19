'use client';
import type { ProductCondition, SellerProductReview } from '@kora/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, ErrorBox, Field, Loading, Notice, Select } from '@/components/ui';
import { catalogImage, koraForActor } from '@/lib/kora';
import { catalogMetadataMatchesReview } from '@/lib/catalog-metadata-review';

type ConditionDraft = { value: ProductCondition | null; version: string };
type MediaDraft = { ids: string[]; version: string };
type Action = { kind: 'condition'; value: ProductCondition | null; version: string } | { kind: 'media'; variantId: string; ids: string[]; version: string };
const conditionLabel = (value: ProductCondition | null) => value === 'new' ? 'Nuevo' : value === 'refurbished' ? 'Reacondicionado' : 'Sin clasificar';
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** Metadata RPCs never receive the general form, stock, price or a guessed role. */
export function CatalogMetadataEditor({ review, actorId, storeId, generalDirty, locked, onBusy, onAccepted, onInspect, onDraftChange }: {
  review: SellerProductReview; actorId: string; storeId: string; generalDirty: boolean; locked: boolean;
  onBusy: (value: boolean) => void; onAccepted: (next: SellerProductReview) => void;
  onInspect: () => Promise<SellerProductReview | null>;
  onDraftChange: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const active = useRef(true), submitted = useRef(false);
  const [condition, setCondition] = useState<ConditionDraft | null>(null);
  const [media, setMedia] = useState<Record<string, MediaDraft>>({});
  const [selectedVariant, setSelectedVariant] = useState('');
  const [needsInspection, setNeedsInspection] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const q = useQuery({
    queryKey: ['seller-catalog-metadata', actorId, storeId, review.product.id, review.revision],
    queryFn: async () => {
      const bound = await koraForActor(actorId);
      const rows = await bound.api.catalog.metadata([review.product.id]);
      await bound.assertCurrent();
      return rows.find((row) => row.product_id === review.product.id) ?? null;
    },
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const write = useMutation({
    mutationFn: async (action: Action) => {
      const bound = await koraForActor(actorId);
      await bound.assertCurrent();
      if (!active.current || generalDirty || locked) throw new Error('Guarda o revisa primero los otros cambios del producto.');
      if (action.kind === 'condition') await bound.api.seller.setCondition(storeId, review.product.id, action.value, action.version);
      else await bound.api.seller.setVariantMedia(storeId, review.product.id, action.variantId, action.ids, action.version);
      const next = await bound.api.seller.productReviewed(storeId, review.product.id);
      const rows = await bound.api.catalog.metadata([review.product.id]);
      await bound.assertCurrent();
      if (!active.current) throw new Error('El editor se cerró. Abre la versión actual para comprobar el cambio.');
      if (!next) throw new Error('Falta comprobar el producto actualizado. Tu selección sigue guardada en el editor.');
      const current = rows.find((row) => row.product_id === review.product.id);
      if (!current || !catalogMetadataMatchesReview(next, current)) throw new Error('El producto volvió a cambiar durante la comprobación. Conservamos tu selección.');
      if (action.kind === 'condition' && current.condition !== action.value) throw new Error('La condición cambió durante la comprobación. Conservamos tu selección para revisarla.');
      if (action.kind === 'media') {
        const variant = current.variants.find((row) => row.variant_id === action.variantId);
        if (!variant?.media_classified || !sameIds(variant.images.map((image) => image.id), action.ids)) throw new Error('Las fotos asignadas cambiaron durante la comprobación. Conservamos tu selección.');
      }
      return next;
    },
    onSuccess: (next, action) => {
      if (!active.current) return;
      onAccepted(next);
      if (action.kind === 'condition') setCondition(null);
      else setMedia((drafts) => { const nextDrafts = { ...drafts }; delete nextDrafts[action.variantId]; return nextDrafts; });
      setNeedsInspection(false);
      void qc.invalidateQueries({ queryKey: ['seller-products'] });
      void qc.invalidateQueries({ queryKey: ['product', review.product.id] });
    },
    onError: () => { if (active.current) setNeedsInspection(true); },
    onSettled: () => { submitted.current = false; if (active.current) onBusy(false); },
  });
  const inspect = useMutation({
    mutationFn: async () => {
      // The parent explicitly archives its draft before accepting the new review.
      const next = await onInspect();
      if (!next) throw new Error('El producto ya no está disponible para editar.');
      await q.refetch();
      return next;
    },
    onSuccess: () => { if (active.current) { setNeedsInspection(false); write.reset(); } },
    onSettled: () => { submitted.current = false; if (active.current) onBusy(false); },
  });
  const start = (action: Action) => {
    if (submitted.current || generalDirty || locked || needsInspection || !q.data) return;
    submitted.current = true; onBusy(true); write.mutate(action);
  };
  const inspectCurrent = () => {
    if (submitted.current || locked) return;
    submitted.current = true; onBusy(true); inspect.mutate();
  };
  useEffect(() => {
    if (!q.data) return;
    const data = q.data;
    const dirtyCondition = !!condition && condition.value !== data.condition;
    const dirtyMedia = Object.entries(media).some(([id, draft]) => {
      const row = data.variants.find((variant) => variant.variant_id === id);
      return !row || !row.media_classified || !sameIds(draft.ids, row.images.map((image) => image.id));
    });
    onDraftChange(dirtyCondition || dirtyMedia);
  }, [condition, media, q.data, onDraftChange]);
  if (q.isPending) return <Loading rows={3} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Notice tone="warning">No pudimos leer la condición y las fotos asignadas. El formulario se conserva.</Notice>;
  const metadata = q.data;
  const variant = metadata.variants.find((row) => row.variant_id === selectedVariant) ?? (!selectedVariant ? metadata.variants[0] : undefined);
  const chosen = variant ? media[variant.variant_id] : undefined;
  const imageIds = chosen?.ids ?? variant?.images.map((image) => image.id) ?? [];
  const photos = [...review.product.product_images].sort((a, b) => a.sort - b.sort);
  const imageNumber = (id: string) => { const index = photos.findIndex((photo) => photo.id === id); return index < 0 ? 'Foto ya no disponible' : `Foto ${index + 1}`; };
  const currentIds = variant?.images.map((image) => image.id) ?? [];
  const mediaVersionChanged = !!chosen && chosen.version !== variant?.updated_at;
  const conditionVersionChanged = !!condition && condition.version !== metadata.updated_at;
  const reviewChanged = !catalogMetadataMatchesReview(review, metadata);
  const busy = write.isPending || inspect.isPending;
  const disabled = locked || generalDirty || busy || needsInspection || reviewChanged;
  const chooseIds = (ids: string[]) => { if (variant) setMedia((drafts) => ({ ...drafts, [variant.variant_id]: { ids, version: chosen?.version ?? variant.updated_at } })); };
  const move = (index: number, direction: -1 | 1) => {
    const ids = [...imageIds], destination = index + direction;
    if (destination < 0 || destination >= ids.length) return;
    [ids[index], ids[destination]] = [ids[destination]!, ids[index]!]; chooseIds(ids);
  };
  return <Card title="Condición y fotos por variante" className="mt-5">
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-2">Indica el estado real del artículo y asigna las fotos que corresponden a cada variante. «Sin clasificar» no equivale a nuevo.</p>
      {generalDirty ? <Notice tone="warning">Guarda primero los otros cambios del producto. La selección de este apartado se conserva.</Notice> : null}
      {reviewChanged ? <Notice tone="warning">El producto cambió desde la revisión del formulario. Revisa la versión actual antes de guardar aquí.</Notice> : null}
      {write.isError ? <ErrorBox error={write.error} /> : null}
      {inspect.isError ? <ErrorBox error={inspect.error} /> : null}
      {needsInspection || reviewChanged ? <Button variant="secondary" disabled={locked || busy} loading={inspect.isPending} onClick={inspectCurrent}>Revisar versión actual del catálogo</Button> : null}
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3">
        <Field label="Condición del producto" hint={`Actual: ${conditionLabel(metadata.condition)}. Se guarda por separado de disponibilidad, precio e inventario.`}>
          <Select value={condition ? condition.value ?? '' : metadata.condition ?? ''} onChange={(event) => setCondition({ value: event.target.value === '' ? null : event.target.value as ProductCondition, version: condition?.version ?? metadata.updated_at })}>
            <option value="">Sin clasificar</option><option value="new">Nuevo</option><option value="refurbished">Reacondicionado</option>
          </Select>
        </Field>
        {conditionVersionChanged ? <div className="flex flex-col gap-2"><Notice tone="warning">Cambió la condición o su versión. Actual: {conditionLabel(metadata.condition)}. Tu selección: {conditionLabel(condition!.value)}.</Notice><Button variant="secondary" onClick={() => setCondition((draft) => draft && ({ ...draft, version: metadata.updated_at }))}>Revisar y conservar mi condición elegida</Button></div> : null}
        <Button disabled={!condition || condition.value === metadata.condition || conditionVersionChanged} loading={write.isPending} onClick={() => condition && start({ kind: 'condition', value: condition.value, version: condition.version })}>Guardar condición</Button>
      </fieldset>
      {Object.entries(media).filter(([id]) => !metadata.variants.some((row) => row.variant_id === id)).map(([id, draft]) => <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm"><span>La variante de esta selección ya no existe. Conservamos {draft.ids.length} fotografías seleccionadas hasta que decidas descartarla.</span><Button size="sm" variant="secondary" disabled={locked || busy} onClick={() => setMedia((drafts) => { const next = { ...drafts }; delete next[id]; return next; })}>Descartar selección de variante eliminada</Button></div>)}
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3 border-t border-line pt-5">
        <Field label="Variante para asignar fotos">
          <Select value={variant?.variant_id ?? selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)}>
            {selectedVariant && !variant ? <option value={selectedVariant}>Variante ya no disponible</option> : null}
            {metadata.variants.map((row) => <option key={row.variant_id} value={row.variant_id}>{row.title}{row.active ? '' : ' · pausada'}</option>)}
          </Select>
        </Field>
        {!variant ? <Notice tone="warning">La variante elegida ya no está disponible. Tu selección se conserva; elige otra para continuar.</Notice> : <>
          <p className="text-sm text-ink-2">Actual: {variant.media_state === 'unknown' ? 'Sin clasificar' : currentIds.length ? currentIds.map(imageNumber).join(', ') : 'Sin fotografías asignadas'}. La primera asignada será su portada.</p>
          {photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo, index) => <label key={photo.id} className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-line p-2">
            <img src={catalogImage(photo.path) ?? ''} alt={photo.alt ?? `Foto ${index + 1}`} className="aspect-square w-full rounded-lg object-contain" />
            <span className="flex flex-wrap items-center gap-2 text-sm"><input type="checkbox" aria-label={`Asignar foto ${index + 1} a ${variant.title}`} checked={imageIds.includes(photo.id)} onChange={(event) => chooseIds(event.target.checked ? [...imageIds, photo.id] : imageIds.filter((id) => id !== photo.id))} /> Foto {index + 1}{imageIds.includes(photo.id) ? ` · posición ${imageIds.indexOf(photo.id) + 1}` : ''}</span>
          </label>)}</div> : <Notice>No hay fotos guardadas. Puedes confirmar explícitamente que la variante no tiene fotografías asignadas.</Notice>}
          {imageIds.map((id, index) => <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{index + 1}. {imageNumber(id)}</span><span className="flex gap-2"><Button size="sm" variant="ghost" disabled={index === 0} aria-label={`Subir ${imageNumber(id)}`} onClick={() => move(index, -1)}>Subir</Button><Button size="sm" variant="ghost" disabled={index === imageIds.length - 1} aria-label={`Bajar ${imageNumber(id)}`} onClick={() => move(index, 1)}>Bajar</Button><Button size="sm" variant="ghost" aria-label={`Quitar ${imageNumber(id)} de la variante`} onClick={() => chooseIds(imageIds.filter((photoId) => photoId !== id))}>Quitar</Button></span></div>)}
          {mediaVersionChanged ? <div className="flex flex-col gap-2"><Notice tone="warning">La variante cambió. Revisa sus fotos actuales antes de conservar tu selección.</Notice><Button variant="secondary" onClick={() => setMedia((drafts) => ({ ...drafts, [variant.variant_id]: { ids: imageIds, version: variant.updated_at } }))}>Revisar y conservar mi selección de fotos</Button></div> : null}
          <Button disabled={mediaVersionChanged || (variant.media_classified && sameIds(imageIds, currentIds))} loading={write.isPending} onClick={() => start({ kind: 'media', variantId: variant.variant_id, ids: imageIds, version: chosen?.version ?? variant.updated_at })}>{imageIds.length ? 'Guardar fotos de esta variante' : 'Confirmar variante sin fotografías'}</Button>
        </>}
      </fieldset>
    </div>
  </Card>;
}
