'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, ArrowRight, Check, Store } from 'lucide-react';
import type { CatalogMetadata, ProductDetail as Product } from '@kora/api';
import { presentAvailability, resolveProductSelection } from '@kora/core';
import { ProductPhoto } from './photo';
import { Favorite } from './favorite';
import { ProductGrid } from './product-card';
import { useAccount } from '@/lib/providers';
import { money } from '@/lib/format';
import { catalogText, catalogSample, localExhibition, photo } from '@/lib/photos';
import { reviewedSelectionInput } from '@/lib/catalog-selection';
import { addReviewedCart } from '@/lib/cart-intents';
type DetailProps = { product: Product; metadata: CatalogMetadata; relatedMetadata: Record<string, CatalogMetadata>; initialVariantId?: string };
export function ProductDetail({ product, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session } = useAccount();
  return <DetailSession key={`${product.id}:${session?.user.id ?? 'guest'}:${initialVariantId ?? ''}`} product={product} metadata={metadata} relatedMetadata={relatedMetadata} initialVariantId={initialVariantId} />;
}
function DetailSession({ product: p, metadata, relatedMetadata, initialVariantId }: DetailProps) {
  const { session, ready } = useAccount();
  const router = useRouter();
  const qc = useQueryClient();
  const input = reviewedSelectionInput(p, metadata);
  const variants = metadata.variants.filter(v => v.active).map(v => ({ ...v, id: v.variant_id }));
  const [selected, setSelected] = useState(initialVariantId ?? resolveProductSelection(input).selectedVariantId ?? '');
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const resolved = resolveProductSelection(input, selected);
  const variant = resolved.variant;
  const availability = presentAvailability(p.availability);
  const max = resolved.maxQuantity;
  const general = resolved.mediaState === 'unclassified';
  const gallery = !variant ? [] : general ? (metadata.general_images ?? []) : resolved.gallery;
  const image = gallery[Math.min(imageIndex, Math.max(0, gallery.length - 1))]?.path ?? null;
  const reference = general ? photo(p.id, image, p.is_demo) : undefined;
  const selectedMetadata = metadata.variants.find(v => v.variant_id === selected);
  const selectVariant = (id: string) => {
    setSelected(id); setQuantity(1); setImageIndex(0); add.reset();
    const url = new URL(window.location.href); url.searchParams.set('variant', id);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  };
  const add = useMutation({
    mutationFn: () => {
      if(!session)throw new Error('Inicia sesión para agregar productos.');
      return addReviewedCart(session.user.id,selected,quantity,()=>qc.invalidateQueries({queryKey:['cart',session.user.id]}));
    },
  });
  const canBuy = resolved.canBuy && availability.purchasable && quantity <= max;
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
          <ProductPhoto id={p.id} path={image} demo={p.is_demo} title={p.title} priority exact />
          {general && gallery.length > 0 && <p className="muted">Fotos generales del producto; no están asignadas a esta opción.</p>}
          {!general && gallery.length === 0 && <p className="muted">Esta opción no tiene fotografías asignadas.</p>}
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
                  disabled={add.isPending}
                  onClick={() => {
                    selectVariant(v.id);
                  }}
                >
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
              disabled={!ready || !canBuy || add.isPending}
              onClick={() =>
                session ? add.mutate() : router.push(`/cuenta?volver=${encodeURIComponent(`/p/${p.slug}?variant=${encodeURIComponent(selected)}`)}`)
              }
            >
              <ShoppingBag size={18} />
              {add.isPending ? 'Agregando…' : canBuy ? 'Agregar al carrito' : 'No disponible'}
            </button>
          </div>
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
