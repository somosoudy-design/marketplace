import type { CatalogMetadata, ProductCondition, SellerProductReview } from '@kora/api';
import { productConditionLabel } from '@kora/core';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SellerChoice } from '@/components/seller/SellerChoice';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { Banner } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { apiForActor, catalogImage } from '@/lib/supabase';
import { preserveCatalogDraft, type CatalogDraft } from '@/lib/catalog-authoring-state';

export type CatalogAuthoringState = { dirty: boolean; busy: boolean; locked: boolean };
type Props = {
  actorId: string; storeId: string; review: SellerProductReview;
  generalDirty: boolean; generalBusy: boolean;
  onStateChange: (state: CatalogAuthoringState) => void;
  onSaved: (review: SellerProductReview) => void;
};
type Snapshot = { metadata: CatalogMetadata; review: SellerProductReview };
type Draft = CatalogDraft;
type Operation = { type: 'condition'; condition: ProductCondition | null; version: string }
  | { type: 'media'; variantId: string; imageIds: string[]; version: string };
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);
const fromSnapshot = ({ metadata }: Snapshot): Draft => ({ condition: metadata.condition,
  media: Object.fromEntries(metadata.variants.map(v => [v.variant_id, v.images.map(i => i.id)])), touched: [] });
const changedMedia = (snapshot: Snapshot, draft: Draft, variantId: string) => {
  const v = snapshot.metadata.variants.find(row => row.variant_id === variantId);
  return !v || !same(draft.media[variantId] ?? [], v.images.map(i => i.id)) || (!v.media_classified && draft.touched.includes(variantId));
};
const reflects = (current: Snapshot, op: Operation) => op.type === 'condition'
  ? current.metadata.condition === op.condition
  : current.metadata.variants.some(v => v.variant_id === op.variantId && v.media_classified && same(v.images.map(i => i.id), op.imageIds));
const definitive = new Set(['invalid_input', 'forbidden', 'auth_required', 'store_access_denied', 'not_found', 'product_busy',
  'catalog_sensitive_review_required', 'catalog_metadata_review_required', 'catalog_version_conflict']);

/** Metadata uses versioned RPCs; an uncertain write is resolved by reading, never by silently replaying a draft. */
export function CatalogAuthoring({ actorId, storeId, review, generalDirty, generalBusy, onStateChange, onSaved }: Props) {
  const productId = review.product.id; const qc = useQueryClient();
  const refreshCatalog = () => { void Promise.all(['catalog-metadata', 'product', 'home', 'search', 'seller-products'].map(key => qc.invalidateQueries({ queryKey: [key] }))); };
  const alive = useRef(true); const lock = useRef(false);
  const observedRevision = useRef(review.revision);
  const latestGate = useRef({ generalDirty, generalBusy });
  useLayoutEffect(() => { latestGate.current = { generalDirty, generalBusy }; }, [generalDirty, generalBusy]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false); const [pending, setPending] = useState<Operation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const dirty = !!snapshot && !!draft && (draft.condition !== snapshot.metadata.condition || Object.keys(draft.media).some(id => changedMedia(snapshot, draft, id)));
  const locked = pending !== null || needsReview;
  useEffect(() => { onStateChange({ dirty, busy, locked }); }, [dirty, busy, locked, onStateChange]);
  const guard = () => { if (!alive.current) throw new Error('El editor se cerró. Vuelve a abrirlo.'); };
  const read = async (operation: Awaited<ReturnType<typeof apiForActor>>): Promise<Snapshot> => {
    await operation.assertCurrent(); guard();
    const [rows, current] = await Promise.all([
      operation.api.catalog.metadata([productId]), operation.api.seller.productReviewed(storeId, productId),
    ]);
    await operation.assertCurrent(); guard();
    const metadata = rows.find(row => row.product_id === productId);
    if (!metadata || !current) throw new Error('El producto ya no está disponible para editar.');
    if (metadata.updated_at !== current.product.updated_at || metadata.variants.length !== current.product.product_variants.length || metadata.variants.some(v =>
      !current.product.product_variants.some(row => row.id === v.variant_id && row.updated_at === v.updated_at))) {
      throw new Error('El producto cambió mientras lo leíamos. Vuelve a consultar los datos actuales.');
    }
    const ids = new Set(current.product.product_images.map(image => image.id));
    if (metadata.variants.some(v => v.images.some(image => !ids.has(image.id)))) throw new Error('Las fotografías cambiaron. Vuelve a consultar los datos actuales.');
    return { metadata, review: current };
  };
  const load = async (preserve: boolean) => {
    if (lock.current || latestGate.current.generalDirty || latestGate.current.generalBusy) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const operation = await apiForActor(actorId); const next = await read(operation);
      if (latestGate.current.generalDirty || latestGate.current.generalBusy) throw new Error('Conservamos los cambios generales. Guarda o descártalos antes de cargar estos datos.');
      setSnapshot(next); setDraft(old => preserve && old && snapshot ? preserveCatalogDraft(snapshot.metadata,next.metadata,old) : fromSnapshot(next));
      setNeedsReview(false); observedRevision.current=next.review.revision;onSaved(next.review);
      setNotice(preserve ? 'Ves los datos actuales y tu selección conservada. Revísalos y guarda cada cambio que quieras aplicar.' : null);
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  // Refresh only on identity changes; draft changes must never trigger a reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; const timer = setTimeout(() => { void load(false); }, 0); return () => { clearTimeout(timer); alive.current = false; }; }, [actorId, storeId, productId]);
  useEffect(() => {
    if (observedRevision.current === review.revision) return;
    observedRevision.current = review.revision;
    if (lock.current || pending) return;
    const timer = setTimeout(() => {
      if (!alive.current) return;
      if (dirty) { setNeedsReview(true); setNotice('El producto cambió. Tu selección sigue conservada.'); }
      else void load(false);
    }, 0);
    return () => clearTimeout(timer);
  // Only an explicit parent revision change starts this review check.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.revision]);
  const write = async (op: Operation) => {
    if (!snapshot || !draft || lock.current || locked || latestGate.current.generalDirty || latestGate.current.generalBusy) return;
    if (op.type === 'media') {
      const persisted = new Set(snapshot.review.product.product_images.map(image => image.id));
      if (!snapshot.metadata.variants.some(v => v.variant_id === op.variantId) || op.imageIds.some(id => !persisted.has(id))) return setError('Tu selección incluye fotos o variantes retiradas. Revisa los datos actuales o descarta esta selección.');
    }
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    let attempted = false; let confirmed = false;
    try {
      const operation = await apiForActor(actorId); await operation.assertCurrent(); guard();
      if (latestGate.current.generalDirty || latestGate.current.generalBusy) throw new Error('Guarda o descarta los cambios del producto antes de editar estos datos.');
      attempted = true;
      if (op.type === 'condition') await operation.api.seller.setCondition(storeId, productId, op.condition, op.version);
      else await operation.api.seller.setVariantMedia(storeId, productId, op.variantId, op.imageIds, op.version);
      confirmed = true;
      const next = await read(operation);
      if (latestGate.current.generalDirty || latestGate.current.generalBusy) throw new Error('Los cambios generales siguen intactos. Comprueba el resultado cuando termines de revisarlos.');
      const matches=reflects(next,op);
      setDraft(old=>old?preserveCatalogDraft(snapshot.metadata,next.metadata,old):fromSnapshot(next));
      setSnapshot(next); setPending(null); setNeedsReview(!matches);
      observedRevision.current=next.review.revision;onSaved(next.review); refreshCatalog(); setNotice(matches?'Cambio guardado. Las demás selecciones pendientes se conservan.':'El producto volvió a cambiar después del guardado. Tu selección se conserva; revisa los datos actuales antes de aplicarla de nuevo.');
    } catch (e) {
      if (!alive.current) return;
      const code = (e as { code?: string }).code;
      if (attempted && (confirmed || !code || !definitive.has(code))) setPending(op);
      else if (code === 'catalog_version_conflict') setNeedsReview(true);
      setError((e as Error).message || 'No pudimos guardar estos datos.');
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const verify = async () => {
    if (!pending || lock.current || latestGate.current.generalDirty || latestGate.current.generalBusy) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const operation = await apiForActor(actorId); const next = await read(operation);
      if (latestGate.current.generalDirty || latestGate.current.generalBusy) throw new Error('Conservamos los cambios generales. Comprueba el resultado cuando termines de revisarlos.');
      setDraft(old=>old&&snapshot?preserveCatalogDraft(snapshot.metadata,next.metadata,old):fromSnapshot(next));
      setSnapshot(next); setPending(null); observedRevision.current=next.review.revision;onSaved(next.review);
      const matches = reflects(next, pending); setNeedsReview(!matches); refreshCatalog();
      setNotice(matches ? 'Comprobamos que el cambio está reflejado. No se volvió a enviar.' : 'El cambio no coincide con los datos actuales. Conservamos tu selección; revísala antes de guardar de nuevo.');
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const enabled = !!snapshot && !!draft && !busy && !locked && !generalDirty && !generalBusy;
  const edit = (update: (value: Draft) => Draft) => { if (enabled) setDraft(old => old ? update(old) : old); };
  const photos = snapshot?.review.product.product_images.slice().sort((a, b) => a.sort - b.sort) ?? [];
  const selectedVariant = snapshot?.metadata.variants.find(v => v.variant_id === selectedVariantId) ?? snapshot?.metadata.variants[0];
  const saveSelectedMedia = () => {
    if (!snapshot || !draft || !selectedVariant) return;
    void write({ type: 'media', variantId: selectedVariant.variant_id, imageIds: [...(draft.media[selectedVariant.variant_id] ?? [])], version: selectedVariant.updated_at });
  };
  return <Card style={{ gap: 14 }}>
    <Text variant="subtitle">Condición y fotos por opción</Text>
    <Text variant="bodySmall" color="textSecondary">Guarda primero la información y las fotos del producto. Aquí eliges qué fotos corresponden a cada opción sin cambiar su precio ni inventario.</Text>
    {generalDirty ? <Banner tone="warning" body="Guarda primero los cambios generales. Conservaremos esta selección para que la revises después." /> : null}
    {error ? <Banner tone="danger" body={error} /> : null}
    {notice ? <Banner body={notice} /> : null}
    {pending ? <><Banner tone="warning" body="No pudimos confirmar el resultado. Conservamos la selección y no la enviaremos otra vez. Comprueba el estado actual para continuar." /><Button testID="catalog-authoring-verify" title="Comprobar cambio guardado" loading={busy} disabled={generalDirty || generalBusy} onPress={() => void verify()} /></> : null}
    {needsReview && !pending ? <Button testID="catalog-authoring-review" title="Revisar datos actuales" loading={busy} disabled={generalDirty || generalBusy} onPress={() => void load(true)} /> : null}
    {!snapshot || !draft ? <Button testID="catalog-authoring-load" title="Cargar condición y fotos" loading={busy} disabled={generalDirty || generalBusy} onPress={() => void load(false)} /> : <>
      <Text variant="label">Condición actual: {productConditionLabel(snapshot.metadata.condition) ?? 'Sin especificar'}</Text>
      <View style={{ gap: 8 }}>{([null, 'new', 'refurbished'] as const).map(value => <Button key={value ?? 'unknown'} testID={`catalog-condition-${value ?? 'unknown'}`} title={productConditionLabel(value) ?? 'Sin especificar'} accessibilityLabel={`${productConditionLabel(value) ?? 'Sin especificar'}${draft.condition === value ? ', seleccionado' : ''}`} variant={draft.condition === value ? 'primary' : 'secondary'} disabled={!enabled} onPress={() => edit(old => ({ ...old, condition: value }))} />)}</View>
      <Button testID="catalog-condition-save" title="Guardar condición" disabled={!enabled || draft.condition === snapshot.metadata.condition} onPress={() => void write({ type: 'condition', condition: draft.condition, version: snapshot.metadata.updated_at })} />
      <SellerChoice testID="catalog-media-variant" label="Opción para organizar sus fotos" value={selectedVariant?.variant_id ?? ''} items={snapshot.metadata.variants.map(v => ({ value: v.variant_id, label: `${v.title}${v.active ? '' : ' · pausada'}` }))} disabled={!enabled} onChange={setSelectedVariantId} />
      {selectedVariant ? [selectedVariant].map(v => {
        const chosen = draft.media[v.variant_id] ?? [];
        const missing = chosen.filter(id => !photos.some(photo => photo.id === id));
        return <View key={v.variant_id} testID={`catalog-media-${v.variant_id}`} style={{ gap: 10 }}>
          <Text variant="label">Fotos de {v.title}{v.active ? '' : ' · pausada'}</Text>
          <Text variant="bodySmall" color="textSecondary">Actual: {!v.media_classified ? 'sin clasificar' : v.images.length ? v.images.map(image => `foto ${photos.findIndex(photo => photo.id === image.id) + 1}`).join(', ') : 'sin fotografías asignadas'}. Tu selección: {chosen.length} foto(s), en el orden elegido.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{photos.map((photo, index) => { const place = chosen.indexOf(photo.id); return <View key={photo.id} style={{ width: '47%', gap: 6 }}>
            <Image source={{ uri: catalogImage(photo.path) ?? undefined }} accessibilityLabel={`Foto ${index + 1} del producto`} style={{ width: '100%', height: 96, borderRadius: 12 }} contentFit="contain" />
            <Text variant="caption" color="textSecondary">Foto {index+1}{place>=0?` · posición ${place+1}`:''}</Text>
            <Button size="sm" style={{paddingHorizontal:8}} testID={`catalog-media-photo-${v.variant_id}-${photo.id}`} title={place >= 0 ? 'Quitar' : 'Elegir'} accessibilityLabel={`${place >= 0 ? 'Quitar' : 'Elegir'} foto ${index + 1}${place >= 0 ? `, posición ${place + 1}` : ''}`} variant={place >= 0 ? 'primary' : 'secondary'} disabled={!enabled} onPress={() => edit(old => ({ ...old, touched: [...new Set([...old.touched, v.variant_id])], media: { ...old.media, [v.variant_id]: place >= 0 ? chosen.filter(id => id !== photo.id) : [...chosen, photo.id] } }))} />
            {place > 0 ? <Button title="Mover antes" accessibilityLabel={`Mover foto ${index + 1} una posición antes`} variant="ghost" disabled={!enabled} onPress={() => edit(old => { const ids = [...chosen]; [ids[place - 1], ids[place]] = [ids[place]!, ids[place - 1]!]; return { ...old, touched: [...new Set([...old.touched, v.variant_id])], media: { ...old.media, [v.variant_id]: ids } }; })} /> : null}
          </View>; })}</View>
          {missing.length ? <Banner tone="warning" body={`${missing.length} foto(s) de tu selección fueron retiradas. La selección se conserva y no se puede guardar. Descártala o revisa qué fotos quieres usar.`} /> : null}
          <Button testID={`catalog-media-none-${v.variant_id}`} title="Esta opción no tiene fotografías" variant="secondary" disabled={!enabled} onPress={() => edit(old => ({ ...old, touched: [...new Set([...old.touched, v.variant_id])], media: { ...old.media, [v.variant_id]: [] } }))} />
          <Button testID={`catalog-media-save-${v.variant_id}`} title={chosen.length ? `Guardar fotos de ${v.title}` : `Guardar ${v.title} sin fotografías`} disabled={!enabled || !changedMedia(snapshot, draft, v.variant_id) || missing.length > 0} onPress={saveSelectedMedia} />
        </View>;
      }) : <Text color="textSecondary">No hay opciones guardadas en este producto.</Text>}
      {Object.keys(draft.media).some(id => !snapshot.metadata.variants.some(v => v.variant_id === id)) ? <Banner tone="warning" body="Hay selecciones conservadas de variantes retiradas. No se enviarán. Descarta esta selección cuando termines de consultarla." /> : null}
      {dirty && !pending ? <Button testID="catalog-authoring-discard" title="Descartar esta selección sin guardar" variant="ghost" disabled={busy || generalBusy} onPress={() => { setDraft(fromSnapshot(snapshot)); setNeedsReview(false); setError(null); setNotice(null); }} /> : null}
    </>}
  </Card>;
}
