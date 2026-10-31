'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, ArrowRight, Check, Store } from 'lucide-react';
import type { ProductDetail as Product } from '@kora/api';
import { presentAvailability } from '@kora/core';
import { ProductPhoto } from './photo';
import { Favorite } from './favorite';
import { ProductGrid } from './product-card';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
import { money } from '@/lib/format';
import { catalogText, localExhibition, photo } from '@/lib/photos';
export function ProductDetail({ product: p }: { product: Product }) {
  const { session, ready } = useAccount();
  const router = useRouter();
  const qc = useQueryClient();
  const variants = p.variants.filter((v) => v.active);
  const [selected, setSelected] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [image, setImage] = useState(p.image_path);
  const variant = variants.find((v) => v.id === selected);
  const availability = presentAvailability(p.availability);
  const max = Math.max(0, Math.min(p.max_per_order, variant?.stock ?? p.max_per_order));
  const reference = photo(p.id, image, p.is_demo, selected);
  const add = useMutation({
    mutationFn: () => browser().api.cart.add(selected, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', session?.user.id] }),
  });
  const canBuy = !!variant && availability.purchasable && max > 0;
  return (
    <div className="wrap product-page">
      <div className="breadcrumbs">
        <Link href="/buscar">Catálogo</Link>
        <span>/</span>
        <Link href={`/buscar?category=${p.category_slug}`}>{p.category_name}</Link>
        <span>/</span>
        <span>{p.brand_name || p.title}</span>
      </div>
      <div className="product-detail">
        <section className="product-gallery" aria-label="Fotografías">
          <ProductPhoto id={p.id} path={image} demo={p.is_demo} title={p.title} variant={selected} priority />
          {p.images.length > 1 && (
            <div className="thumbnails">
              {p.images
                .filter((i) => !localExhibition || !reference || photo(p.id, i.path, p.is_demo, selected))
                .map((i, index) => (
                  <button
                    key={i.path}
                    type="button"
                    aria-label={`Ver imagen ${index + 1}`}
                    aria-pressed={image === i.path}
                    onClick={() => setImage(i.path)}
                  >
                    <ProductPhoto
                      id={p.id}
                      path={i.path}
                      demo={p.is_demo}
                      title={i.alt || p.title}
                      variant={selected}
                    />
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
            <h1>{catalogText(p.title, p.is_demo)}</h1>
            <Favorite id={p.id} title={p.title} />
          </div>
          <Link className="seller-link" href={`/buscar?store=${p.store.slug}`}>
            <Store size={16} />
            Vendido por {p.store.name}
            <ArrowRight size={15} />
          </Link>
          <div className="detail-price">{money(variant?.price_usd ?? p.price_usd)}</div>
          <p className={`stock-status ${canBuy ? 'in-stock' : ''}`}>
            {availability.label}
            {p.lead_min_days != null &&
              p.lead_max_days != null &&
              ` · Estimado: ${p.lead_min_days}–${p.lead_max_days} días`}
          </p>
          {p.is_demo && !localExhibition && (
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
                  onClick={() => {
                    setSelected(v.id);
                    setQuantity(1);
                    add.reset();
                  }}
                >
                  {v.title}
                </button>
              ))}
            </div>
          </div>
          <div className="add-row">
            <label>
              Cantidad
              <select
                aria-label="Cantidad"
                value={quantity}
                disabled={!canBuy || add.isPending}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  add.reset();
                }}
              >
                {Array.from({ length: Math.min(max, 99) }, (_, i) => i + 1).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="button"
              disabled={!ready || !canBuy || add.isPending}
              onClick={() =>
                session ? add.mutate() : router.push(`/cuenta?volver=${encodeURIComponent(`/p/${p.slug}`)}`)
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
              <Link href="/carrito">
                Ver carrito <ArrowRight size={16} />
              </Link>
            </p>
          )}
          <div className="detail-description">
            <h2>Sobre este producto</h2>
            {p.highlights?.length ? (
              <ul>
                {p.highlights.map((h) => (
                  <li key={h}>{catalogText(h, p.is_demo)}</li>
                ))}
              </ul>
            ) : null}
            {p.description && <p>{catalogText(p.description, p.is_demo)}</p>}
          </div>
          {p.store.shipping_info && (
            <details className="shipping-details">
              <summary>Información de entrega</summary>
              <p>{p.store.shipping_info}</p>
            </details>
          )}
        </section>
      </div>
      {p.related.length > 0 && (
        <section className="catalog-section">
          <div className="section-heading">
            <h2>También te puede interesar</h2>
          </div>
          <ProductGrid products={p.related.slice(0, 6)} />
        </section>
      )}
    </div>
  );
}
