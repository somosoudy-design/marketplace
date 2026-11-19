import { expect, it } from 'vitest';
import {
  optionalProductConditionSchema,
  productConditionLabel,
  productColorSummaries,
  reconcileProductSelection,
  resolveProductSelection,
  variantOptionsSchema,
  type ProductSelectionInput,
} from '../src/product-selection';
const product = (): ProductSelectionInput => ({
  availability: 'available',
  max_per_order: 10,
  variants: [
    {
      id: 'red-64',
      options: { Color: 'Rojo', Capacidad: '64 GB' },
      price_usd: 25,
      stock: 2,
      active: true,
      media_classified: true,
    },
    {
      id: 'blue-64',
      options: { Color: 'Azul', Capacidad: '64 GB' },
      price_usd: 30,
      stock: 1,
      active: true,
      media_classified: true,
    },
    {
      id: 'red-128',
      options: { Color: 'Rojo', Capacidad: '128 GB' },
      price_usd: 40,
      stock: 3,
      active: true,
      media_classified: true,
    },
  ],
  images: [
    { id: 'red-front', path: 'red.webp' },
    { id: 'blue-front', path: 'blue.webp' },
    { id: 'shared-spec', path: 'spec.webp' },
  ],
  variant_image_links: [
    { variant_id: 'red-64', image_id: 'red-front', sort: 0 },
    { variant_id: 'red-64', image_id: 'shared-spec', sort: 1 },
    { variant_id: 'blue-64', image_id: 'blue-front', sort: 0 },
    { variant_id: 'blue-64', image_id: 'shared-spec', sort: 1 },
  ],
});
it('one selection controls price, stock, cover and every gallery image', () => {
  const p = product(),
    r = resolveProductSelection(p, 'red-64');
  expect(r.price_usd).toBe(25);
  expect(r.stock).toBe(2);
  expect(r.cover?.path).toBe('red.webp');
  expect(r.gallery.map((i) => i.path)).toEqual(['red.webp', 'spec.webp']);
  expect(resolveProductSelection(p, 'blue-64').gallery.map((i) => i.path)).toEqual(['blue.webp', 'spec.webp']);
});
it('swiping never changes the commercial selection; selecting another variant resets the gallery', () => {
  const p = product();
  const a = reconcileProductSelection(p, { selectedVariantId: 'red-64', galleryIndex: 0 }, { type: 'swipe', index: 1 });
  expect(a.state).toEqual({ selectedVariantId: 'red-64', galleryIndex: 1 });
  expect(a.price_usd).toBe(25);
  const b = reconcileProductSelection(p, a.state, { type: 'select', variantId: 'blue-64' });
  expect(b.state).toEqual({ selectedVariantId: 'blue-64', galleryIndex: 0 });
  expect(b.cover?.path).toBe('blue.webp');
  expect(b.gallery.map(image => image.id)).toEqual(['blue-front', 'shared-spec']);
  expect(b.variant?.id).toBe('blue-64');
  expect(b.price_usd).toBe(30);
  expect(b.stock).toBe(1);
});
it('a refresh derives current price/stock and keeps a now-sold-out colour selected', () => {
  const p = product();
  p.variants[0]!.stock = 0;
  p.variants[0]!.price_usd = 27;
  const r = reconcileProductSelection(p, { selectedVariantId: 'red-64', galleryIndex: 1 }, { type: 'refresh' });
  expect(r.state.selectedVariantId).toBe('red-64');
  expect(r.price_usd).toBe(27);
  expect(r.canBuy).toBe(false);
  expect(r.maxQuantity).toBe(0);
});
it('removed, inactive and missing variants cannot buy or silently switch colour', () => {
  const p = product();
  expect(resolveProductSelection(p, 'gone')).toMatchObject({ selectedVariantId: 'gone', variant: null, canBuy: false });
  p.variants[0]!.active = false;
  expect(resolveProductSelection(p, 'red-64').canBuy).toBe(false);
  p.variants = [];
  expect(resolveProductSelection(p).canBuy).toBe(false);
});
it('legacy unclassified images are never treated as colour associations; explicit empty media stays empty', () => {
  const p = product();
  p.variants[0]!.media_classified = false;
  expect(resolveProductSelection(p, 'red-64')).toMatchObject({ mediaState: 'unclassified', gallery: [], cover: null });
  expect(resolveProductSelection(p, 'red-64').unclassifiedImages).toHaveLength(3);
  expect(resolveProductSelection(p, 'red-128')).toMatchObject({ mediaState: 'none', gallery: [], cover: null });
});
it('colour summaries preserve multiple SKUs, stock and comparable available prices without choosing a capacity', () => {
  expect(productColorSummaries(product().variants)).toEqual([
    {
      value: 'Rojo',
      variant_ids: ['red-64', 'red-128'],
      available_variant_ids: ['red-64', 'red-128'],
      price_from_usd: 25,
      stock: 5,
    },
    { value: 'Azul', variant_ids: ['blue-64'], available_variant_ids: ['blue-64'], price_from_usd: 30, stock: 1 },
  ]);
});
it('condition is explicit, nullable, independent and never inferred from availability', () => {
  expect(optionalProductConditionSchema.parse(undefined)).toBeUndefined();
  expect(optionalProductConditionSchema.parse(null)).toBeNull();
  expect(productConditionLabel(null)).toBeNull();
  for (const x of ['refurb', 'used', 'on_order', 'preorder', 'Reacondicionado'])
    expect(optionalProductConditionSchema.safeParse(x).success).toBe(false);
  const p = product();
  p.condition = 'refurbished';
  expect(resolveProductSelection(p, 'red-64')).toMatchObject({ canBuy: true, conditionLabel: 'Reacondicionado' });
  p.availability = 'sold_out';
  expect(resolveProductSelection(p, 'red-64').canBuy).toBe(false);
});
it('Preventa is not enabled by a new string and existing encargo/reserva retain their own availability', () => {
  const p = product();
  for (const state of ['preorder', 'pre_sale', 'preventa']) {
    p.availability = state;
    expect(resolveProductSelection(p, 'red-64').canBuy).toBe(false);
  }
  for (const state of ['on_order', 'reservable']) {
    p.availability = state;
    expect(resolveProductSelection(p, 'red-64').canBuy).toBe(true);
  }
});
it('option validation rejects untyped and empty associations rather than deriving options from prose', () => {
  expect(variantOptionsSchema.parse({ Color: ' Negro ' })).toEqual({ Color: 'Negro' });
  expect(variantOptionsSchema.safeParse({ Color: '' }).success).toBe(false);
  expect(variantOptionsSchema.safeParse({ Color: 123 }).success).toBe(false);
});

it('ambiguous Color/color values do not choose a colour silently', () => {
  const p = product();
  p.variants[0]!.options = { Color: 'Rojo', color: 'Azul' };
  expect(productColorSummaries(p.variants)[0]!.variant_ids).not.toContain('red-64');
});

it('legacy colour labels use the same exact values as SQL, including ambiguous whitespace aliases', () => {
  const p = product();
  p.variants[0]!.options = { Color: 'Rojo', color: ' Rojo ' };
  expect(productColorSummaries(p.variants).flatMap((v) => v.variant_ids)).not.toContain('red-64');
});
