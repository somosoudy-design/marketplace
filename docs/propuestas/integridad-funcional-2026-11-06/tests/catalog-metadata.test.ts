// Proposal only. Copy into tests/db-tests/test/db/ before running on the authorized isolated clone.
// No migrations, remote calls, Storage operations or production fixtures are executed by this file.
import { productColorSummaries } from '../../../../packages/core/src/product-selection';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, pool, type Fixture } from '../../src/db';

// Fail closed before any fixture query: these proposals may only write the explicitly isolated clone.
const isolatedTarget = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['localhost','127.0.0.1','[::1]'].includes(isolatedTarget.hostname) ||
    !isolatedTarget.pathname.startsWith('/mayami_functional_')) {
  throw new Error('Set TEST_DATABASE_URL to the authorized local mayami_functional_* clone. No shared or remote database is allowed.');
}

afterAll(() => pool.end());

it('does not present photos assigned to a hidden inactive variant as general images, and carries the actual SKU', async()=>{
  const f=await fixture('general-hidden');
  await admin('update public.product_variants set active=false,media_classified=true where id=$1',[f.secondVariantId]);
  const sku='ACTUAL-'+f.variantId;
  await admin('update public.product_variants set sku=$2 where id=$1',[f.variantId,sku]);
  await admin('insert into public.product_variant_images(product_id,variant_id,image_id,sort) values($1,$2,$3,0)',[f.productId,f.secondVariantId,f.imageIds[0]]);
  const m=(await asUser(null,async sql=>(await sql('select public.catalog_metadata($1::uuid[]) r',[[f.productId]]))[0].r))[0];
  expect(m.variants.map((v:any)=>v.variant_id)).toEqual([f.variantId]);
  expect(m.variants[0].sku).toBe(sku);
  expect(m.general_images.map((i:any)=>i.id)).toEqual([f.imageIds[1]]);
  const detail=await asUser(null,async sql=>(await sql('select public.product_detail_commercial($1) r',[f.productId]))[0].r);
  expect(detail.general_images.map((i:any)=>i.id)).toEqual([f.imageIds[1]]);
  expect(detail.variants[0].sku).toBe(sku);
  expect(detail.catalog_metadata).toEqual(m);
});

type CatalogFixture = Fixture & { owner: string; secondVariantId: string; imageIds: string[] };
const productVersion = async (id: string) => (await admin('select updated_at::text version from public.products where id=$1', [id]))[0].version as string;
const variantVersion = async (id: string) => (await admin('select updated_at::text version from public.product_variants where id=$1', [id]))[0].version as string;
async function fixture(label: string, category?: string): Promise<CatalogFixture> {
  const owner = await createUser(`catmeta-${label}`);
  const f = await createStoreWithProduct({ owner: owner.id, category, price: 25, stock: 5 });
  const [second] = await admin("insert into public.product_variants(product_id,title,price_usd,stock,sort) values($1,'Segunda',37.50,9,1) returning id", [f.productId]);
  const images: string[] = [];
  for (let sort = 0; sort < 2; sort++) {
    const [image] = await admin('insert into public.product_images(product_id,path,alt,width,height,sort) values($1,$2,$3,800,800,$4) returning id',
      [f.productId, `${f.storeId}/${f.productId}/${randomUUID()}.webp`, `Fotografía ${sort + 1}`, sort]);
    images.push(image.id);
  }
  return { ...f, owner: owner.id, secondVariantId: second.id, imageIds: images };
}
const metadata = (actor: string | null, ids: (string | null)[] | null, condition: string | null = null) => asUser(actor, async sql =>
  (await sql('select public.catalog_metadata($1::uuid[],$2::text) result', [ids, condition]))[0].result as any[]);
const detail = (actor: string | null, id: string) => asUser(actor, async sql =>
  (await sql('select public.product_detail_commercial($1) result', [id]))[0].result);
const conditionWrite = (actor: string | null, f: Fixture, value: string | null, version: string | null) => asUser(actor, async sql =>
  (await sql('select public.catalog_set_condition($1,$2,$3,$4) result', [f.storeId, f.productId, value, version]))[0].result);
const mediaWrite = (actor: string | null, f: Fixture, variant: string, ids: (string | null)[] | null, version: string | null) => asUser(actor, async sql =>
  (await sql('select public.catalog_set_variant_media($1,$2,$3,$4::uuid[],$5) result', [f.storeId, f.productId, variant, ids, version]))[0].result);

// Compare whole existing rows, not only the fields the proposed implementation happens to touch.
// Only the explicitly authorized new fields and their updated_at versions are excluded.
async function protectedState(f: Fixture) {
  return (await admin(`select jsonb_build_object(
    'product',(select to_jsonb(p)-array['condition','updated_at'] from public.products p where id=$1),
    'variants',(select jsonb_agg(to_jsonb(v)-array['media_classified','updated_at'] order by id) from public.product_variants v where product_id=$1),
    'images',(select jsonb_agg(to_jsonb(i) order by id) from public.product_images i where product_id=$1),
    'moderation',(select jsonb_agg(to_jsonb(e) order by id) from public.moderation_events e where product_id=$1),
    'order_items',(select jsonb_agg(to_jsonb(i) order by id) from public.order_items i where product_id=$1)
  ) state`, [f.productId]))[0].state;
}
async function metadataState(f: Fixture) {
  return (await admin(`select jsonb_build_object(
    'product',(select jsonb_build_object('condition',condition,'updated_at',updated_at) from public.products where id=$1),
    'variants',(select jsonb_agg(jsonb_build_object('id',id,'media_classified',media_classified,'updated_at',updated_at) order by id) from public.product_variants where product_id=$1),
    'links',(select coalesce(jsonb_agg(to_jsonb(m) order by variant_id,sort),'[]'::jsonb) from public.product_variant_images m where product_id=$1)
  ) state`, [f.productId]))[0].state;
}
const links = (variant: string) => admin('select image_id,sort from public.product_variant_images where variant_id=$1 order by sort', [variant]);
const auditCount = async (entity: string, id: string) => (await admin('select count(*)::int n from public.audit_log where entity=$1 and entity_id=$2', [entity, id]))[0].n as number;
function omit(value: Record<string, unknown>, keys: string[]) { const copy = { ...value }; for (const k of keys) delete copy[k]; return copy; }

it('preserves NULL condition and unknown legacy galleries without changing the existing product detail', async () => {
  const f = await fixture('legacy'); const before = await protectedState(f); const metaBefore = await metadataState(f);
  const [row] = await metadata(null, [f.productId]);
  expect(row.condition).toBeNull(); expect(row.colors).toEqual([]);
  expect(row.variants).toHaveLength(2);
  for (const variant of row.variants) expect(variant).toMatchObject({ media_classified: false, media_state: 'unknown', images: [], color: null });
  const original = await asUser(null, async sql => (await sql('select public.product_detail($1) result', [f.productId]))[0].result);
  const commercial = await detail(null, f.productId);
  expect(commercial).toMatchObject({ condition: null, available_colors: [], variant_image_links: [] });
  expect(commercial.images.map((i: any) => i.id)).toEqual(f.imageIds);
  expect(commercial.general_images.map((i:any)=>i.id)).toEqual(f.imageIds);
  expect(commercial.variants.map((v:any)=>v.sku)).toEqual([null,null]);
  const comparable = omit(commercial, ['condition', 'available_colors', 'variant_image_links','general_images','catalog_metadata']);
  comparable.images = commercial.images.map((i: any) => omit(i, ['id']));
  comparable.variants = commercial.variants.map((v: any) => omit(v, ['media_classified','sku']));
  expect(comparable).toEqual(original);
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(metaBefore);
});

it('persists explicit condition, supports NULL, and treats an identical retry as a no-op', async () => {
  const f = await fixture('condition'); const before = await protectedState(f); const auditBefore = await auditCount('products', f.productId);
  const first = await conditionWrite(f.owner, f, 'refurbished', await productVersion(f.productId));
  expect(first).toMatchObject({ product_id: f.productId, condition: 'refurbished' });
  expect((await metadata(null, [f.productId]))[0]).toMatchObject(first);
  const again = await conditionWrite(f.owner, f, 'refurbished', first.updated_at);
  expect(again).toEqual(first); expect(await auditCount('products', f.productId)).toBe(auditBefore + 1);
  const cleared = await conditionWrite(f.owner, f, null, first.updated_at);
  expect(cleared.condition).toBeNull(); expect((await metadata(null, [f.productId]))[0].condition).toBeNull();
  expect(await auditCount('products', f.productId)).toBe(auditBefore + 2);
  expect(await protectedState(f)).toEqual(before);
});

it('allows real staff and administrators without expanding buyer or foreign-store permissions', async () => {
  const f = await fixture('members'); const before = await protectedState(f);
  const staff = await createUser('catmeta-staff'); const manager = await createUser('catmeta-admin', { role: 'admin' });
  await admin("insert into public.store_members(store_id,user_id,role) values($1,$2,'staff')", [f.storeId, staff.id]);
  for (const [actor, value] of [[staff.id, 'refurbished'], [manager.id, 'new']] as const) {
    await conditionWrite(actor, f, value, await productVersion(f.productId));
    await mediaWrite(actor, f, f.variantId, actor === staff.id ? [f.imageIds[0]!] : [], await variantVersion(f.variantId));
    const [row] = await metadata(null, [f.productId]); expect(row.condition).toBe(value);
    expect(row.variants.find((v: any) => v.variant_id === f.variantId).media_state).toBe(actor === staff.id ? 'mapped' : 'none');
  }
  expect(await protectedState(f)).toEqual(before);
});

it('rejects guest, buyer, foreign member and unverified admin claims without changing persistent metadata', async () => {
  const f = await fixture('unauthorized'); const foreign = await fixture('foreign'); const buyer = await createUser('catmeta-buyer');
  const before = await protectedState(f); const state = await metadataState(f);
  const pv = await productVersion(f.productId); const vv = await variantVersion(f.variantId);
  for (const actor of [null, buyer.id, foreign.owner]) {
    await expect(conditionWrite(actor, f, 'new', pv)).rejects.toMatchObject({ code: '42501' });
    await expect(mediaWrite(actor, f, f.variantId, [f.imageIds[0]!], vv)).rejects.toMatchObject({ code: '42501' });
  }
  await expectHint(asUser(buyer.id, async sql => {
    await sql("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: buyer.id, role: 'authenticated', app_roles: ['admin', 'superadmin'] })]);
    return sql('select public.catalog_set_condition($1,$2,$3,$4)', [f.storeId, f.productId, 'new', pv]);
  }), 'store_access_denied');
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

it('validates the authorized product/store before touching a foreign variant', async () => {
  const f = await fixture('identity'); const other = await fixture('other-identity');
  const before = await protectedState(f); const foreignBefore = await protectedState(other);
  const state = await metadataState(f); const foreignState = await metadataState(other);
  const forged = { ...other, storeId: f.storeId }; const foreignVersion = await variantVersion(other.variantId);
  const locked = await pool.connect();
  try {
    await locked.query('begin'); await locked.query('select id from public.product_variants where id=$1 for update', [other.variantId]);
    await expectHint(mediaWrite(f.owner, forged, other.variantId, [], foreignVersion), 'not_found');
    await expectHint(conditionWrite(f.owner, forged, 'new', await productVersion(other.productId)), 'not_found');
  } finally { await locked.query('rollback'); locked.release(); }
  await expectHint(mediaWrite(f.owner, f, other.variantId, [], foreignVersion), 'not_found');
  expect(await protectedState(f)).toEqual(before); expect(await protectedState(other)).toEqual(foreignBefore);
  expect(await metadataState(f)).toEqual(state); expect(await metadataState(other)).toEqual(foreignState);
});

it('rejects invalid conditions and preserves the current value when an old product version is submitted', async () => {
  const f = await fixture('validation'); const before = await protectedState(f); const old = await productVersion(f.productId);
  const saved = await conditionWrite(f.owner, f, 'new', old); const state = await metadataState(f);
  await expectHint(conditionWrite(f.owner, f, 'refurbished', old), 'catalog_version_conflict');
  for (const bad of ['used', 'Refurbished', '', 'preorder']) await expectHint(conditionWrite(f.owner, f, bad, saved.updated_at), 'invalid_input');
  await expectHint(conditionWrite(f.owner, f, 'new', null), 'invalid_input');
  await expect(admin("update public.products set condition='invented' where id=$1", [f.productId])).rejects.toMatchObject({ code: '23514' });
  expect(await metadataState(f)).toEqual(state); expect(await protectedState(f)).toEqual(before);
});

it('advances product versions inside one transaction and rejects the earlier version without relying on sleep', async () => {
  const f = await fixture('product-monotonic'); const before = await protectedState(f);
  const last = await asUser(f.owner, async sql => {
    const [initial] = await sql('select updated_at::text version from public.products where id=$1', [f.productId]);
    const [one] = await sql("select public.catalog_set_condition($1,$2,'new',$3) result", [f.storeId, f.productId, initial.version]);
    expect((await sql('select $1::timestamptz > $2::timestamptz advanced', [one.result.updated_at, initial.version]))[0].advanced).toBe(true);
    await sql('savepoint stale_condition');
    await expectHint(sql("select public.catalog_set_condition($1,$2,'refurbished',$3)", [f.storeId, f.productId, initial.version]), 'catalog_version_conflict');
    await sql('rollback to savepoint stale_condition');
    const [two] = await sql("select public.catalog_set_condition($1,$2,'refurbished',$3) result", [f.storeId, f.productId, one.result.updated_at]);
    expect((await sql('select $1::timestamptz > $2::timestamptz advanced', [two.result.updated_at, one.result.updated_at]))[0].advanced).toBe(true);
    return two.result;
  });
  expect((await metadata(null, [f.productId]))[0]).toMatchObject(last); expect(await protectedState(f)).toEqual(before);
});

it('advances variant versions inside one transaction and distinguishes confirmed empty from unclassified', async () => {
  const f = await fixture('variant-monotonic'); const before = await protectedState(f);
  const old = await variantVersion(f.variantId);
  const result = await asUser(f.owner, async sql => {
    const [empty] = await sql("select public.catalog_set_variant_media($1,$2,$3,'{}'::uuid[],$4) result", [f.storeId, f.productId, f.variantId, old]);
    expect(empty.result).toMatchObject({ media_classified: true, media_state: 'none' });
    expect((await sql('select $1::timestamptz > $2::timestamptz advanced', [empty.result.updated_at, old]))[0].advanced).toBe(true);
    await sql('savepoint stale_media');
    await expectHint(sql('select public.catalog_set_variant_media($1,$2,$3,$4::uuid[],$5)', [f.storeId, f.productId, f.variantId, f.imageIds, old]), 'catalog_version_conflict');
    await sql('rollback to savepoint stale_media');
    const [mapped] = await sql('select public.catalog_set_variant_media($1,$2,$3,$4::uuid[],$5) result', [f.storeId, f.productId, f.variantId, f.imageIds, empty.result.updated_at]);
    expect((await sql('select $1::timestamptz > $2::timestamptz advanced', [mapped.result.updated_at, empty.result.updated_at]))[0].advanced).toBe(true);
    return mapped.result;
  });
  const [row] = await metadata(null, [f.productId]);
  expect(row.variants.find((v: any) => v.variant_id === f.variantId)).toMatchObject({ media_classified: true, media_state: 'mapped', updated_at: result.updated_at });
  expect(row.variants.find((v: any) => v.variant_id === f.secondVariantId)).toMatchObject({ media_classified: false, media_state: 'unknown', images: [] });
  expect(await links(f.variantId)).toEqual(f.imageIds.map((image_id, sort) => ({ image_id, sort })));
  expect(await protectedState(f)).toEqual(before);
});

it('blocks direct client updates and link writes even from a real owning member or administrator', async () => {
  const f = await fixture('direct-guard'); const manager = await createUser('catmeta-direct-admin', { role: 'admin' });
  const before = await protectedState(f); const state = await metadataState(f);
  for (const actor of [f.owner, manager.id]) {
    for (const value of [null, 'refurbished']) await expectHint(asUser(actor, sql => sql('update public.products set condition=$1 where id=$2', [value, f.productId])), 'catalog_metadata_guarded');
    for (const value of [false, true]) await expectHint(asUser(actor, sql => sql('update public.product_variants set media_classified=$1 where id=$2', [value, f.variantId])), 'catalog_metadata_guarded');
    await expect(asUser(actor, sql => sql('insert into public.product_variant_images(product_id,variant_id,image_id,sort) values($1,$2,$3,0)', [f.productId, f.variantId, f.imageIds[0]]))).rejects.toMatchObject({ code: '42501' });
  }
  expect(await metadataState(f)).toEqual(state); expect(await protectedState(f)).toEqual(before);
});

it('fails closed for published sensitive products, while a real administrator preserves commercial state', async () => {
  const slug = `sensitive-${randomUUID().slice(0, 8)}`;
  await admin("insert into public.categories(slug,name,risk_level,requires_review) values($1,'Categoría local sensible','regulated',true)", [slug]);
  const f = await fixture('sensitive', slug); const manager = await createUser('catmeta-sensitive-admin', { role: 'admin' });
  const staff = await createUser('catmeta-sensitive-staff');
  await admin("insert into public.store_members(store_id,user_id,role) values($1,$2,'staff')", [f.storeId, staff.id]);
  const before = await protectedState(f); const state = await metadataState(f);
  for (const actor of [f.owner, staff.id]) {
    await expectHint(conditionWrite(actor, f, 'refurbished', await productVersion(f.productId)), 'catalog_sensitive_review_required');
    await expectHint(mediaWrite(actor, f, f.variantId, [f.imageIds[0]!], await variantVersion(f.variantId)), 'catalog_sensitive_review_required');
  }
  expect(await metadataState(f)).toEqual(state);
  await conditionWrite(manager.id, f, 'refurbished', await productVersion(f.productId));
  await mediaWrite(manager.id, f, f.variantId, [f.imageIds[0]!], await variantVersion(f.variantId));
  expect((await metadata(null, [f.productId]))[0]).toMatchObject({ condition: 'refurbished' });
  expect(await links(f.variantId)).toEqual([{ image_id: f.imageIds[0], sort: 0 }]);
  expect(await protectedState(f)).toEqual(before);
});

it('rolls back condition and moderation events if a metadata-only edit would resubmit a rejected product', async () => {
  const f = await fixture('moderation-preserve');
  await admin("update public.products set moderation_status='rejected',moderation_note='Revisión local pendiente' where id=$1", [f.productId]);
  const before = await protectedState(f); const state = await metadataState(f);
  await expectHint(conditionWrite(f.owner, f, 'refurbished', await productVersion(f.productId)), 'catalog_metadata_review_required');
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

it('persists explicit photo order, allows sharing one photo, and records confirmed empty without touching Storage', async () => {
  const f = await fixture('ordered-media'); const before = await protectedState(f);
  const storageBefore = (await admin("select coalesce(jsonb_agg(to_jsonb(o) order by id),'[]'::jsonb) objects from storage.objects o where bucket_id='catalog' and name like $1", [`${f.storeId}/${f.productId}/%`]))[0].objects;
  const reversed = [...f.imageIds].reverse();
  const first = await mediaWrite(f.owner, f, f.variantId, reversed, await variantVersion(f.variantId));
  expect(await links(f.variantId)).toEqual(reversed.map((image_id, sort) => ({ image_id, sort })));
  const auditAfter = await auditCount('product_variant_images', f.variantId);
  expect(await mediaWrite(f.owner, f, f.variantId, reversed, first.updated_at)).toEqual(first);
  expect(await auditCount('product_variant_images', f.variantId)).toBe(auditAfter);
  await mediaWrite(f.owner, f, f.secondVariantId, [reversed[0]!], await variantVersion(f.secondVariantId));
  expect(await links(f.secondVariantId)).toEqual([{ image_id: reversed[0], sort: 0 }]);
  const empty = await mediaWrite(f.owner, f, f.variantId, [], first.updated_at);
  expect(empty).toMatchObject({ media_classified: true, media_state: 'none' }); expect(await links(f.variantId)).toEqual([]);
  expect((await metadata(null, [f.productId]))[0].variants.find((v: any) => v.variant_id === f.variantId)).toMatchObject({ media_state: 'none', images: [] });
  expect((await admin("select coalesce(jsonb_agg(to_jsonb(o) order by id),'[]'::jsonb) objects from storage.objects o where bucket_id='catalog' and name like $1", [`${f.storeId}/${f.productId}/%`]))[0].objects).toEqual(storageBefore);
  expect(await protectedState(f)).toEqual(before);
});

it('rejects duplicate, missing, NULL and cross-product images atomically, including privileged FK attempts', async () => {
  const f = await fixture('bad-media'); const other = await fixture('foreign-media'); const before = await protectedState(f);
  const saved = await mediaWrite(f.owner, f, f.variantId, [f.imageIds[0]!], await variantVersion(f.variantId));
  const state = await metadataState(f);
  const badLists: ((string | null)[] | null)[] = [[f.imageIds[0]!, f.imageIds[0]!], [randomUUID()], [other.imageIds[0]!], [null], null, Array.from({ length: 101 }, () => randomUUID())];
  for (const ids of badLists) await expectHint(mediaWrite(f.owner, f, f.variantId, ids, saved.updated_at), 'invalid_input');
  await expectHint(mediaWrite(f.owner, f, f.variantId, [], null), 'invalid_input');
  await expect(admin('insert into public.product_variant_images(product_id,variant_id,image_id,sort) values($1,$2,$3,5)', [f.productId, f.variantId, other.imageIds[0]])).rejects.toMatchObject({ code: '23503' });
  await expect(admin('insert into public.product_variant_images(product_id,variant_id,image_id,sort) values($1,$2,$3,5)', [f.productId, other.variantId, f.imageIds[1]])).rejects.toMatchObject({ code: '23503' });
  expect(await metadataState(f)).toEqual(state); expect(await protectedState(f)).toEqual(before);
});

it('enforces RLS for private product metadata, detail and direct link reads', async () => {
  const ownerA = await fixture('private-A'); const f = await fixture('private-B'); const buyer = await createUser('catmeta-private-buyer');
  await mediaWrite(f.owner, f, f.variantId, [f.imageIds[0]!], await variantVersion(f.variantId));
  await admin("update public.products set moderation_status='pending' where id=$1", [f.productId]);
  const before = await protectedState(f); const state = await metadataState(f);
  for (const actor of [null, buyer.id, ownerA.owner]) {
    expect(await metadata(actor, [f.productId])).toEqual([]); expect(await detail(actor, f.productId)).toBeNull();
    expect(await asUser(actor, sql => sql('select * from public.product_variant_images where product_id=$1', [f.productId]))).toEqual([]);
  }
  expect(await metadata(f.owner, [f.productId])).toHaveLength(1); expect((await detail(f.owner, f.productId)).id).toBe(f.productId);
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

it('filters only explicit conditions within the requested batch and preserves legacy NULL and first-ID order otherwise', async () => {
  const legacy = await fixture('filter-legacy'); const fresh = await fixture('filter-new'); const renewed = await fixture('filter-refurb');
  await conditionWrite(fresh.owner, fresh, 'new', await productVersion(fresh.productId));
  await conditionWrite(renewed.owner, renewed, 'refurbished', await productVersion(renewed.productId));
  const fixtures = [legacy, fresh, renewed]; const before = await Promise.all(fixtures.map(protectedState)); const states = await Promise.all(fixtures.map(metadataState));
  const ids = [renewed.productId, legacy.productId, fresh.productId, renewed.productId, randomUUID()];
  expect((await metadata(null, ids)).map(r => r.product_id)).toEqual([renewed.productId, legacy.productId, fresh.productId]);
  expect((await metadata(null, ids, 'new')).map(r => r.product_id)).toEqual([fresh.productId]);
  expect((await metadata(null, ids, 'refurbished')).map(r => r.product_id)).toEqual([renewed.productId]);
  expect(await metadata(null, [])).toEqual([]);
  for (const badIds of [null, [null], Array(101).fill(legacy.productId)]) await expectHint(metadata(null, badIds), 'invalid_input');
  await expectHint(metadata(null, ids, 'preorder'), 'invalid_input');
  expect(await Promise.all(fixtures.map(protectedState))).toEqual(before); expect(await Promise.all(fixtures.map(metadataState))).toEqual(states);
});

it('returns explicit color labels, variant prices and stock from their actual rows and preserves original values', async () => {
  const f = await fixture('colors');
  await admin('update public.product_variants set options=$1::jsonb,title=$2 where id=$3', [JSON.stringify({ ' Color ': ' Rojo ', Tamaño: 'S' }), 'Rojo pequeño', f.variantId]);
  await admin('update public.product_variants set options=$1::jsonb,title=$2 where id=$3', [JSON.stringify({ color: 'Azul', Tamaño: 'M' }), 'Azul mediano', f.secondVariantId]);
  await mediaWrite(f.owner, f, f.variantId, [f.imageIds[1]!], await variantVersion(f.variantId));
  await conditionWrite(f.owner, f, 'refurbished', await productVersion(f.productId));
  const before = await protectedState(f); const state = await metadataState(f); const [row] = await metadata(null, [f.productId]);
  expect([...row.colors].sort()).toEqual([' Rojo ', 'Azul'].sort());
  expect(row.variants.find((v: any) => v.variant_id === f.variantId)).toMatchObject({ title: 'Rojo pequeño', options: { ' Color ': ' Rojo ', Tamaño: 'S' }, color: ' Rojo ', price_usd: 25, stock: 5, active: true, media_state: 'mapped' });
  expect(row.variants.find((v: any) => v.variant_id === f.secondVariantId)).toMatchObject({ title: 'Azul mediano', color: 'Azul', price_usd: 37.5, stock: 9, media_state: 'unknown' });
  const commercial = await detail(null, f.productId);
  expect(commercial).toMatchObject({ condition: 'refurbished', available_colors: row.colors });
  expect(commercial.variant_image_links).toEqual([{ variant_id: f.variantId, image_id: f.imageIds[1], sort: 0 }]);
  expect(commercial.variants.find((v: any) => v.id === f.variantId)).toMatchObject({ media_classified: true, price_usd: 25, stock: 5 });
  expect(commercial.variants.find((v: any) => v.id === f.secondVariantId)).toMatchObject({ media_classified: false, price_usd: 37.5, stock: 9 });
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

it('does not infer colors from titles, nonstring attributes, empty labels or conflicting explicit aliases', async () => {
  const f = await fixture('invalid-color');
  await admin('update public.product_variants set title=$1,options=$2::jsonb where id=$3', ['Rojo profesional', JSON.stringify({ Color: 7, Acabado: 'Rojo' }), f.variantId]);
  await admin('update public.product_variants set options=$1::jsonb where id=$2', [JSON.stringify({ Color: 'Azul', color: 'Verde' }), f.secondVariantId]);
  const before = await protectedState(f); const state = await metadataState(f);
  const [row] = await metadata(null, [f.productId]); expect(row.colors).toEqual([]);
  for (const variant of row.variants) expect(variant.color).toBeNull();
  for (const [input, expected] of [[{}, null], [{ Color: '' }, null], [{ color: '  ' }, null], [{ Color: false }, null], [{ Color: null }, null], [[], null], [{ Color: 'Azul', ' color ': 'Azul' }, 'Azul']] as const) {
    expect((await asUser(null, sql => sql('select public._catalog_option_color($1::jsonb) color', [JSON.stringify(input)])))[0].color).toBe(expected);
  }
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

it('omits inactive variant metadata from public detail without changing the seller-visible metadata', async () => {
  const f = await fixture('inactive');
  await mediaWrite(f.owner, f, f.secondVariantId, [f.imageIds[1]!], await variantVersion(f.secondVariantId));
  await admin('update public.product_variants set active=false where id=$1', [f.secondVariantId]);
  const before = await protectedState(f); const state = await metadataState(f);
  expect((await metadata(null, [f.productId]))[0].variants.map((v: any) => v.variant_id)).toEqual([f.variantId]);
  expect((await metadata(f.owner, [f.productId]))[0].variants.map((v: any) => v.variant_id)).toContain(f.secondVariantId);
  const commercial = await detail(null, f.productId);
  expect(commercial.variants.map((v: any) => v.id)).toEqual([f.variantId]); expect(commercial.variant_image_links).toEqual([]);
  expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
});

for (const entity of ['products', 'product_variants', 'product_images'] as const) {
  it(`fails promptly when ${entity} is locked, preserving all catalog metadata`, async () => {
    const f = await fixture(`lock-${entity}`); const before = await protectedState(f); const state = await metadataState(f); const version = await variantVersion(f.variantId);
    const id = entity === 'products' ? f.productId : entity === 'product_variants' ? f.variantId : f.imageIds[0];
    const lock = await pool.connect();
    try {
      await lock.query('begin'); await lock.query(`select id from public.${entity} where id=$1 for update`, [id]);
      await expect(mediaWrite(f.owner, f, f.variantId, [f.imageIds[0]!], version)).rejects.toMatchObject({ code: '55P03' });
    } finally { await lock.query('rollback'); lock.release(); }
    expect(await protectedState(f)).toEqual(before); expect(await metadataState(f)).toEqual(state);
  });
}

it('SQL and TypeScript recognize the same whitespace and ambiguous explicit color options',async()=>{
  const cases: Record<string,string>[] = [{ '\tColor\t':'Rojo'},{'\u00a0color\ufeff':'Azul'},{Color:'\t'},{Color:'\u00a0'},{Color:'Rojo',color:' Rojo '}];
  for(const options of cases){
    const sql=(await asUser(null,q=>q('select public._catalog_option_color($1::jsonb) color',[JSON.stringify(options)])))[0].color;
    const core=productColorSummaries([{id:'variant',options,price_usd:25,stock:1,active:true}])[0]?.value??null;
    expect(core).toBe(sql);
  }
});
