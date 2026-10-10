import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, pool } from '../../src/db';

afterAll(() => pool.end());

describe('seller panel reads', () => {
  it('a store sees its own deliveries with payment state and lines, never another store’s', async () => {
    const seller = await createUser('st-seller');
    const other = await createUser('st-other');
    const buyer = await createUser('st-buyer');
    const f = await createStoreWithProduct({ owner: seller.id, price: 20, stock: 5 });
    await createStoreWithProduct({ owner: other.id });
    const order = await buy(buyer.id, f.variantId, 2);

    const [{ seller_fulfillments: open }] = await asUser(seller.id, (sql) => sql(`select public.seller_fulfillments($1, 'open')`, [f.storeId]));
    const mine = open.find((x: any) => x.order_id === order.order_id);
    expect(mine).toMatchObject({ order_number: order.number, payment_level: 'none', store_id: f.storeId });
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ quantity: 2, line_total_usd: 40 });
    expect(mine.ship_to.recipient).toBe('Persona de Prueba');

    await expect(
      asUser(other.id, (sql) => sql(`select public.seller_fulfillments($1)`, [f.storeId])),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(buyer.id, (sql) => sql(`select public.seller_sales($1)`, [f.storeId]))).rejects.toMatchObject({ code: '42501' });

    const [{ seller_sales: sales }] = await asUser(seller.id, (sql) => sql(`select public.seller_sales($1, 30)`, [f.storeId]));
    const line = sales.find((s: any) => s.order_number === order.number);
    expect(Number(line.net_usd)).toBeCloseTo(Number(line.line_total_usd) - Number(line.commission_usd), 2);
    expect(Number(line.commission_usd)).toBeGreaterThan(0);
  });

  it('sellers only manage real rates for deliveries they ship themselves', async () => {
    const seller = await createUser('st-rates');
    const f = await createStoreWithProduct({ owner: seller.id });
    const [ids] = await admin(
      `select (select id from public.shipping_methods where code = 'mrw_domicilio') as method_id, (select id from public.shipping_zones where code = 'centro') as zone_id`,
    );
    const insert = (flows: string, demo: boolean) =>
      asUser(seller.id, (sql) =>
        sql(
          `insert into public.shipping_rates (method_id, zone_id, store_id, flows, base_usd, min_days, max_days, is_demo)
           values ($1, $2, $3, $4::public.fulfillment_flow[], 5, 1, 3, $5) returning id`,
          [ids.method_id, ids.zone_id, f.storeId, flows, demo],
        ),
      );
    await expect(insert('{local_stock}', false)).rejects.toMatchObject({ code: '42501' });
    await expect(insert('{seller_shipping}', true)).rejects.toMatchObject({ code: '42501' });
    const [r] = await insert('{seller_shipping}', false);
    expect(r.id).toBeTruthy();
  });
});
