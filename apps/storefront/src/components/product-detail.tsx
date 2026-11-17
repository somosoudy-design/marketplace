'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, ArrowRight, Check } from 'lucide-react';
import type { CatalogMetadata, ProductDetail as Product } from '@kora/api';
import {
  describeDispatchStage,
  presentAvailability,
  photoChoiceNotice,
  resolveProductSelection,
  variantSwatchLabel,
  variantAttributeLabel,
  variantDisplayTitle,
  offeredAtQuantity,
  productBasePreview,
  presentServerSchedule,
  withPlan,
} from '@kora/core';
import { ProductPhoto } from './photo';
import { ColorDot } from './color-dot';
import { Favorite } from './favorite';
import { ProductShare } from './product-share';
import { QuantityControl } from './quantity-control';
import { OfferStatus, SellerLink, DeliveryStage, PurchaseHelp, ProductContent } from './offer';
import { ProductGrid } from './product-card';
import { useAccount } from '@/lib/providers';
import { money } from '@/lib/format';
import { catalogText, catalogSample, localExhibition, photo } from '@/lib/photos';
import { isRedundantSingleOption, reviewedSelectionInput } from '@/lib/catalog-selection';
import { addReviewedCart } from '@/lib/cart-intents';
import { guestCart } from '@/lib/guest-storage';
import { useGuestCartState } from '@/lib/guest-hooks';
import { guestError } from '@/lib/guest-errors';
type DetailProps = {
  product: Product;
  metadata: CatalogMetadata;
  relatedMetadata: Record<string, CatalogMetadata>;
  initialVariantId?: string;
};
export function ProductDetail({ product, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session } = useAccount();
  return (
    <DetailSession
      key={`${product.id}:${session?.user.id ?? 'guest'}:${initialVariantId ?? ''}`}
      product={product}
      metadata={metadata}
      relatedMetadata={relatedMetadata}
      initialVariantId={initialVariantId}
    />
  );
}
function DetailSession({ product: p, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session, ready, retryCartSync } = useAccount();
  const guest = useGuestCartState();
  const qc = useQueryClient();
  const router = useRouter();
  const input = reviewedSelectionInput(p, metadata);
  const variants = metadata.variants.filter((v) => v.active).map((v) => ({ ...v, id: v.variant_id }));
  // The router can restore a cached page while the history entry holds a newer variant.
  const params = useSearchParams();
  const values = params?.getAll('variant');
  const requested = values ? (values.length === 1 ? values[0] : undefined) : initialVariantId;
  const selected = requested ?? resolveProductSelection(input).selectedVariantId ?? '';
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const adding = useRef(false);
  const purchaseAction = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const action = purchaseAction.current;
    const shell = action?.closest<HTMLElement>('.app-shell');
    if (!action || !shell) return;
    const measure = () =>
      shell.style.setProperty('--purchase-action-height', `${action.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(action);
    measure();
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--purchase-action-height');
    };
  }, []);
  const resolved = resolveProductSelection(input, selected);
  const variant = resolved.variant;
  const availability = presentAvailability(p.availability);
  const max = resolved.maxQuantity;
  const general = resolved.mediaState === 'unclassified';
  const gallery = !variant ? [] : general ? (metadata.general_images ?? []) : resolved.gallery;
  const image = gallery[Math.min(imageIndex, Math.max(0, gallery.length - 1))]?.path ?? null;
  const choicePhotoNotice = photoChoiceNotice({
    selectedVariantId: variant?.id,
    variants,
    mediaState: resolved.mediaState,
    imagePath: image,
  });
  const reference = general ? photo(p.id, image, p.is_demo) : undefined;
  const selectedMetadata = metadata.variants.find((v) => v.variant_id === selected);
  const selectVariant = (id: string) => {
    setQuantity(1);
    setImageIndex(0);
    add.reset();
    const url = new URL(window.location.href);
    url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  };
  const add = useMutation({
    networkMode: session ? 'online' : 'always',
    mutationFn: async (selection: { variantId: string; quantity: number }) => {
      const choice = resolveProductSelection(input, selection.variantId);
      const details = metadata.variants.find((v) => v.variant_id === selection.variantId);
      if (
        !choice.canBuy ||
        !choice.variant ||
        !details ||
        selection.quantity < 1 ||
        selection.quantity > choice.maxQuantity
      )
        throw new Error('Revisa la opción y la cantidad antes de agregar.');
      if (session)
        return addReviewedCart(session.user.id, selection.variantId, selection.quantity, () =>
          qc.invalidateQueries({ queryKey: ['cart', session.user.id] }),
        );
      try {
        await guestCart.add({
          product_id: p.id,
          variant_id: selection.variantId,
          quantity: selection.quantity,
          title: p.title,
          variant_title: details.title,
          image_path:
            choice.cover?.path ??
            (metadata.variants.length === 1 ? (metadata.general_images?.[0]?.path ?? null) : null),
          price_usd: choice.price_usd!,
          availability: p.availability,
          product_condition: choice.condition,
        });
      } catch (error) {
        throw guestError(error);
      }
      // A sign-in may finish while this local write is waiting for another tab's storage lock.
      retryCartSync();
    },
  });
  const canBuy = resolved.canBuy && availability.purchasable && quantity <= max;
  // Both range and price belong to the same commercial product response. Missing offers never authorize a plan.
  const installmentOffer = p.installment_options?.find(
    (offer) => offer.variant_id === selected && offer.basis === 'products_only_excludes_shipping',
  );
  const installmentPlan =
    installmentOffer && quantity <= installmentOffer.max_quantity
      ? offeredAtQuantity(installmentOffer.plans, quantity).find((option) => option.code === 'three_parts')
      : undefined;
  const basePreview =
    canBuy && installmentOffer && installmentPlan
      ? productBasePreview(installmentOffer.unit_price_usd, quantity, installmentPlan)
      : null;
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
    add.mutate(
      { variantId: selected, quantity },
      {
        onSuccess: () => {
          if (destination) router.push(destination);
        },
        onSettled: () => {
          adding.current = false;
        },
      },
    );
  };
  const stage = canBuy ? describeDispatchStage(p.availability, p.lead_min_days, p.lead_max_days) : null;
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
          <div className="product-auxiliary" role="group" aria-label="Acciones del producto">
            {p.slug && (
              <ProductShare
                key={selected}
                variantId={variant?.active ? variant.id : undefined}
                slug={p.slug}
                title={p.title}
              />
            )}
            <Favorite id={p.id} title={p.title} />
          </div>
          <ProductPhoto
            key={`${selected}:${image ?? 'none'}`}
            id={p.id}
            path={image}
            demo={p.is_demo}
            title={p.title}
            priority
            exact
          />
          {choicePhotoNotice && (
            <p className="muted" data-testid="product-photo-notice">
              {choicePhotoNotice}
            </p>
          )}
          {gallery.length === 0 && <p className="muted">Aún no hay fotos de esta opción.</p>}
          {gallery.length > 1 && (
            <div className="thumbnails" role="group" aria-label="Elegir fotografía">
              {gallery.map((i, index) => (
                <button
                  key={i.path}
                  type="button"
                  aria-label={`Ver imagen ${index + 1} de ${gallery.length}`}
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
          <header className="product-summary">
            <span className="eyebrow">{p.brand_name || p.category_name}</span>
            <h1>{catalogText(p.title, p.is_demo, p.id)}</h1>
            <SellerLink name={p.store.name} slug={p.store.slug} />
            {p.subtitle && <p className="product-subtitle">{p.subtitle}</p>}
          </header>

          <div className="detail-purchase">
            <div className="detail-price">
              {resolved.price_usd == null || !Number.isFinite(resolved.price_usd)
                ? 'Precio no disponible'
                : money(resolved.price_usd)}
            </div>
            {resolved.conditionLabel && (
              <p className="detail-condition" data-testid="product-condition">
                Condición: {resolved.conditionLabel}
              </p>
            )}
            {!variant && (
              <p className="notice" role="alert">
                Esta opción ya no está disponible. Elige otra opción.
              </p>
            )}
            <div className="stock-status" role="status">
              <OfferStatus
                availability={p.availability}
                stock={variant?.stock}
                issue={variant?.active ? undefined : 'unavailable'}
              />
              {stage && (
                <DeliveryStage availability={p.availability} minimum={p.lead_min_days} maximum={p.lead_max_days} />
              )}
            </div>
            {stage && (
              <p className="dispatch-explanation">
                {p.availability === 'reservable'
                  ? 'Plazo del próximo lote.'
                  : p.availability === 'in_transit'
                    ? 'Plazo de disponibilidad.'
                    : 'Preparación previa al transporte.'}{' '}
                El envío y la estimación de llegada se confirman al elegir tu dirección.
              </p>
            )}
            {catalogSample(p.id, p.is_demo) && !localExhibition && (
              <p className="notice">Producto de muestra. No es una oferta comercial pública.</p>
            )}
            {!isRedundantSingleOption(variants, variant?.id) && (
              <div className="variant-picker">
                <h2>{variantAttributeLabel(p.option_names, variants)}</h2>
                <div role="group" aria-label={variantAttributeLabel(p.option_names, variants)}>
                  {variants.map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      aria-pressed={v.id === selected}
                      aria-label={
                        variantSwatchLabel(v)
                          ? `Color ${variantDisplayTitle(v.title, v.options) ?? 'Opción'}${v.stock != null && v.stock <= 0 ? ' · Agotado' : ''}`
                          : undefined
                      }
                      data-color-choice={variantSwatchLabel(v) ? '' : undefined}
                      disabled={add.isPending}
                      onClick={() => {
                        selectVariant(v.id);
                      }}
                    >
                      {variantSwatchLabel(v) ? <ColorDot label={variantSwatchLabel(v)!} /> : null}
                      {variantDisplayTitle(v.title, v.options) ?? 'Opción'}
                      {v.stock != null && v.stock <= 0 && <span className="variant-stock-label">Agotado</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {quantity > max && resolved.canBuy && (
              <p className="notice" role="alert">
                El inventario cambió. Confirma de nuevo la cantidad.
              </p>
            )}
            {selectedMetadata?.sku && (
              <p className="detail-reference muted">
                Referencia <span>{selectedMetadata.sku}</span>
              </p>
            )}
            {resolved.canBuy && (
              <p className="quantity-limit">
                Hasta {max} {max === 1 ? 'unidad' : 'unidades'} en esta selección.
              </p>
            )}
            {installmentPreview && displayedPayments && (
              <section
                className="payment-schedule"
                aria-label="Opción de pago del producto"
                data-testid="product-installments"
              >
                <h2>{displayedPayments.title}</h2>
                {displayedPayments.distribution && <p>{displayedPayments.distribution}</p>}
                {displayedPayments.rows.map(({ item, label, due }) => (
                  <div key={item.seq}>
                    <span>
                      {label} · {due}
                    </span>
                    <strong>{money(Number(item.amount_usd))}</strong>
                  </div>
                ))}
                <p>{installmentPreview.label}</p>
                <button
                  type="button"
                  className="button secondary"
                  data-testid="product-buy-three-parts"
                  disabled={!ready || (!session && !guest.ready) || !canBuy || add.isPending}
                  onClick={() => addSelection('three_parts')}
                >
                  {add.isPending ? 'Agregando…' : 'Comprar en 3 pagos'} <ArrowRight size={16} />
                </button>
              </section>
            )}
            <div className="purchase-action" ref={purchaseAction}>
              <div className="purchase-context" role="group" aria-label="Oferta seleccionada">
                <strong>{resolved.price_usd == null ? 'Precio no disponible' : money(resolved.price_usd)}</strong>
                <OfferStatus
                  availability={p.availability}
                  stock={variant?.stock}
                  issue={variant?.active ? undefined : 'unavailable'}
                />
              </div>
              <div className="purchase-controls">
                <div className="purchase-quantity">
                  <span>Cantidad</span>
                  <QuantityControl
                    quantity={quantity}
                    maximum={max}
                    label={p.title}
                    editable={resolved.canBuy}
                    pending={add.isPending}
                    onChange={(value) => {
                      setQuantity(value);
                      add.reset();
                    }}
                  />
                </div>
                <button
                  className="button"
                  aria-busy={add.isPending}
                  disabled={!ready || (!session && !guest.ready) || !canBuy || add.isPending}
                  onClick={() => addSelection()}
                >
                  <ShoppingBag size={18} />
                  {add.isPending ? 'Agregando…' : canBuy ? 'Agregar al carrito' : 'No disponible'}
                </button>
              </div>
              <div className="purchase-feedback">
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
              </div>
            </div>
          </div>
          {p.store.shipping_info && (
            <details className="shipping-details">
              <summary>Información de entrega</summary>
              <p>{p.store.shipping_info}</p>
            </details>
          )}
          <PurchaseHelp />
        </section>
      </div>
      <ProductContent
        description={catalogText(p.description ?? '', p.is_demo, p.id)}
        highlights={p.highlights?.map((h) => catalogText(h, p.is_demo) ?? h)}
        seller={p.store.name}
      />
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
