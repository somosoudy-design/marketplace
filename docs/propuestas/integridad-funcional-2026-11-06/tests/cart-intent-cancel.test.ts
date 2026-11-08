import { afterAll, describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, key, pool } from '../../src/db';
const target=new URL(process.env.TEST_DATABASE_URL??'invalid:');
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||!target.pathname.startsWith('/mayami_functional_'))throw new Error('An explicit isolated local mayami_functional_* clone is required');
afterAll(()=>pool.end());
type Line={variant_id:string;quantity:number};
const add=(actor:string,variant:string,n:number,k:string)=>asUser(actor,async sql=>(await sql('select public.cart_add_intent($1,$2,$3) result',[variant,n,k]))[0].result);
const merge=(actor:string,lines:Line[],k:string)=>asUser(actor,async sql=>(await sql('select public.cart_merge_intent($1::jsonb,$2) result',[JSON.stringify(lines),k]))[0].result);
const cancel=(actor:string|null,operation:'add'|'merge',payload:Line|Line[],k:string)=>asUser(actor,async sql=>(await sql('select public.cart_cancel_intent($1,$2::jsonb,$3) result',[operation,JSON.stringify(payload),k]))[0].result);
const qty=async(actor:string,variant:string)=>(await admin('select quantity from public.cart_items where user_id=$1 and variant_id=$2',[actor,variant]))[0]?.quantity??0;

describe('terminal cancellation of cart intents — isolated clone only',()=>{
  it('an original add arriving after confirmed cancellation cannot write',async()=>{
    const a=await createUser('cancel-add');const f=await createStoreWithProduct({stock:10});const k=key('cancel-add');const payload={variant_id:f.variantId,quantity:2};
    expect(await cancel(a.id,'add',payload,k)).toMatchObject({state:'cancelled',operation:'add',replayed:false});
    await expectHint(add(a.id,f.variantId,2,k),'cart_intent_cancelled');expect(await qty(a.id,f.variantId)).toBe(0);
    expect(await cancel(a.id,'add',payload,k)).toMatchObject({state:'cancelled',replayed:true});
  });
  it('an invalid merge can be cancelled; becoming available later never revives its original key',async()=>{
    const a=await createUser('cancel-merge');const f=await createStoreWithProduct({stock:0});const k=key('cancel-merge');const payload=[{variant_id:f.variantId,quantity:2}];
    await expectHint(merge(a.id,payload,k),'sold_out');
    expect(await cancel(a.id,'merge',payload,k)).toMatchObject({state:'cancelled'});
    await admin('update public.product_variants set stock=10 where id=$1',[f.variantId]);
    await expectHint(merge(a.id,payload,k),'cart_intent_cancelled');expect(await qty(a.id,f.variantId)).toBe(0);
  });
  it('completed add cancellation returns its historical result and preserves a newer cart',async()=>{
    const a=await createUser('cancel-completed');const f=await createStoreWithProduct({stock:10});const k=key('cancel-completed');
    await add(a.id,f.variantId,1,k);
    await asUser(a.id,sql=>sql('select public.cart_set_quantity($1,5)',[f.variantId]));
    const result=await cancel(a.id,'add',{variant_id:f.variantId,quantity:1},k);
    expect(result).toMatchObject({state:'completed',operation:'add',result:{variant_id:f.variantId,quantity:1},replayed:true});
    expect(await qty(a.id,f.variantId)).toBe(5);
    expect(await add(a.id,f.variantId,1,k)).toMatchObject({replayed:true,quantity:1});expect(await qty(a.id,f.variantId)).toBe(5);
  });
  it('completed merge cancellation never reverses accepted lines',async()=>{
    const a=await createUser('cancel-merge-completed');const f=await createStoreWithProduct({stock:10});const k=key('cancel-merge-completed');const payload=[{variant_id:f.variantId,quantity:2}];
    await merge(a.id,payload,k);
    expect(await cancel(a.id,'merge',payload,k)).toMatchObject({state:'completed',operation:'merge',result:{accepted:1},replayed:true});expect(await qty(a.id,f.variantId)).toBe(2);
  });
  it('keys are bound to operation and normalised payload, including a replayed cancellation',async()=>{
    const a=await createUser('cancel-payload');const f=await createStoreWithProduct({stock:10});const k=key('cancel-payload');
    await cancel(a.id,'add',{variant_id:f.variantId.toUpperCase(),quantity:1},k);
    expect(await cancel(a.id,'add',{variant_id:f.variantId,quantity:1},k)).toMatchObject({state:'cancelled',replayed:true});
    await expectHint(cancel(a.id,'add',{variant_id:f.variantId,quantity:2},k),'idempotency_conflict');
    await expectHint(cancel(a.id,'merge',[{variant_id:f.variantId,quantity:1}],k),'idempotency_conflict');
    await expectHint(add(a.id,f.variantId,2,k),'idempotency_conflict');expect(await qty(a.id,f.variantId)).toBe(0);
  });
  it('actor B cannot cancel or reveal actor A intent; the same key is independent',async()=>{
    const a=await createUser('cancel-a'),b=await createUser('cancel-b');const f=await createStoreWithProduct({stock:10});const k=key('cancel-owner');const payload={variant_id:f.variantId,quantity:1};
    await add(a.id,f.variantId,1,k);
    expect(await cancel(b.id,'add',payload,k)).toEqual({state:'cancelled',operation:'add',replayed:false});
    expect(await qty(a.id,f.variantId)).toBe(1);expect(await qty(b.id,f.variantId)).toBe(0);
    expect(await cancel(a.id,'add',payload,k)).toMatchObject({state:'completed'});
    await expectHint(add(b.id,f.variantId,1,k),'cart_intent_cancelled');
    await expect(asUser(b.id,sql=>sql('select * from checkout_private.cart_intent_journal'))).rejects.toMatchObject({code:'42501'});
    await expect(cancel(null,'add',payload,k)).rejects.toMatchObject({code:'42501'});
  });
  it('cancellation holds the same buyer lock until commit so an already waiting original sees its tombstone',async()=>{
    const a=await createUser('cancel-wait');const f=await createStoreWithProduct({stock:10});const k=key('cancel-wait');const c=await pool.connect();
    let pending:Promise<{error?:unknown;result?:unknown}>|undefined;
    try{
      await c.query('begin');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:a.id,role:'authenticated'})]);await c.query('set local role authenticated');
      await c.query('select public.cart_cancel_intent($1,$2::jsonb,$3)',['add',JSON.stringify({variant_id:f.variantId,quantity:1}),k]);
      let started!:(pid:number)=>void;const announced=new Promise<number>(resolve=>{started=resolve;});
      pending=asUser(a.id,async sql=>{const [{pid}]=await sql('select pg_backend_pid()::int pid');started(pid);return sql('select public.cart_add_intent($1,1,$2)',[f.variantId,k]);}).then(result=>({result}),error=>({error}));
      const pid=await announced;const deadline=Date.now()+4000;let waiting=false;
      while(Date.now()<deadline){const [row]=await admin('select wait_event_type,wait_event from pg_stat_activity where pid=$1',[pid]);if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory'){waiting=true;break;}await delay(15);}
      expect(waiting).toBe(true);await c.query('commit');
    }finally{await c.query('rollback').catch(()=>undefined);c.release();}
    expect((await pending!).error).toMatchObject({hint:'cart_intent_cancelled'});expect(await qty(a.id,f.variantId)).toBe(0);
  });
});
