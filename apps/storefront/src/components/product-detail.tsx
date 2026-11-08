'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, ArrowRight, Check, Store } from 'lucide-react';
import type { CatalogMetadata, ProductDetail as Product } from '@kora/api';
import { presentAvailability, photoChoiceNotice, resolveProductSelection, variantSwatchLabel, offeredAtQuantity, productBasePreview, presentServerSchedule, withPlan } from '@kora/core';
import { ProductPhoto } from './photo';
import { ColorDot } from './color-dot';
import { Favorite } from './favorite';
import { ProductGrid } from './product-card';
import { useAccount } from '@/lib/providers';
import { money } from '@/lib/format';
import { catalogText, catalogSample, localExhibition, photo } from '@/lib/photos';
import { reviewedSelectionInput } from '@/lib/catalog-selection';
import { addReviewedCart } from '@/lib/cart-intents';
import { guestCart } from '@/lib/guest-storage';
import { useGuestCartState } from '@/lib/guest-hooks';
import { guestError } from '@/lib/guest-errors';
type DetailProps = { product: Product; metadata: CatalogMetadata; relatedMetadata: Record<string, CatalogMetadata>; initialVariantId?: string };
export function ProductDetail({ product, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session } = useAccount();
  return <DetailSession key={`${product.id}:${session?.user.id ?? 'guest'}:${initialVariantId ?? ''}`} product={product} metadata={metadata} relatedMetadata={relatedMetadata} initialVariantId={initialVariantId} />;
}
function DetailSession({ product: p, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session, ready, retryCartSync } = useAccount();
  const guest = useGuestCartState();
  const qc = useQueryClient();
  const router = useRouter();
  const input = reviewedSelectionInput(p, metadata);
  const variants = metadata.variants.filter(v => v.active).map(v => ({ ...v, id: v.variant_id }));
  const [selected, setSelected] = useState(initialVariantId ?? resolveProductSelection(input).selectedVariantId ?? '');
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const adding = useRef(false);
  const resolved = resolveProductSelection(input, selected);
  const variant = resolved.variant;
  const availability = presentAvailability(p.availability);
  const max = resolved.maxQuantity;
  const general = resolved.mediaState === 'unclassified';
  const gallery = !variant ? [] : general ? (metadata.general_images ?? []) : resolved.gallery;
  const image = gallery[Math.min(imageIndex, Math.max(0, gallery.length - 1))]?.path ?? null;
  const choicePhotoNotice = photoChoiceNotice({ selectedVariantId: variant?.id, variants, mediaState: resolved.mediaState, imagePath: image });
  const reference = general ? photo(p.id, image, p.is_demo) : undefined;
  const selectedMetadata = metadata.variants.find(v => v.variant_id === selected);
  const selectVariant = (id: string) => {
    setSelected(id); setQuantity(1); setImageIndex(0); add.reset();
    const url = new URL(window.location.href); url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  };
  const add = useMutation({
    networkMode: session ? 'online' : 'always',
    mutationFn: async (selection: { variantId: string; quantity: number }) => {
      const choice = resolveProductSelection(input, selection.variantId);
      const details = metadata.variants.find(v => v.variant_id === selection.variantId);
      if (!choice.canBuy || !choice.variant || !details || selection.quantity < 1 || selection.quantity > choice.maxQuantity) throw new Error('Revisa la opción y la cantidad antes de agregar.');
      if (session) return addReviewedCart(session.user.id, selection.variantId, selection.quantity, () => qc.invalidateQueries({ queryKey: ['cart', session.user.id] }));
      try { await guestCart.add({ product_id: p.id, variant_id: selection.variantId, quantity: selection.quantity, title: p.title, variant_title: details.title,
        image_path: choice.cover?.path ?? (metadata.variants.length === 1 ? metadata.general_images?.[0]?.path ?? null : null), price_usd: choice.price_usd!, availability: p.availability, product_condition: choice.condition }); }
      catch (error) { throw guestError(error); }
      // A sign-in may finish while this local write is waiting for another tab's storage lock.
      retryCartSync();
    },
  });
  const canBuy = resolved.canBuy && availability.purchasable && quantity <= max;
  // Both range and price belong to the same commercial product response. Missing offers never authorize a plan.
  const installmentOffer = p.installment_options?.find(offer => offer.variant_id === selected && offer.basis === 'products_only_excludes_shipping');
  const installmentPlan = installmentOffer && quantity <= installmentOffer.max_quantity
    ? offeredAtQuantity(installmentOffer.plans, quantity).find(option => option.code === 'three_parts') : undefined;
  const basePreview = canBuy && installmentOffer && installmentPlan
    ? productBasePreview(installmentOffer.unit_price_usd, quantity, installmentPlan) : null;
  const installmentPreview = basePreview?.schedule.length === 3 ? basePreview : null;
  const displayedPayments = installmentPreview ? presentServerSchedule(installmentPreview.schedule) : null;
  const addSelection = (preferredPlan?: 'three_parts') => {
    if (adding.current || add.isPending) return;
    const destination = preferredPlan ? withPlan('/carrito', preferredPlan) : undefined;
    // The normal add action may already have succeeded for precisely this selection.
    if (destination && add.isSuccess && add.variables.variantId === selected && add.variables.quantity === quantity) {
      router.push(destination);
      return;
    }
    adding.current = true;
    add.mutate({ variantId: selected, quantity }, {
      onSuccess: () => { if (destination) router.push(destination); },
      onSettled: () => { adding.current = false; },
    });
  };
  return (
    <div className="wrap product-page">
      <div className="breadcrumbs">
        <Link prefetch={false} href="/buscar">
          Catálogo
        </Link>
        <span>/</span>
        <Link prefetch={false} href={`/buscar?category=${p.category_slug}`}>
          {p.category_name}
        </Link>
        <span>/</span>
        <span>{p.brand_name || p.title}</span>
      </div>
      <div className="product-detail">
        <section className="product-gallery" aria-label="Fotografías">
          <ProductPhoto key={`${selected}:${image ?? 'none'}`} id={p.id} path={image} demo={p.is_demo} title={p.title} priority exact />
          {choicePhotoNotice && <p className="muted" data-testid="product-photo-notice">{choicePhotoNotice}</p>}
          {gallery.length === 0 && <p className="muted">Aún no hay fotos de esta opción.</p>}
          {gallery.length > 1 && (
            <div className="thumbnails">
              {gallery.map((i, index) => (
                <button
                  key={i.path}
                  type="button"
                  aria-label={`Ver imagen ${index + 1}`}
                  aria-pressed={imageIndex === index}
                  onClick={() => setImageIndex(index)}
                >
                  <ProductPhoto id={p.id} path={i.path} demo={p.is_demo} title={i.alt || p.title} exact />
                </button>
              ))}
            </div>
          )}
          {reference && (
            <details className="image-credits">
              <summary>Acerca de esta imagen</summary>
              <p>{reference.disclosure}</p>
              {reference.author && (
                <p>
                  {reference.author}{' '}
                  {reference.license && (
                    <>
                      ·{' '}
                      <a href={reference.licenseUrl} target="_blank" rel="noreferrer">
                        {reference.license}
                      </a>
                    </>
                  )}
                </p>
              )}
              {reference.additionalSources?.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              ))}
              {reference.originUrl && (
                <a href={reference.originUrl} target="_blank" rel="noreferrer">
                  Fuente original
                </a>
              )}
            </details>
          )}
        </section>
        <section className="product-information">
          <span className="eyebrow">{p.brand_name || p.category_name}</span>
          <div className="detail-title">
            <h1>{catalogText(p.title, p.is_demo, p.id)}</h1>
            <Favorite id={p.id} title={p.title} />
          </div>
          <Link prefetch={false} className="seller-link" href={`/buscar?store=${p.store.slug}`}>
            <Store size={16} />
            Vendido por {p.store.name}
            <ArrowRight size={15} />
          </Link>
          <div className="detail-price">{resolved.price_usd == null || !Number.isFinite(resolved.price_usd) ? 'Precio no disponible' : money(resolved.price_usd)}</div>
          {resolved.conditionLabel && <p className="stock-status" data-testid="product-condition">Condición: {resolved.conditionLabel}</p>}
          {selectedMetadata?.sku && <p className="muted">SKU: {selectedMetadata.sku}</p>}
          {!variant && <p className="notice" role="alert">Esta opción ya no está disponible. Elige otra opción.</p>}
          <p className={`stock-status ${canBuy ? 'in-stock' : ''}`}>
            {variant?.stock != null && variant.stock <= 0 ? 'Esta opción está agotada' : availability.label}
            {p.lead_min_days != null &&
              p.lead_max_days != null &&
              ` · Estimado: ${p.lead_min_days}–${p.lead_max_days} días`}
          </p>
          {catalogSample(p.id, p.is_demo) && !localExhibition && (
            <p className="notice">Producto de muestra. No es una oferta comercial pública.</p>
          )}
          <div className="variant-picker">
            <h2>Elige una opción</h2>
            <div role="group" aria-label="Variantes">
              {variants.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  aria-pressed={v.id === selected}
                  aria-label={variantSwatchLabel(v) ? `Color ${v.title}` : undefined}
                  data-color-choice={variantSwatchLabel(v) ? '' : undefined}
                  disabled={add.isPending}
                  onClick={() => {
                    selectVariant(v.id);
                  }}
                >
                  {variantSwatchLabel(v) ? <ColorDot label={variantSwatchLabel(v)!} /> : null}
                  {v.title}
                </button>
              ))}
            </div>
          </div>
          {quantity > max && resolved.canBuy && <p className="notice" role="alert">El inventario cambió. Confirma de nuevo la cantidad.</p>}
          <div className="add-row">
            <label>
              Cantidad
              <select
                aria-label="Cantidad"
                value={quantity}
                disabled={!resolved.canBuy || add.isPending}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  add.reset();
                }}
              >
                {quantity > max && <option value={quantity} disabled>{quantity} · Confirma otra cantidad</option>}
                {Array.from({ length: Math.min(max, 99) }, (_, i) => i + 1).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="button"
              disabled={!ready || (!session && !guest.ready) || !canBuy || add.isPending}
              onClick={() => addSelection()}
            >
              <ShoppingBag size={18} />
              {add.isPending ? 'Agregando…' : canBuy ? 'Agregar al carrito' : 'No disponible'}
            </button>
          </div>
          {installmentPreview && displayedPayments && (
            <section className="payment-schedule" aria-label="Opción de pago del producto" data-testid="product-installments">
              <h2>{displayedPayments.title}</h2>
              {displayedPayments.distribution && <p>{displayedPayments.distribution}</p>}
              {displayedPayments.rows.map(({ item, label, due }) => (
                <div key={item.seq}><span>{label} · {due}</span><strong>{money(Number(item.amount_usd))}</strong></div>
              ))}
              <p>{installmentPreview.label}</p>
              <button type="button" className="button secondary" data-testid="product-buy-three-parts"
                disabled={!ready || (!session && !guest.ready) || !canBuy || add.isPending}
                onClick={() => addSelection('three_parts')}>
                {add.isPending ? 'Agregando…' : 'Comprar en 3 pagos'} <ArrowRight size={16} />
              </button>
            </section>
          )}
          {add.isError && (
            <p role="alert" className="error">
              {add.error.message} Puedes volver a intentarlo.
            </p>
          )}
          {add.isSuccess && (
            <p className="added" role="status">
              <Check size={18} />
              Agregado al carrito{' '}
              <Link prefetch={false} href="/carrito">
                Ver carrito <ArrowRight size={16} />
              </Link>
            </p>
          )}
          {p.store.shipping_info && (
            <details className="shipping-details">
              <summary>Información de entrega</summary>
              <p>{p.store.shipping_info}</p>
            </details>
          )}
          <div className="detail-policies">
            <Link prefetch={false} href="/devoluciones">
              Ver devoluciones y garantías <ArrowRight size={15} />
            </Link>
            <Link prefetch={false} href="/contacto">
              ¿Necesitas ayuda? <ArrowRight size={15} />
            </Link>
          </div>
          {p.highlights?.length || p.description?.trim() ? <div className="detail-description">
            <h2>Sobre este producto</h2>
            {p.highlights?.length ? (
              <ul>
                {p.highlights.map((h) => (
                  <li key={h}>{catalogText(h, p.is_demo)}</li>
                ))}
              </ul>
            ) : null}
            {p.description && <p>{catalogText(p.description, p.is_demo, p.id)}</p>}
          </div> : null}
        </section>
      </div>
      {p.related.length > 0 && (
        <section className="catalog-section">
          <div className="section-heading">
            <h2>También te puede interesar</h2>
          </div>
          <ProductGrid products={p.related.slice(0, 6)} metadata={relatedMetadata} />
        </section>
      )}
    </div>
  );
}
