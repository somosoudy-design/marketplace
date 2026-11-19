import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, pool } from '../../src/db';

afterAll(() => pool.end());

let store: Awaited<ReturnType<typeof createStoreWithProduct>>;
let high: string;
let low: string;
let preview: string;
let tied: string;
let hidden: string;

beforeAll(async () => {
  store = await createStoreWithProduct({ price: 49, stock: 0, availability: 'sold_out' });
  const add = async (price: number, availability = 'available', status = 'published') => {
    const [p] = await admin(`insert into public.products (store_id, category_id, title, availability, moderation_status)
      values ($1,$2,$3,$4,$5) returning id`, [store.storeId, store.categoryId, `Prueba de orden ${price}`, availability, status]);
    await admin(`insert into public.product_variants (product_id,title,price_usd,stock,sort)
      values ($1,'Única',$2,5,0)`, [p.id, price]);
    return p.id as string;
  };
  high = await add(70);
  low = await add(20);
  tied = await add(49);
  preview = await add(10);
  hidden = await add(999, 'available', 'pending');
  await admin(`update public.product_variants set stock=0 where product_id=$1`, [preview]);
  // The preview is the first eligible option, not the minimum price in the product.
  await admin(`insert into public.product_variants (product_id,title,price_usd,stock,sort)
    values ($1,'Blanco',52,3,10),($1,'Gris',40,3,11)`, [preview]);
});

async function search(sort: string, limit = 60, offset = 0, minimum: number | null = null, maximum: number | null = null) {
  return asUser(null, sql => sql(`select id, price_usd from public.search_products(
    p_store=>$1,p_sort=>$2,p_limit=>$3,p_offset=>$4,p_min_price=>$5,p_max_price=>$6)`,
  [store.storeSlug, sort, limit, offset, minimum, maximum]));
}

describe('catalogue price ordering uses the visible selection before pagination', () => {
  it('orders sold-out and available products together for explicit descending price', async () => {
    const rows = await search('price_desc');
    expect(rows.map(r => Number(r.price_usd))).toEqual([70, 52, 49, 49, 20]);
    expect(rows.some(r => r.id === store.productId)).toBe(true);
    expect(rows.some(r => r.id === hidden)).toBe(false);
  });

  it('orders ascending globally and resolves price ties by product id', async () => {
    const rows = await search('price_asc');
    expect(rows.map(r => Number(r.price_usd))).toEqual([20, 49, 49, 52, 70]);
    expect(rows.filter(r => Number(r.price_usd) === 49).map(r => r.id)).toEqual([store.productId, tied].sort());
  });

  it('keeps consecutive pages equivalent to the entire sorted set', async () => {
    const all = await search('price_desc');
    const pages = [...await search('price_desc', 2), ...await search('price_desc', 2, 2), ...await search('price_desc', 2, 4)];
    expect(pages.map(r => r.id)).toEqual(all.map(r => r.id));
    expect(new Set(pages.map(r => r.id)).size).toBe(5);
  });

  it('filters and returns the selected preview price rather than a cheaper unavailable option', async () => {
    const selected = await search('price_asc', 60, 0, 50, 55);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ id: preview, price_usd: '52.00' });
    const cheap = await search('price_asc', 60, 0, null, 30);
    expect(cheap.map(r => r.id)).toEqual([low]);
  });

  it('recomputes the preview after stock changes, without using a client price', async () => {
    await admin(`update public.product_variants set stock=0 where product_id=$1 and title='Blanco'`, [preview]);
    try {
      const rows = await search('price_desc');
      expect(Number(rows.find(r => r.id === preview)?.price_usd)).toBe(40);
      expect(rows.map(r => Number(r.price_usd))).toEqual([70, 49, 49, 40, 20]);
    } finally {
      await admin(`update public.product_variants set stock=3 where product_id=$1 and title='Blanco'`, [preview]);
    }
  });

  it('preserves the existing availability preference for relevance', async () => {
    const rows = await search('relevance');
    expect(rows.at(-1)?.id).toBe(store.productId);
    expect(rows.some(r => r.id === high)).toBe(true);
  });
});
