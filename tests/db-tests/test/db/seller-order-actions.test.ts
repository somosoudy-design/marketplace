import { afterAll, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, ledgerBalanced, pool } from '../../src/db';
afterAll(()=>pool.end());
async function fixture(paid=false,kind:'seller'|'platform'='seller'){
 const owner=await createUser('delivery-owner');const buyer=await createUser('delivery-buyer');const reviewer=await createUser('delivery-admin',{role:'admin'});
 const f=await createStoreWithProduct({owner:owner.id,kind,origin:kind==='platform'?'import':'seller',price:40});const order=await buy(buyer.id,f.variantId,1);const [delivery]=await admin('select * from public.fulfillments where order_id=$1',[order.order_id]);
 if(paid){const [{q}]=await asUser(buyer.id,(sql)=>sql("select public.create_payment_quote($1,'zelle') q",[order.order_id]));const [{p}]=await asUser(buyer.id,(sql)=>sql("select public.submit_payment($1,$2,$3,'{}',$4) p",[q.id,key('ref'),`${buyer.id}/local-proof.webp`,key('pay')]));await asUser(reviewer.id,(sql)=>sql('select public.review_payment($1,true)',[p.id]));}
 return {...f,owner,buyer,reviewer,order,delivery};
}
const detail=(by:string|null,store:string,id:string)=>asUser(by,async(sql)=>(await sql('select public.seller_fulfillment_detail($1,$2) d',[store,id]))[0].d);
const advance=(by:string,id:string,step:string,tracking:string|null=null)=>asUser(by,(sql)=>sql('select public.advance_fulfillment($1,$2,$3,$4,$5)',[id,step,'Nota local',tracking,tracking?'MRW':null]));
it('scoped detail returns only own lines/address/history; foreign store, buyer and anon denied',async()=>{
 const a=await fixture();const b=await fixture();const row=await detail(a.owner.id,a.storeId,a.delivery.id);expect(row).toMatchObject({id:a.delivery.id,store_id:a.storeId,payment_level:'none',order_number:a.order.number});expect(row.items).toHaveLength(1);expect(row.fulfillment_events).toHaveLength(1);
 expect(await detail(a.owner.id,a.storeId,b.delivery.id)).toBeNull();for(const by of [a.buyer.id,b.owner.id,null])await expect(detail(by,a.storeId,a.delivery.id)).rejects.toMatchObject({code:'42501'});
 await expect(advance(b.owner.id,a.delivery.id,'preparing')).rejects.toMatchObject({code:'P0002'});
});
it('unpaid and admin-only transitions remain blocked by actual server procedures',async()=>{
 const a=await fixture();await expectHint(advance(a.owner.id,a.delivery.id,'preparing'),'payment_required');await expect(advance(a.owner.id,a.delivery.id,'cancelled')).rejects.toMatchObject({code:'42501'});
 const imported=await fixture(true,'platform');await expectHint(advance(imported.owner.id,imported.delivery.id,'purchased'),'step_not_allowed');
 expect((await admin('select paid_usd,payment_status from public.orders where id=$1',[a.order.order_id]))[0]).toMatchObject({paid_usd:'0.00',payment_status:'unpaid'});
 await expect(asUser(a.owner.id,(sql)=>sql('update public.orders set paid_usd=total_usd where id=$1',[a.order.order_id]))).rejects.toMatchObject({code:'42501'});
});
it('paid preparation, home dispatch guide and terminal delivery persist history; concurrent duplicate rejected',async()=>{
 const a=await fixture(true);await advance(a.owner.id,a.delivery.id,'preparing');
 // Isolated LOCAL fixture selects a real home method; no app/remote data is touched.
 await admin("update public.fulfillments set shipping_kind='home_delivery' where id=$1",[a.delivery.id]);
 await expectHint(advance(a.owner.id,a.delivery.id,'dispatched'),'tracking_required');
 const results=await Promise.allSettled([advance(a.owner.id,a.delivery.id,'dispatched','GUIA-LOCAL'),advance(a.owner.id,a.delivery.id,'dispatched','GUIA-LOCAL')]);expect(results.filter((r)=>r.status==='fulfilled')).toHaveLength(1);
 const row=await detail(a.owner.id,a.storeId,a.delivery.id);expect(row).toMatchObject({status:'dispatched',tracking_number:'GUIA-LOCAL',carrier_name:'MRW'});expect(row.fulfillment_events.filter((e:{step_code:string})=>e.step_code==='dispatched')).toHaveLength(1);
 await advance(a.owner.id,a.delivery.id,'delivered');await expectHint(advance(a.owner.id,a.delivery.id,'in_transit'),'invalid_transition');expect(await ledgerBalanced(a.order.order_id)).toBe(true);
 await admin("update public.fulfillments set created_at=now()-interval '181 days' where id=$1",[a.delivery.id]);expect((await detail(a.owner.id,a.storeId,a.delivery.id)).status).toBe('delivered');
});
