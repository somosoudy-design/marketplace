import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, buy, createStoreWithProduct, createUser, expectHint, key, pool } from '../../src/db';
const target=new URL(process.env.TEST_DATABASE_URL??'invalid:');
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||!target.pathname.startsWith('/mayami_functional_'))throw new Error('Use only the explicit isolated local mayami_functional_* clone');
afterAll(()=>pool.end());
type Payer={name?:string;bank?:string;phone?:string;paid_at?:string};
type Input={reference:string|null;proof:string|null;payer:Payer};
const send=(actor:string,quote:string,intent:string,input:Input)=>asUser(actor,async sql=>(await sql('select public.submit_payment($1,$2,$3,$4::jsonb,$5) result',[quote,input.reference,input.proof,JSON.stringify(input.payer),intent]))[0].result);
const snapshot=(id:string)=>admin('select to_jsonb(p) value from public.payments p where id=$1',[id]);
async function fixture(label:string){
  const buyer=await createUser('payment-bind-'+label);const product=await createStoreWithProduct({kind:'platform',price:25,stock:10});
  const method='bind_'+randomUUID().slice(0,8);
  await admin("insert into public.payment_methods(code,name,rail,currency,kind,enabled,requires_reference,requires_proof,price_basis) values($1,'Local request binding','zelle','USD','manual',true,false,false,'bcv')",[method]);
  const createQuote=async()=>{const order=await buy(buyer.id,product.variantId,1);const [row]=await asUser(buyer.id,sql=>sql('select public.create_payment_quote($1,$2) result',[order.order_id,method]));return {id:row.result.id as string,order:order.order_id};};
  return {buyer,product,method,quote:await createQuote(),createQuote};
}
describe('manual payment intent binding — isolated local DB',()=>{
  it('preserves exact/normalised retries and does not modify the recorded report',async()=>{
    const f=await fixture('normalised');const intent=key('bind');
    const input={reference:'  LOCAL-'+randomUUID()+'  ',proof:`${f.buyer.id}/proof.webp`,payer:{name:'Persona fixture',bank:'Banco fixture',phone:'00000000',paid_at:'2026-11-07T01:00:00-04:00'}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);const before=await snapshot(first.id);
    expect(first.intent_request_hash).toMatch(/^[a-f0-9]{64}$/);
    const replay=await send(f.buyer.id,f.quote.id,intent,{...input,reference:input.reference.trim(),payer:{...input.payer,paid_at:'2026-11-07T05:00:00Z'}});
    expect(replay).toMatchObject({id:first.id,replayed:true,status:'pending_verification'});expect(await snapshot(first.id)).toEqual(before);
    expect((await admin('select paid_usd from public.orders where id=$1',[f.quote.order]))[0].paid_usd).toBe('0.00');
  });
  it('a key for another quote rejects instead of returning the earlier order payment',async()=>{
    const f=await fixture('other-quote');const intent=key('bind-quote');const input={reference:null,proof:null,payer:{}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);const second=await f.createQuote();
    await expectHint(send(f.buyer.id,second.id,intent,input),'idempotency_conflict');
    expect((await admin('select count(*)::int n from public.payments where buyer_id=$1',[f.buyer.id]))[0].n).toBe(1);
    expect((await admin('select status from public.payment_quotes where id=$1',[second.id]))[0].status).toBe('open');
    expect((await snapshot(first.id))[0].value.quote_id).toBe(f.quote.id);
  });
  it('changed reference, proof, payer fields or explicit paid_at conflict without rewriting history',async()=>{
    const f=await fixture('changed');const intent=key('bind-fields');
    const input={reference:'LOCAL-'+randomUUID(),proof:`${f.buyer.id}/proof.webp`,payer:{name:'Persona fixture',bank:'Banco fixture',phone:'00000000',paid_at:'2026-11-07T05:00:00Z'}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);const before=await snapshot(first.id);
    const changed:Input[]=[{...input,reference:'OTHER-'+randomUUID()},{...input,proof:`${f.buyer.id}/another.webp`},...(['name','bank','phone','paid_at'] as const).map(field=>({...input,payer:{...input.payer,[field]:field==='paid_at'?'2026-11-07T05:01:00Z':'Valor distinto'}}))];
    for(const candidate of changed)await expectHint(send(f.buyer.id,f.quote.id,intent,candidate),'idempotency_conflict');
    expect(await snapshot(first.id)).toEqual(before);
  });
  it('omitted automatic paid_at stays omitted in the new intent identity',async()=>{
    const f=await fixture('automatic-date');const intent=key('bind-date');const input={reference:null,proof:null,payer:{}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);
    expect((await send(f.buyer.id,f.quote.id,intent,input)).id).toBe(first.id);
    await expectHint(send(f.buyer.id,f.quote.id,intent,{...input,payer:{paid_at:first.declared_paid_at}}),'idempotency_conflict');
  });
  it('legacy rows have no backfill and recover original retries while rejecting recoverably different input',async()=>{
    const f=await fixture('legacy');const intent=key('bind-legacy');const input={reference:'LOCAL-'+randomUUID(),proof:null,payer:{name:'Persona fixture'}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);
    await admin('update public.payments set intent_request_hash=null where id=$1',[first.id]);const before=await snapshot(first.id);
    expect((await send(f.buyer.id,f.quote.id,intent,input)).id).toBe(first.id);
    await expectHint(send(f.buyer.id,f.quote.id,intent,{...input,payer:{name:'Otra persona'}}),'idempotency_conflict');
    const second=await f.createQuote();await expectHint(send(f.buyer.id,second.id,intent,input),'idempotency_conflict');
    expect(await snapshot(first.id)).toEqual(before);expect((await snapshot(first.id))[0].value.intent_request_hash).toBeNull();
  });
  it('reports remain recoverable after method disablement and cannot leak to another actor',async()=>{
    const f=await fixture('disabled');const intent=key('bind-disabled');const input={reference:null,proof:null,payer:{}};
    const first=await send(f.buyer.id,f.quote.id,intent,input);await admin('update public.payment_methods set enabled=false where code=$1',[f.method]);
    expect((await send(f.buyer.id,f.quote.id,intent,input)).id).toBe(first.id);
    const other=await createUser('bind-other');await expect(send(other.id,f.quote.id,intent,input)).rejects.toMatchObject({code:'P0002'});
    expect((await admin('select count(*)::int n from public.payments where buyer_id=$1',[other.id]))[0].n).toBe(0);
  });
});
