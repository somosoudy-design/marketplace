// Proposal only. Root may copy into tests/db-tests/test/db/ and run in the explicitly
// authorized disposable local clone. This reviewer has not executed these tests or SQL.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, pool, type Fixture } from '../../src/db';

const target = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.startsWith('/mayami_functional_')) {
  throw new Error('Set TEST_DATABASE_URL to the authorized local mayami_functional_* clone. No shared or remote database allowed.');
}
afterAll(() => pool.end());

type Draft = {
  fields?: Record<string, unknown>;
  variants?: Record<string, unknown>[];
  images?: Record<string, unknown>[];
  costs?: Record<string, unknown> | null;
  variantCosts?: Record<string, unknown>[];
};

it('removes only an explicit unassigned photo reference and preserves its storage object and other photos', async () => {
  const f = await fixture('remove-photo');
  const image = (await admin('select path from public.product_images where id=$1', [f.images[0]]))[0];
  await admin("insert into storage.buckets(id,name) values('catalog','catalog') on conflict do nothing");
  await admin("insert into storage.objects(bucket_id,name) values('catalog',$1) on conflict do nothing", [image.path]);
  const r = await current(f.owner, f);
  const intent = key('remove-photo');
  const input = { images: [{ id: f.images[0], remove: true }] };
  const first = await save(f.owner, f, r.revision, input, intent);
  expect(first.replayed).toBe(false);
  expect((await admin('select id from public.product_images where id=$1', [f.images[0]])).length).toBe(0);
  expect((await admin('select id from public.product_images where id=$1', [f.images[1]])).length).toBe(1);
  expect((await admin("select id from storage.objects where bucket_id='catalog' and name=$1", [image.path])).length).toBe(1);
  const after = await state(f);
  expect((await save(f.owner, f, r.revision, input, intent)).replayed).toBe(true);
  expect(await state(f)).toEqual(after);
});

it('refuses removal of a photo mapped to a variant and rolls back other fields', async () => {
  const f = await fixture('mapped-remove');
  await admin('insert into public.product_variant_images(product_id,variant_id,image_id,sort) values($1,$2,$3,0)', [f.productId, f.variantId, f.images[0]]);
  const r = await current(f.owner, f); const before = await state(f);
  await expectHint(save(f.owner, f, r.revision, { fields: { title: 'Must roll back' }, images: [{ id: f.images[0], remove: true }] }), 'catalog_metadata_review_required');
  expect(await state(f)).toEqual(before);
});

it('refuses foreign, missing, mixed and ambiguous image removals without changing data', async () => {
  const f = await fixture('invalid-remove'), other = await fixture('foreign-remove');
  const r = await current(f.owner, f); const before = await state(f);
  for (const image of [{ id: other.images[0], remove: true }, { id: randomUUID(), remove: true }, { id: f.images[0], remove: false }, { id: f.images[0], remove: true, sort: 0 }]) {
    await expectHint(save(f.owner, f, r.revision, { images: [image] }), 'invalid_input');
    expect(await state(f)).toEqual(before);
  }
});
type FixtureWithEditor = Fixture & { owner: string; second: string; images: string[] };
type Review = { product: Record<string, any>; revision: string };
type Saved = { product_id: string; revision: string; replayed: boolean };

async function fixture(label: string, inactiveSecond = false): Promise<FixtureWithEditor> {
  const owner = await createUser(`reviewed-${label}`);
  // Platform shipping is available in the established local fixtures; ownership still
  // comes from store_members, and seller requests run as authenticated, never service_role.
  const f = await createStoreWithProduct({ owner: owner.id, kind: 'platform', stock: 5, price: 25 });
  await admin("update public.products set option_names=array['Color','Capacidad'] where id=$1", [f.productId]);
  await admin(`update public.product_variants set options='{"Color":"Negro","Capacidad":"256 GB"}'::jsonb where id=$1`, [f.variantId]);
  const [second] = await admin(`insert into public.product_variants(product_id,title,price_usd,stock,active,sort,options)
    values($1,'Segunda',37.50,9,$2,1,'{"Color":"Blanco","Capacidad":"512 GB"}') returning id`, [f.productId, !inactiveSecond]);
  const images: string[] = [];
  for (let sort = 0; sort < 2; sort++) {
    const [row] = await admin(`insert into public.product_images(product_id,path,alt,width,height,sort)
      values($1,$2,$3,800,800,$4) returning id`,
      [f.productId, `${f.storeId}/${f.productId}/${randomUUID()}.webp`, `Texto alternativo original ${sort + 1}`, sort]);
    images.push(row.id);
  }
  return { ...f, owner: owner.id, second: second.id, images };
}

async function review(actor: string | null, f: Fixture): Promise<Review | null> {
  return asUser(actor, async sql => (await sql('select public.seller_product_editor_reviewed($1,$2) result', [f.storeId, f.productId]))[0].result);
}
async function current(actor: string, f: Fixture): Promise<Review> {
  const r = await review(actor, f);
  expect(r).not.toBeNull();
  expect(r!.revision).toMatch(/^[a-f0-9]{64}$/);
  return r!;
}
async function save(actor: string | null, f: Fixture, revision: unknown, input: Draft = {}, intent = key('seller')): Promise<Saved> {
  return asUser(actor, async sql => (await sql(`select public.seller_save_product_reviewed($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb) result`,
    [f.storeId, f.productId, revision, intent, JSON.stringify(input.fields ?? {}), JSON.stringify(input.variants ?? []),
      JSON.stringify(input.images ?? []), input.costs == null ? null : JSON.stringify(input.costs), JSON.stringify(input.variantCosts ?? [])]))[0].result);
}
async function state(f: Fixture) {
  return (await admin(`select jsonb_build_object(
    'product',(select to_jsonb(p) from public.products p where id=$1),
    'variants',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from public.product_variants v where v.product_id=$1),
    'images',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.product_images i where i.product_id=$1),
    'costs',(select to_jsonb(c) from public.product_costs c where c.product_id=$1),
    'variant_costs',(select coalesce(jsonb_agg(to_jsonb(c) order by c.variant_id),'[]') from public.variant_costs c join public.product_variants v on v.id=c.variant_id where v.product_id=$1),
    'moderation',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.moderation_events e where e.product_id=$1),
    'order_items',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]') from public.order_items o where o.product_id=$1),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.audit_log a where a.entity_id=$1::text or a.entity_id in(select v.id::text from public.product_variants v where v.product_id=$1))
  ) result`, [f.productId]))[0].result;
}

it('reads a deterministic full review including inactive variants, options and original timestamps', async () => {
  const f = await fixture('read', true);
  const first = await current(f.owner, f); const second = await current(f.owner, f);
  expect(second).toEqual(first);
  expect(first.product.id).toBe(f.productId);
  expect(first.product.product_variants).toHaveLength(2);
  expect(first.product.product_variants.find((v: any) => v.id === f.second)).toMatchObject({ active: false, options: { Color: 'Blanco', Capacidad: '512 GB' } });
  for (const v of first.product.product_variants) expect(typeof v.updated_at).toBe('string');
  expect(first.product.product_images).toHaveLength(2);
});

it('permits actual owner, staff and admin roles and denies guests, buyers and foreign members', async () => {
  const f = await fixture('roles'); const foreign = await fixture('foreign');
  const staff = await createUser('reviewed-staff'); const manager = await createUser('reviewed-admin', { role: 'admin' }); const buyer = await createUser('reviewed-buyer');
  await admin("insert into public.store_members(store_id,user_id,role) values($1,$2,'staff')", [f.storeId, staff.id]);
  for (const [actor, title] of [[f.owner, 'Nombre de propietario'], [staff.id, 'Nombre de personal'], [manager.id, 'Nombre de administrador']]) {
    const before = await current(actor!, f);
    const result = await save(actor!, f, before.revision, { fields: { title } });
    expect(result).toMatchObject({ product_id: f.productId, replayed: false });
    expect((await current(actor!, f)).product.title).toBe(title);
  }
  const before = await state(f); const r = await current(f.owner, f);
  for (const actor of [null, buyer.id, foreign.owner]) {
    await expect(review(actor, f)).rejects.toMatchObject({ code: '42501' });
    await expect(save(actor, f, r.revision, { fields: { title: 'No autorizado' } })).rejects.toMatchObject({ code: '42501' });
  }
  expect(await state(f)).toEqual(before);
});

it('is update-only and does not create a missing product or accept a forged store/product pairing', async () => {
  const f = await fixture('identity'); const foreign = await fixture('other-identity'); const r = await current(f.owner, f);
  const missing = { ...f, productId: randomUUID() };
  expect(await review(f.owner, missing)).toBeNull();
  await expect(save(f.owner, missing, r.revision, { fields: { title: 'No debe existir' } })).rejects.toBeTruthy();
  expect(await admin('select id from public.products where id=$1', [missing.productId])).toEqual([]);
  const before = await state(foreign);
  await expect(save(f.owner, { ...foreign, storeId: f.storeId }, r.revision, { fields: { title: 'Ajeno' } })).rejects.toBeTruthy();
  expect(await state(foreign)).toEqual(before);
});

it('rejects a stale inventory form after an actual local purchase and preserves the placed order', async () => {
  const f = await fixture('sale'); const buyer = await createUser('reviewed-sale-buyer');
  const old = await current(f.owner, f);
  const order = await buy(buyer.id, f.variantId, 1);
  const [persistedOrder] = await admin('select to_jsonb(o) row from public.orders o where id=$1', [order.order_id]);
  const before = await state(f);
  expect(before.variants.find((v: any) => v.id === f.variantId).stock).toBe(4);
  // Product metadata can stay unchanged for 5 -> 4; the full revision must still conflict.
  expect(before.product.updated_at).toBe(old.product.updated_at);
  await expectHint(save(f.owner, f, old.revision, { fields: { title: 'Título viejo con inventario viejo' }, variants: [{ id: f.variantId, stock: 5 }] }), 'seller_revision_conflict');
  expect(await state(f)).toEqual(before);
  expect((await admin('select to_jsonb(o) row from public.orders o where id=$1', [order.order_id]))[0]).toEqual(persistedOrder);
});

it('hashes stock values even when two writes share the same transaction timestamp', async () => {
  const f = await fixture('same-timestamp');
  await expectHint(asUser(f.owner, async sql => {
    await sql('update public.product_variants set stock=5 where id=$1', [f.variantId]);
    const [{ result: old }] = await sql('select public.seller_product_editor_reviewed($1,$2) result', [f.storeId, f.productId]);
    const [before] = await sql('select updated_at::text version from public.product_variants where id=$1', [f.variantId]);
    await sql('update public.product_variants set stock=4 where id=$1', [f.variantId]);
    const [after] = await sql('select updated_at::text version from public.product_variants where id=$1', [f.variantId]);
    expect(after.version).toBe(before.version);
    return sql('select public.seller_save_product_reviewed($1,$2,$3,$4)', [f.storeId, f.productId, old.revision, key('same-time')]);
  }), 'seller_revision_conflict');
});

describe('the revision covers rows omitted from the patch', () => {
  it('detects an inactive variant changed by another operation', async () => {
    const f = await fixture('omitted', true); const old = await current(f.owner, f);
    await admin('update public.product_variants set stock=8 where id=$1', [f.second]);
    const before = await state(f);
    await expectHint(save(f.owner, f, old.revision, { variants: [{ id: f.variantId, title: 'Sólo la primera' }] }), 'seller_revision_conflict');
    expect(await state(f)).toEqual(before);
  });
  it('detects an added photo without relying on a product timestamp update', async () => {
    const f = await fixture('photo-set'); const old = await current(f.owner, f);
    await admin('insert into public.product_images(product_id,path,alt,sort) values($1,$2,$3,2)', [f.productId, `${f.storeId}/${f.productId}/${randomUUID()}.webp`, 'Foto agregada concurrentemente']);
    const before = await state(f);
    await expectHint(save(f.owner, f, old.revision, { fields: { subtitle: 'Texto sin conocer foto nueva' } }), 'seller_revision_conflict');
    expect(await state(f)).toEqual(before);
  });
  it('detects changed product costs even when automatic pricing is disabled', async () => {
    const f = await fixture('costs');
    await admin("insert into public.product_costs(product_id,source,auto_price,notes) values($1,'propio',false,'Inicial')", [f.productId]);
    const old = await current(f.owner, f);
    await admin("update public.product_costs set notes='Cambio concurrente' where product_id=$1", [f.productId]);
    const before = await state(f);
    await expectHint(save(f.owner, f, old.revision, { fields: { title: 'No sobrescribir costos' } }), 'seller_revision_conflict');
    expect(await state(f)).toEqual(before);
  });
  it('detects costs of an omitted inactive variant', async () => {
    const f = await fixture('variant-cost', true);
    await admin('insert into public.variant_costs(variant_id,cost_usd) values($1,10)', [f.second]);
    const old = await current(f.owner, f);
    await admin('update public.variant_costs set cost_usd=11 where variant_id=$1', [f.second]);
    const before = await state(f);
    await expectHint(save(f.owner, f, old.revision, { fields: { subtitle: 'Sin cambios en esa variante' } }), 'seller_revision_conflict');
    expect(await state(f)).toEqual(before);
  });
});

it('keeps omitted variants, photos, alt text, dimensions and options while applying partial fields', async () => {
  const f = await fixture('patch'); const before = await state(f); const old = await current(f.owner, f);
  await save(f.owner, f, old.revision, { fields: { title: 'Título parcial' }, variants: [{ id: f.variantId, title: 'Nombre parcial' }], images: [{ id: f.images[0], sort: 2 }] });
  const after = await state(f);
  expect(after.product.title).toBe('Título parcial'); expect(after.product.option_names).toEqual(before.product.option_names);
  expect(after.variants).toHaveLength(2); expect(after.images).toHaveLength(2);
  expect(after.variants.find((v: any) => v.id === f.second)).toEqual(before.variants.find((v: any) => v.id === f.second));
  const oldFirst = before.variants.find((v: any) => v.id === f.variantId); const first = after.variants.find((v: any) => v.id === f.variantId);
  expect(first).toMatchObject({ title: 'Nombre parcial', options: oldFirst.options, stock: oldFirst.stock, price_usd: oldFirst.price_usd, sku: oldFirst.sku });
  const oldImage = before.images.find((i: any) => i.id === f.images[0]);
  expect(after.images.find((i: any) => i.id === f.images[0])).toEqual({ ...oldImage, sort: 2 });
  expect(after.images.find((i: any) => i.id === f.images[1])).toEqual(before.images.find((i: any) => i.id === f.images[1]));
});

it('allows explicit option_names and options replacements, including intentional empty values', async () => {
  const f = await fixture('options'); const initial = await current(f.owner, f);
  await save(f.owner, f, initial.revision, { fields: { option_names: ['Color', 'Talla'] }, variants: [{ id: f.variantId, options: { Color: 'Violeta', Talla: 'M' } }, {id:f.second,options:{Color:'Blanco'}}] });
  const edited = await current(f.owner, f);
  expect(edited.product.option_names).toEqual(['Color', 'Talla']);
  expect(edited.product.product_variants.find((v: any) => v.id === f.variantId).options).toEqual({ Color: 'Violeta', Talla: 'M' });
  await save(f.owner, f, edited.revision, { fields: { option_names: [] }, variants: [{ id: f.variantId, options: {} },{id:f.second,options:{}}] });
  const cleared = await current(f.owner, f);
  expect(cleared.product.option_names).toEqual([]);
  expect(cleared.product.product_variants.find((v: any) => v.id === f.variantId).options).toEqual({});
});

it('recovers a lost response without repeating writes or restoring stock after a later purchase', async () => {
  const f = await fixture('replay'); const buyer = await createUser('reviewed-replay-buyer'); const old = await current(f.owner, f); const intent = key('lost-response');
  const patch = { fields: { title: 'Guardado original' }, variants: [{ id: f.variantId, stock: 5 }] };
  const first = await save(f.owner, f, old.revision, patch, intent);
  expect(first.replayed).toBe(false); expect(first.revision).toMatch(/^[a-f0-9]{64}$/);
  await buy(buyer.id, f.variantId, 1);
  const beforeReplay = await state(f);
  const replay = await save(f.owner, f, old.revision, patch, intent);
  expect(replay).toEqual({ ...first, replayed: true });
  expect(await state(f)).toEqual(beforeReplay);
  expect((await current(f.owner, f)).revision).not.toBe(first.revision);
  await expectHint(save(f.owner, f, old.revision, { fields: { title: 'Otra intención' } }, intent), 'idempotency_conflict');
  expect(await state(f)).toEqual(beforeReplay);
});

it('scopes an idempotency key to the authenticated actor and checks membership again on replay', async () => {
  const f = await fixture('actor-key'); const staff = await createUser('reviewed-key-staff');
  await admin("insert into public.store_members(store_id,user_id,role) values($1,$2,'staff')", [f.storeId, staff.id]);
  const intent = key('same-key'); const old = await current(f.owner, f); const ownerPatch = { fields: { title: 'Operación del dueño' } };
  await save(f.owner, f, old.revision, ownerPatch, intent);
  const forStaff = await current(staff.id, f);
  expect((await save(staff.id, f, forStaff.revision, { fields: { title: 'Operación del personal' } }, intent)).replayed).toBe(false);
  await admin('delete from public.store_members where store_id=$1 and user_id=$2', [f.storeId, f.owner]);
  const before = await state(f);
  await expect(save(f.owner, f, old.revision, ownerPatch, intent)).rejects.toMatchObject({ code: '42501' });
  expect(await state(f)).toEqual(before);
});

it('rolls back product, variants, images and audit if a later field is invalid; failed intent is reusable', async () => {
  const f = await fixture('rollback'); const old = await current(f.owner, f); const before = await state(f); const intent = key('failed');
  await expect(save(f.owner, f, old.revision, { fields: { title: 'Debe revertirse' }, variants: [{ id: f.variantId, title: 'También' }, { id: f.second, stock: -1 }], images: [{ id: f.images[0], sort: 7 }] }, intent)).rejects.toBeTruthy();
  expect(await state(f)).toEqual(before);
  const fixed = await save(f.owner, f, old.revision, { fields: { title: 'Corrección válida' } }, intent);
  expect(fixed.replayed).toBe(false); expect((await current(f.owner, f)).product.title).toBe('Corrección válida');
});

it('refuses foreign variant/photo IDs and protected field injection without partial writes', async () => {
  const f = await fixture('foreign-ids'); const other = await fixture('foreign-rows');
  const old = await current(f.owner, f); const before = await state(f); const foreignBefore = await state(other);
  for (const patch of [
    { variants: [{ id: other.variantId, title: 'No es mío' }] },
    { images: [{ id: other.images[0], sort: 6 }] },
    { fields: { store_id: other.storeId } },
    { fields: { moderation_status: 'published' } },
    { fields: { is_demo: true } },
    { variants: [{ id: f.variantId, product_id: other.productId }] },
    { images: [{ id: f.images[0], product_id: other.productId }] },
  ] satisfies Draft[]) {
    await expect(save(f.owner, f, old.revision, patch)).rejects.toBeTruthy();
    expect(await state(f)).toEqual(before); expect(await state(other)).toEqual(foreignBefore);
  }
});

it('requires a scalar reviewed revision and rejects stale valid-shape digests without a legacy fallback', async () => {
  const f = await fixture('revision-shape'); const before = await state(f);
  for (const revision of [null, '', '{}', 'short', 'X'.repeat(64)]) await expect(save(f.owner, f, revision, { fields: { title: 'No revisión' } })).rejects.toBeTruthy();
  await expectHint(save(f.owner, f, '0'.repeat(64), { fields: { title: 'Digest viejo' } }), 'seller_revision_conflict');
  expect(await state(f)).toEqual(before);
});

it('returns product_busy when even an omitted inactive variant is locked and leaves all rows unchanged', async () => {
  const f = await fixture('busy', true); const old = await current(f.owner, f); const before = await state(f); const locker = await pool.connect();
  try {
    await locker.query('begin');
    await locker.query('select id from public.product_variants where id=$1 for update', [f.second]);
    const e = await expectHint(save(f.owner, f, old.revision, { fields: { title: 'No bloquear checkout' } }), 'product_busy');
    expect(e.code).toBe('55P03');
  } finally { await locker.query('rollback'); locker.release(); }
  expect(await state(f)).toEqual(before);
});

it('rejects stale manual pricing and weight changes without explicit cost handling for automatic products', async () => {
  const f = await fixture('automatic');
  // Isolated cost fixtures only: no global rates/snapshots, financial formulas or real transactions.
  await admin("insert into public.product_costs(product_id,source,auto_price) values($1,'propio',true)", [f.productId]);
  await admin('insert into public.variant_costs(variant_id,cost_usd) values($1,10)', [f.variantId]);
  const old = await current(f.owner, f); const before = await state(f);
  await expectHint(save(f.owner, f, old.revision, { variants: [{ id: f.variantId, price_usd: 26 }] }), 'seller_price_review_required');
  await expectHint(save(f.owner, f, old.revision, { fields: { weight_kg: 1 } }), 'seller_price_review_required');
  expect(await state(f)).toEqual(before);
  // Explicit costs delegate to the existing pricing procedure, whatever local snapshot is in force.
  await save(f.owner, f, old.revision, { fields: { weight_kg: 1 }, costs: { source: 'propio', auto_price: true }, variantCosts: [{ variant_id: f.variantId, cost_usd: 10 }] });
  const after = await state(f);
  expect(Number(after.product.weight_kg)).toBe(1); expect(after.costs.auto_price).toBe(true);
});

it('keeps suspension and never lets a seller approve a rejected product by saving variants/options', async () => {
  const f = await fixture('moderation'); const manager = await createUser('reviewed-moderator', { role: 'admin' });
  for (const [status, expected] of [['suspended', 'suspended'], ['rejected', 'pending']] as const) {
    await asUser(manager.id, sql => sql('select public.moderate_product($1,$2,$3)', [f.productId, status, 'Revisión administrativa real']));
    const old = await current(f.owner, f);
    await save(f.owner, f, old.revision, { fields: { title: `Ficha corregida ${status}` }, variants: [{ id: f.variantId, options: { Color: 'Negro' } }] });
    expect((await current(f.owner, f)).product.moderation_status).toBe(expected);
  }
});

it('cannot remove a declared option while silently leaving another SKU using it',async()=>{
  const f=await fixture('option-relation');const old=await current(f.owner,f);const before=await state(f);
  await expectHint(save(f.owner,f,old.revision,{fields:{option_names:['Color','Talla']},variants:[{id:f.variantId,options:{Color:'Violeta',Talla:'M'}}]}),'invalid_input');
  expect(await state(f)).toEqual(before);
});
it('returns costs from the same review and preserves omitted cost fields on an explicit cost patch',async()=>{
  const f=await fixture('cost-patch');
  await admin("insert into public.product_costs(product_id,source,auto_price,notes,freight_usd,logistics_usd,margin_pct) values($1,'propio',false,'Nota anterior',3,2,20)",[f.productId]);
  const old=await current(f.owner,f);expect((old as any).pricing.costs).toMatchObject({source:'propio',auto_price:false,notes:'Nota anterior',freight_usd:3});
  await save(f.owner,f,old.revision,{costs:{notes:'Nueva nota'}});
  const next=await current(f.owner,f);expect((next as any).pricing.costs).toMatchObject({source:'propio',auto_price:false,notes:'Nueva nota',freight_usd:3,logistics_usd:2,margin_pct:20});
  expect(next.revision).not.toBe(old.revision);
});
it('checks all explicitly mapped photos before changing color; other attributes keep those exact links',async()=>{
  const f=await fixture('mapped-color');
  const [{version}]=await admin('select updated_at::text version from public.product_variants where id=$1',[f.variantId]);
  await asUser(f.owner,q=>q('select public.catalog_set_variant_media($1,$2,$3,$4::uuid[],$5)',[f.storeId,f.productId,f.variantId,[f.images[0]],version]));
  const old=await current(f.owner,f),before=await state(f);
  await expectHint(save(f.owner,f,old.revision,{variants:[{id:f.variantId,options:{Color:'Blanco',Capacidad:'256 GB'}}]}),'catalog_metadata_review_required');
  expect(await state(f)).toEqual(before);
  await save(f.owner,f,old.revision,{variants:[{id:f.variantId,options:{Color:'Negro',Capacidad:'512 GB'}}]});
  expect((await admin('select image_id from public.product_variant_images where variant_id=$1',[f.variantId])).map(r=>r.image_id)).toEqual([f.images[0]]);
});
it('rejects undeclared options even when an equivalent UUID uses uppercase text',async()=>{
  const f=await fixture('uppercase');const old=await current(f.owner,f),before=await state(f);
  await expectHint(save(f.owner,f,old.revision,{variants:[{id:f.variantId.toUpperCase(),options:{NoDeclarada:'x'}}]}),'invalid_input');
  expect(await state(f)).toEqual(before);
});
it('preserves exact legacy text in fields omitted from a stock/options patch',async()=>{
  const f=await fixture('legacy-text');
  await admin("update public.products set title='  Título heredado  ',subtitle='  Subtítulo  ',description='  Descripción heredada  ' where id=$1",[f.productId]);
  await admin('update public.product_variants set title=$1,sku=$2 where id=$3',['  Variante  ',` SKU-${randomUUID()} `,f.variantId]);
  const old=await current(f.owner,f),before=await state(f);
  await save(f.owner,f,old.revision,{fields:{option_names:['Color','Capacidad','Acabado']},variants:[{id:f.variantId,stock:4}]});
  const after=await state(f);
  for(const field of ['title','subtitle','description']) expect(after.product[field]).toBe(before.product[field]);
  const first=before.variants.find((v:any)=>v.id===f.variantId),last=after.variants.find((v:any)=>v.id===f.variantId);
  expect(last.title).toBe(first.title);expect(last.sku).toBe(first.sku);expect(last.stock).toBe(4);
});
it('rejects non-finite text in all monetary/weight inputs and preserves every row on rejection',async()=>{
  const f=await fixture('nan');const old=await current(f.owner,f),before=await state(f);
  const bad:Draft[]=[{variants:[{id:f.variantId,price_usd:'NaN'}]}, {variants:[{id:f.variantId,price_usd:'Infinity'}]},
    {fields:{weight_kg:'NaN'}},{fields:{compare_at_usd:'NaN'}},{costs:{freight_usd:'NaN'}},
    {costs:{},variantCosts:[{variant_id:f.variantId,cost_usd:'NaN'}]}];
  for(const changes of bad){await expectHint(save(f.owner,f,old.revision,changes),'invalid_input');expect(await state(f)).toEqual(before);}
});
it('rejects ambiguous or whitespace-only explicit option writes with matching client/server rules',async()=>{
  const f=await fixture('option-whitespace');const old=await current(f.owner,f),before=await state(f);
  const bad:Draft[]=[{fields:{option_names:['Color','\tColor\t']}},{variants:[{id:f.variantId,options:{Color:'Rojo','\u00a0color\ufeff':'Azul'}}]},
    {variants:[{id:f.variantId,options:{Color:'\u00a0'}}]}];
  for(const changes of bad){await expectHint(save(f.owner,f,old.revision,changes),'invalid_input');expect(await state(f)).toEqual(before);}
});
it('private journal cannot be queried or forged by guests or authenticated sellers',async()=>{
  const f=await fixture('private-journal');
  for(const actor of [f.owner,null]){
    await expect(asUser(actor,q=>q('select * from authoring_private.product_edit_intents'))).rejects.toMatchObject({code:'42501'});
    await expect(asUser(actor,q=>q('select authoring_private.product_state($1)',[f.productId]))).rejects.toMatchObject({code:'42501'});
  }
});
async function lockWait(pid:number){
  for(let n=0;n<60;n++){
    if((await admin("select wait_event_type from pg_stat_activity where pid=$1",[pid]))[0]?.wait_event_type==='Lock')return;
    await new Promise(r=>setTimeout(r,10));
  }
  throw new Error('Expected a real database lock wait');
}
it('concurrent identical intents return one result and never repeat stock writes',async()=>{
  const f=await fixture('same-intent');const old=await current(f.owner,f);const intent=key('concurrent');const blocker=await pool.connect();
  let pending:Promise<[Saved,Saved]>|undefined;
  try{
    await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('seller-edit:'||$1||':'||$2,0))",[f.owner,intent]);
    pending=Promise.all([save(f.owner,f,old.revision,{variants:[{id:f.variantId,stock:4}]},intent),save(f.owner,f,old.revision,{variants:[{id:f.variantId,stock:4}]},intent)]);void pending.catch(()=>{});
    let waiting=0;
    for(let n=0;n<60;n++){
      const [{n:count}]=await admin("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and query like '%seller_save_product_reviewed%' and state='active'");
      waiting=count;if(waiting===2)break;await new Promise(r=>setTimeout(r,10));
    }
    expect(waiting).toBe(2);
    await blocker.query('rollback');
    const [a,b]=await pending;expect(a.revision).toBe(b.revision);expect([a.replayed,b.replayed].sort()).toEqual([false,true]);
    expect((await state(f)).variants.find((v:any)=>v.id===f.variantId).stock).toBe(4);
    expect((await admin('select count(*)::int n from authoring_private.product_edit_intents where actor_id=$1 and idempotency_key=$2',[f.owner,intent]))[0].n).toBe(1);
  }finally{await blocker.query('rollback');blocker.release();if(pending)await pending.catch(()=>{});}
});
it('a membership revoked during the intent wait cannot authorize a delayed save',async()=>{
  const f=await fixture('revoke-wait');const old=await current(f.owner,f);const intent=key('revoke');const blocker=await pool.connect();
  let pending:Promise<unknown>|undefined;
  try{
    await blocker.query('begin');await blocker.query("select pg_advisory_xact_lock(hashtextextended('seller-edit:'||$1||':'||$2,0))",[f.owner,intent]);
    let ready!:(pid:number)=>void;const pid=new Promise<number>(r=>{ready=r;});
    pending=asUser(f.owner,async q=>{ready((await q('select pg_backend_pid() pid'))[0].pid);return q("select public.seller_save_product_reviewed($1,$2,$3,$4,'{\"title\":\"No permitido\"}')",[f.storeId,f.productId,old.revision,intent]);});void pending.catch(()=>{});
    await lockWait(await pid);
    await admin('delete from public.store_members where store_id=$1 and user_id=$2',[f.storeId,f.owner]);
    const before=await state(f);await blocker.query('rollback');
    await expectHint(pending,'store_access_denied');expect(await state(f)).toEqual(before);
  }finally{await blocker.query('rollback');blocker.release();if(pending)await pending.catch(()=>{});}
});
it('locks the category definition before accepting sensitive metadata changes',async()=>{
  const f=await fixture('category-lock');const old=await current(f.owner,f),before=await state(f);const blocker=await pool.connect();
  try{
    await blocker.query('begin');await blocker.query('select id from public.categories where id=$1 for update',[f.categoryId]);
    await expectHint(save(f.owner,f,old.revision,{variants:[{id:f.variantId,options:{Color:'Negro',Capacidad:'1 TB'}}]}),'product_busy');
    expect(await state(f)).toEqual(before);
  }finally{await blocker.query('rollback');blocker.release();}
});
