import type { HomeFeed, ProductCard } from '../../packages/api/src/types';
import { describe, expect, it } from 'vitest';
import { selectHomeOpening } from '../../apps/mobile/src/lib/home-opening';

const product = (changes: Partial<ProductCard> = {}): ProductCard => ({
  id: 'published-product', slug: 'published-product', title: 'Producto publicado', subtitle: null,
  store_id: 'store', store_name: 'Tienda', store_slug: 'tienda', store_kind: 'seller', store_status: 'active',
  category_id: 'category', category_slug: 'tecnologia', category_name: 'Tecnología', tone: 'violet', brand_name: null,
  availability: 'on_order', origin: 'seller', price_usd: 129, compare_at_usd: null,
  image_path: 'stores/store/products/product/photo.webp', stock_total: null, lead_min_days: null, lead_max_days: null,
  popularity: 0, published_at: '2026-10-23T12:00:00Z', is_demo: false, moderation_status: 'published',
  rating_avg: null, rating_count: 0, ...changes,
});
const demo = product({ id: 'demo-product', slug: 'demo-product', is_demo: true, image_path: 'demo/photo.webp' });
const home = (changes: Partial<HomeFeed> = {}): HomeFeed => ({
  categories: [], stores: [], recommended: [demo], recently_viewed: [], personalized: false,
  collections: [{ id: 'collection', slug: 'collection', title: 'Colección', tone: 'violet', layout: 'feature', products: [demo] }],
  ...changes,
});

describe('Home uses published merchandise without inventing collections or commercial facts', () => {
  it('opens the real recent product even when it belongs to none of the editorial collections', () => {
    const feed = home(); const recent = product(); const before = JSON.stringify(feed);
    const selected = selectHomeOpening(feed, [recent]);
    expect(selected).toEqual({ kind: 'product', product: recent });
    expect(selected!.product).toBe(recent);
    expect(JSON.stringify(feed)).toBe(before);
    expect(selected!.product.price_usd).toBe(129);
    expect(selected!.product.availability).toBe('on_order');
  });

  it.each([
    { moderation_status: 'pending' }, { moderation_status: 'rejected' }, { store_status: 'suspended' },
    { is_demo: true }, { image_path: null }, { image_path: 'demo/illustration.webp' },
    { availability: 'unavailable' }, { availability: 'sold_out' }, { availability: 'available', stock_total: 0 },
    { price_usd: 0 }, { price_usd: -1 }, { price_usd: Number.NaN }, { price_usd: Number.POSITIVE_INFINITY },
  ] satisfies Partial<ProductCard>[])('does not promote ineligible merchandise: %j', (changes) => {
    const feed = home();
    expect(selectHomeOpening(feed, [product(changes)])).toEqual({ kind: 'collection', collection: feed.collections[0], product: demo });
  });

  it('keeps real catalog recommendations when the recent request fails or is empty', () => {
    const real = product(); const feed = home({ recommended: [demo, real] });
    expect(selectHomeOpening(feed)).toEqual({ kind: 'product', product: real });
  });

  it('preserves the feature collection destination when only demonstration merchandise exists', () => {
    const feed = home();
    expect(selectHomeOpening(feed)).toEqual({ kind: 'collection', collection: feed.collections[0], product: demo });
  });

  it('never promotes a private product from a malformed collection response', () => {
    const feed = home({ collections: [{ ...home().collections[0]!, products: [product({ moderation_status: 'pending' })] }] });
    expect(selectHomeOpening(feed)).toBeUndefined();
  });

  it('renders no fabricated opening when the feed has not loaded or the catalog is empty', () => {
    expect(selectHomeOpening(undefined, [product()])).toBeUndefined();
    expect(selectHomeOpening(home({ recommended: [], collections: [] }))).toBeUndefined();
  });
});
