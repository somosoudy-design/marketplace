import { describe, expect, test } from 'vitest';
import type { ProductDetail } from '../../../packages/api/src/types';
import type { GuestLine } from '../src/guest-cart';
import { guestCartOffer } from '../../../apps/mobile/src/lib/guest-cart-view';

const saved: GuestLine = {
  product_id: 'product',
  variant_id: 'purple',
  title: 'Producto guardado',
  quantity: 2,
  price_usd: 10,
  image_path: 'old.jpg',
  availability: 'on_order',
  variant_title: 'Púrpura',
  product_condition: 'new',
};
const product = (patch: Partial<ProductDetail> = {}): ProductDetail =>
  ({
    id: 'product',
    title: 'Trípode Ulanzi',
    slug: 'ulanzi',
    availability: 'on_order',
    max_per_order: 5,
    condition: 'new',
    lead_min_days: 5,
    lead_max_days: 10,
    variants: [
      {
        id: 'purple',
        title: 'Púrpura',
        price_usd: 38.6,
        stock: 3,
        active: true,
        options: { color: 'Púrpura' },
        media_classified: true,
      },
      {
        id: 'black',
        title: 'Negro',
        price_usd: 40,
        stock: 2,
        active: true,
        options: { color: 'Negro' },
        media_classified: true,
      },
    ],
    images: [
      { id: 'purple-image', path: 'purple.jpg' },
      { id: 'black-image', path: 'black.jpg' },
    ],
    variant_image_links: [
      { variant_id: 'purple', image_id: 'purple-image', sort: 0 },
      { variant_id: 'black', image_id: 'black-image', sort: 0 },
    ],
    general_images: [],
    store: { id: 'store', name: 'Mayami', slug: 'kora' },
    ...patch,
  }) as ProductDetail;
const catalog = (value: ProductDetail | null) => new Map([['product', value]]);

describe('guest offers follow current catalogue data without mutating saved selections', () => {
  test('two current Ulanzi units total 77.20, retaining order modality and dispatch timing', () => {
    const before = structuredClone(saved);
    const view = guestCartOffer([saved], catalog(product()), true);
    const line = view.lines[0]!;
    expect(view.itemsUsd).toBe(77.2);
    expect(line.unit_price_usd).toBe(38.6);
    expect(line.availability).toBe('on_order');
    expect(line.dispatchStage).toBe('Listo para despacho en 5–10 días (estimado)');
    expect(line.variant_id).toBe('purple');
    expect(line.max_quantity).toBe(3);
    expect(line.image_path).toBe('purple.jpg');
    expect(view.groups[0]!.storeName).toBe('Mayami');
    expect(saved).toEqual(before);
  });
  test('explicit black variant controls price, photo and quantity together', () => {
    const view = guestCartOffer([{ ...saved, variant_id: 'black' }], catalog(product()), true);
    expect(view.itemsUsd).toBe(80);
    expect(view.lines[0]).toMatchObject({
      variant_id: 'black',
      image_path: 'black.jpg',
      variant_title: 'Negro',
      max_quantity: 2,
    });
  });
  test('an absent selected variant remains absent instead of silently choosing another', () => {
    const view = guestCartOffer([{ ...saved, variant_id: 'gone' }], catalog(product()), true);
    expect(view.issues).toBe(1);
    expect(view.itemsUsd).toBeNull();
    expect(view.lines[0]).toMatchObject({
      variant_id: 'gone',
      issue: 'unavailable',
      priceKnown: false,
      max_quantity: 0,
      image_path: null,
    });
  });
  test('lower stock leaves quantity visible and reports insufficient stock', () => {
    const p = product();
    p.variants[0]!.stock = 1;
    const view = guestCartOffer([saved], catalog(p), true);
    expect(view.lines[0]).toMatchObject({ quantity: 2, max_quantity: 1, issue: 'insufficient_stock' });
    expect(view.issues).toBe(1);
  });
  test('per-order limit stays distinct from stock and sold-out state', () => {
    const view = guestCartOffer([saved], catalog(product({ max_per_order: 1 })), true);
    expect(view.lines[0]).toMatchObject({ quantity: 2, max_quantity: 1, issue: 'over_limit' });
    const p = product();
    p.variants[0]!.stock = 0;
    expect(guestCartOffer([saved], catalog(p), true).lines[0]).toMatchObject({
      max_quantity: 0,
      issue: 'sold_out',
      availability: 'on_order',
    });
  });
  test('read failure or offline state preserves choices and withholds stale amounts', () => {
    const view = guestCartOffer([saved], catalog(product()), false);
    expect(view.itemsUsd).toBeNull();
    expect(view.lines[0]).toMatchObject({
      product_id: 'product',
      variant_id: 'purple',
      quantity: 2,
      image_path: 'old.jpg',
      availability: 'on_order',
      priceKnown: false,
      max_quantity: 0,
      issue: null,
      dispatchStage: null,
    });
  });
  test('deleted products and invalid prices block continuation', () => {
    expect(guestCartOffer([saved], catalog(null), true).lines[0]).toMatchObject({
      issue: 'unavailable',
      priceKnown: false,
    });
    const p = product();
    p.variants[0]!.price_usd = NaN;
    expect(guestCartOffer([saved], catalog(p), true).itemsUsd).toBeNull();
  });
  test('groups and subtotals follow fresh seller and sum every selected quantity', () => {
    const p = product(),
      other = product({ id: 'other', store: { ...p.store, id: 'second', name: 'Otra tienda' } });
    const view = guestCartOffer(
      [saved, { ...saved, product_id: 'other', quantity: 1 }],
      new Map([
        ['product', p],
        ['other', other],
      ]),
      true,
    );
    expect(view.groups).toHaveLength(2);
    expect(view.units).toBe(3);
    expect(view.itemsUsd).toBe(115.8);
  });
  test('an unknown current condition replaces a stale condition', () => {
    const view = guestCartOffer([saved], catalog(product({ condition: null })), true);
    expect(view.lines[0]!.product_condition).toBeNull();
  });
  test('unclassified media uses server-confirmed general photos only', () => {
    const p = product();
    p.variants[0]!.media_classified = false;
    p.general_images = [{ id: 'general', path: 'general.jpg' }] as ProductDetail['general_images'];
    expect(guestCartOffer([saved], catalog(p), true).lines[0]!.image_path).toBe('general.jpg');
    p.general_images = [];
    expect(guestCartOffer([saved], catalog(p), true).lines[0]!.image_path).toBeNull();
  });
});
