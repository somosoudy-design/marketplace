import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { admin, asUser, createStoreWithProduct, createUser, pool, setRate } from '../../src/db';
afterAll(() => pool.end());
it('editing a rejected low-risk product and its variant cannot approve the product', async () => {
  const owner = await createUser('rejected-editor'); const f = await createStoreWithProduct({ owner: owner.id });
  await admin("update public.products set moderation_status='rejected', moderation_note='Corregir características' where id=$1", [f.productId]);
  await asUser(owner.id, async (sql) => {
    await sql("update public.products set title='Ficha corregida' where id=$1", [f.productId]);
    await sql('update public.product_variants set price_usd=30 where id=$1', [f.variantId]);
  });
  expect((await admin('select moderation_status from public.products where id=$1', [f.productId]))[0].moderation_status).toBe('pending');
});

const fields = (category: string, title='Producto móvil') => ({ title,subtitle:null,description:'Descripción local',highlights:['Detalle real'],category_id:category,availability:'available',compare_at_usd:null,weight_kg:0.5,max_per_order:10 });
const variants = (id: string=randomUUID(), stock=8, price=20) => [{ id,title:'Única',sku:null,price_usd:price,stock,active:true,sort:0 }];
const save = (user: string | null, store: string, id: string, f: object, v: object[], images: object[]=[]) => asUser(user, (sql)=>sql('select public.seller_save_product($1,$2,$3,$4,$5)', [store,id,f,JSON.stringify(v),JSON.stringify(images)]));
it('atomic create, repeat the same intent, price and stock persistence, pause and moderation', async()=>{
  const owner=await createUser('product-create'); const f=await createStoreWithProduct({owner:owner.id}); const id=randomUUID(); const v=variants();
  await save(owner.id,f.storeId,id,fields(f.categoryId),v); await save(owner.id,f.storeId,id,fields(f.categoryId),v);
  expect((await admin('select count(*)::int n from public.product_variants where product_id=$1',[id]))[0].n).toBe(1);
  expect((await admin('select base_price_usd,moderation_status from public.products where id=$1',[id]))[0]).toMatchObject({base_price_usd:'20.00',moderation_status:'published'});
  await save(owner.id,f.storeId,id,{...fields(f.categoryId),availability:'unavailable'},[{...v[0],price_usd:24,stock:3}]);
  expect((await admin('select base_price_usd,availability from public.products where id=$1',[id]))[0]).toMatchObject({base_price_usd:'24.00',availability:'unavailable'});
  const [cat]=await admin("select id from public.categories where requires_review or risk_level<>'low' limit 1");
  await save(owner.id,f.storeId,id,{...fields(cat.id),moderation_status:'published'},v);
  expect((await admin('select moderation_status from public.products where id=$1',[id]))[0].moderation_status).toBe('pending');
  await admin("update public.products set moderation_status='suspended',moderation_note='Suspensión' where id=$1",[id]);
  await save(owner.id,f.storeId,id,fields(f.categoryId),v);
  expect((await admin('select moderation_status from public.products where id=$1',[id]))[0].moderation_status).toBe('suspended');
});
it('invalid second variant rolls back the whole create and existing product edit',async()=>{
  const owner=await createUser('product-rollback'); const f=await createStoreWithProduct({owner:owner.id}); const id=randomUUID();
  await expect(save(owner.id,f.storeId,id,fields(f.categoryId),[...variants(),...variants(randomUUID(),-1)])).rejects.toMatchObject({code:'23514'});
  expect(await admin('select id from public.products where id=$1',[id])).toEqual([]);
  const [before]=await admin('select title from public.products where id=$1',[f.productId]);
  await expect(save(owner.id,f.storeId,f.productId,fields(f.categoryId,'Título que debe revertirse'),variants(f.variantId,-1))).rejects.toMatchObject({code:'23514'});
  expect((await admin('select title from public.products where id=$1',[f.productId]))[0].title).toBe(before.title);
});
it('foreign seller, guest, foreign variants and image paths cannot mutate another catalogue',async()=>{
  const a=await createUser('product-owner');const b=await createUser('product-foreign');const f=await createStoreWithProduct({owner:a.id});const other=await createStoreWithProduct({owner:b.id});
  await expect(save(b.id,f.storeId,f.productId,fields(f.categoryId),variants(f.variantId))).rejects.toMatchObject({code:'42501'});
  await expect(save(null,f.storeId,f.productId,fields(f.categoryId),variants(f.variantId))).rejects.toMatchObject({code:'42501'});
  await expect(save(a.id,f.storeId,other.productId,fields(f.categoryId),variants(other.variantId))).rejects.toMatchObject({code:'P0002'});
  await expect(save(a.id,f.storeId,f.productId,fields(f.categoryId),variants(other.variantId))).rejects.toMatchObject({code:'22023'});
  await expect(save(a.id,f.storeId,f.productId,fields(f.categoryId),variants(f.variantId),[{id:randomUUID(),path:`${other.storeId}/${other.productId}/foto.jpg`,sort:0}])).rejects.toMatchObject({code:'42501'});
  expect((await admin('select title,stock from public.product_variants where id=$1',[other.variantId]))[0]).toMatchObject({title:'Única',stock:5});
});
it('manual review remains pending through cost repricing and approval requires actual admin',async()=>{
  const owner=await createUser('product-review');const manager=await createUser('product-admin',{role:'admin'});const f=await createStoreWithProduct({owner:owner.id});
  await asUser(manager.id,(sql)=>sql("select public.moderate_product($1,'rejected','Corregir ficha')",[f.productId]));
  await save(owner.id,f.storeId,f.productId,fields(f.categoryId),variants(f.variantId));
  await asUser(owner.id,(sql)=>sql("select public.set_product_costs($1,'{\"source\":\"propio\",\"auto_price\":true}',$2)",[f.productId,JSON.stringify([{variant_id:f.variantId,cost_usd:10}])]));
  expect((await admin('select moderation_status from public.products where id=$1',[f.productId]))[0].moderation_status).toBe('pending');
  await expect(asUser(owner.id,(sql)=>sql("select public.moderate_product($1,'published')",[f.productId]))).rejects.toMatchObject({code:'42501'});
  await asUser(manager.id,(sql)=>sql("select public.moderate_product($1,'published')",[f.productId]));
  expect((await admin('select moderation_status from public.products where id=$1',[f.productId]))[0].moderation_status).toBe('published');
  const [v]=await admin('select price_usd from public.product_variants where id=$1',[f.variantId]);
  await expect(save(owner.id,f.storeId,f.productId,fields(f.categoryId),variants(f.variantId,5,Number(v.price_usd)+1))).rejects.toMatchObject({code:'22023'});
});

it('atomic save delegates automatic repricing to the existing cost RPC with a current local snapshot',async()=>{
  const owner=await createUser('product-auto');const adm=await createUser('product-auto-admin',{role:'admin'});const f=await createStoreWithProduct({owner:owner.id});
  await setRate('USD/VES',875.65);await setRate('USDT/VES',1014.93);await setRate('USD/USDT',1.0009);
  await asUser(adm.id,(sql)=>sql("select public.take_pricing_snapshot('Prueba local de editor')"));
  const [result]=await asUser(owner.id,(sql)=>sql("select public.seller_save_product($1,$2,$3,$4,'[]',$5,$6)",[f.storeId,f.productId,fields(f.categoryId),JSON.stringify(variants(f.variantId)),{source:'propio',auto_price:true,freight_usd:2,logistics_usd:1,margin_pct:20},JSON.stringify([{variant_id:f.variantId,cost_usd:8}])]));
  expect(result.seller_save_product).toBe(f.productId);
  const [{pricing}]=await asUser(owner.id,(sql)=>sql('select public.product_pricing($1) pricing',[f.productId]));
  const [v]=await admin('select price_usd from public.product_variants where id=$1',[f.variantId]);
  expect(Number(v.price_usd)).toBe(Number(pricing.variants[0].breakdown.price_usd));expect(Number(v.price_usd)).not.toBe(20);
  // Retain the additive snapshot, but expire it so later local suites do not use a test rate accidentally.
  await admin("update public.pricing_snapshots set taken_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where id=$1",[pricing.snapshot.id]);
});
