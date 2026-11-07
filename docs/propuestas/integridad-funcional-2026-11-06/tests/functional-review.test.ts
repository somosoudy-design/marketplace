import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, pool } from '../../src/db';
// Fail closed before any fixture query: these proposals may only write the explicitly isolated clone.
const isolatedTarget = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['localhost','127.0.0.1','[::1]'].includes(isolatedTarget.hostname) ||
    !isolatedTarget.pathname.startsWith('/mayami_functional_')) {
  throw new Error('Set TEST_DATABASE_URL to the authorized local mayami_functional_* clone. No shared or remote database is allowed.');
}

afterAll(() => pool.end());
const send = (buyer: string, quote: string, intent: string, label?: string) => asUser(buyer, async sql => {
  if (label) await sql("select set_config('application_name',$1,true)", [label]);
  return (await sql("select public.submit_payment($1,null,null,'{}',$2) result", [quote,intent]))[0].result;
});
async function payable() {
  const buyer = await createUser('functional-payer'); const p = await createStoreWithProduct({kind:'platform',price:25});
  const o = await buy(buyer.id,p.variantId,1); const method='audit_'+randomUUID().slice(0,8);
  await admin("insert into public.payment_methods(code,name,rail,currency,kind,enabled,requires_reference,requires_proof,price_basis) values($1,'Local review','zelle','USD','manual',true,false,false,'bcv')",[method]);
  const [r] = await asUser(buyer.id,sql=>sql('select public.create_payment_quote($1,$2) result',[o.order_id,method]));
  return {buyer:buyer.id,quote:r.result.id as string,order:o.order_id,method};
}
it('public event RPC cannot fabricate a purchase signal',async()=>{
  const u=await createUser('event-forgery');const p=await createStoreWithProduct();
  await expectHint(asUser(u.id,sql=>sql("select public.track_event('purchase',$1)",[p.productId])),'forbidden');
  expect((await admin("select count(*)::int n from public.user_events where user_id=$1 and kind='purchase'",[u.id]))[0].n).toBe(0);
});
it('direct authenticated INSERT cannot bypass purchase provenance',async()=>{
  const u=await createUser('event-direct');const p=await createStoreWithProduct();
  await expect(asUser(u.id,sql=>sql("insert into public.user_events(user_id,kind,product_id) values($1,'purchase',$2)",[u.id,p.productId]))).rejects.toMatchObject({code:'42501'});
});
it('view events remain available and respect the existing personalisation preference',async()=>{
  const u=await createUser('event-view');const p=await createStoreWithProduct();
  await asUser(u.id,sql=>sql("select public.track_event('view',$1)",[p.productId]));
  expect((await admin("select count(*)::int n from public.user_events where user_id=$1",[u.id]))[0].n).toBe(1);
  await asUser(u.id,sql=>sql('update public.profiles set personalization_enabled=false where id=auth.uid()'));
  await asUser(u.id,sql=>sql("select public.track_event('view',$1)",[p.productId]));
  expect((await admin("select count(*)::int n from public.user_events where user_id=$1",[u.id]))[0].n).toBe(1);
});
it('a trusted order keeps its history but does not append personalisation events after opt-out',async()=>{
  const u=await createUser('purchase-private');const p=await createStoreWithProduct({kind:'platform'});
  await asUser(u.id,sql=>sql('update public.profiles set personalization_enabled=false where id=auth.uid()'));
  const o=await buy(u.id,p.variantId,1);
  expect((await admin('select buyer_id from public.orders where id=$1',[o.order_id]))[0].buyer_id).toBe(u.id);
  expect((await admin("select count(*)::int n from public.user_events where user_id=$1 and kind='purchase'",[u.id]))[0].n).toBe(0);
});
it('two concurrent retries of one payment intent both recover the exact stored report',async()=>{
  const p=await payable();const intent=key('same-payment');const label='functional-'+randomUUID();const barrier=await pool.connect();
  let joined: Promise<any[]>|undefined;
  try {
    await barrier.query('begin');await barrier.query('select id from public.payment_quotes where id=$1 for update',[p.quote]);
    joined=Promise.all([send(p.buyer,p.quote,intent,label),send(p.buyer,p.quote,intent,label)]);void joined.catch(()=>{});
    let waiting=0;
    for(let n=0;n<100;n++){
      const [r]=await admin("select count(*)::int n from pg_stat_activity where application_name=$1 and wait_event_type='Lock'",[label]);
      waiting=r.n;if(waiting===2)break;await new Promise(r=>setTimeout(r,10));
    }
    expect(waiting).toBe(2);
    await barrier.query('commit');
    const [a,b]=await joined;expect(a.id).toBe(b.id);expect([a.replayed,b.replayed].sort()).toEqual([false,true]);
    expect((await admin('select count(*)::int n from public.payments where order_id=$1',[p.order]))[0].n).toBe(1);
  }finally {await barrier.query('rollback');barrier.release();if(joined)await joined.catch(()=>{});}
});
it('disabling a method blocks new reports without cancelling an existing report or losing its replay',async()=>{
  const p=await payable();const intent=key('report');const first=await send(p.buyer,p.quote,intent);
  await admin('update public.payment_methods set enabled=false where code=$1',[p.method]);
  const replay=await send(p.buyer,p.quote,intent);expect(replay.id).toBe(first.id);expect(replay.replayed).toBe(true);
  expect((await admin('select status from public.payments where id=$1',[first.id]))[0].status).toBe('pending_verification');
  const fresh=await payable();await admin('update public.payment_methods set enabled=false where code=$1',[fresh.method]);
  await expectHint(send(fresh.buyer,fresh.quote,key('new-disabled')),'method_unavailable');
  expect((await admin('select count(*)::int n from public.payments where order_id=$1',[fresh.order]))[0].n).toBe(0);
});
it('changing the note on an unchanged moderation state preserves the earlier actor and event',async()=>{
  const a=await createUser('moderator-a',{role:'admin'});const b=await createUser('moderator-b',{role:'admin'});const p=await createStoreWithProduct();
  const moderate=(actor:string,note:string)=>asUser(actor,sql=>sql("select public.moderate_product($1,'suspended',$2)",[p.productId,note]));
  await moderate(a.id,'Motivo A');const [first]=await admin('select * from public.moderation_events where product_id=$1 order by id desc limit 1',[p.productId]);
  await moderate(b.id,'Motivo B');const events=await admin('select * from public.moderation_events where product_id=$1 and id >= $2 order by id',[p.productId,first.id]);
  expect(events[0]).toEqual(first);expect(events).toHaveLength(2);expect(events[1]).toMatchObject({actor_id:b.id,note:'Motivo B',from_status:'suspended',to_status:'suspended'});
  await moderate(b.id,'Motivo B');expect((await admin('select count(*)::int n from public.moderation_events where product_id=$1 and id >= $2',[p.productId,first.id]))[0].n).toBe(2);
});
