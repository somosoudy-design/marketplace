import { expect, it } from 'vitest';
import { createGuestCart, type GuestLine } from '../../apps/mobile/src/lib/guest-cart-state';
const line = (id: string): GuestLine => ({ variant_id:id,product_id:`p-${id}`,quantity:1,title:id,variant_title:null,image_path:null,price_usd:10,availability:'available' });
const storageFor = () => { const values=new Map<string,string>();return {values,storage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}}}; };
it('replaces only a server-cancelled reservation, preserving new guest lines across restart', async()=>{
  const {storage}=storageFor(),cart=createGuestCart(storage);await cart.add(line('a'));await cart.add(line('b'));
  const old=(await cart.reserveMerge('actor-a',()=> 'original-intent'))!;await cart.add(line('new'));
  await expect(cart.replaceCancelledMerge(old,['a'],()=> 'replacement-intent',{state:'completed',operation:'merge'})).rejects.toThrow();
  const next=await cart.replaceCancelledMerge(old,['a'],()=> 'replacement-intent',{state:'cancelled',operation:'merge'});
  const restart=createGuestCart(storage);expect(await restart.pendingMerge('actor-a')).toEqual(next);expect(await restart.read()).toEqual([line('new')]);
  expect(await restart.pendingMerge('actor-b')).toBeNull();
  await expect(restart.reserveMerge('actor-b',()=> 'another-buyer-intent')).rejects.toMatchObject({code:'foreign_guest_merge'});
  expect(await restart.pendingMerge('actor-a')).toEqual(next);
  await expect(restart.replaceCancelledMerge(old,[],()=> 'third-intent',{state:'cancelled',operation:'merge'})).rejects.toThrow();
});
it('preserves the pending operation when replacement storage fails',async()=>{
  const {storage}=storageFor();let fail=false;const guarded={...storage,setItem:(key:string,value:string)=>{if(fail)throw new Error('disk');storage.setItem(key,value);}};
  const cart=createGuestCart(guarded);await cart.add(line('a'));const old=(await cart.reserveMerge('actor-a',()=> 'original-intent'))!;fail=true;
  await expect(cart.replaceCancelledMerge(old,['a'],()=> 'replacement-intent',{state:'cancelled',operation:'merge'})).rejects.toThrow('disk');
  expect(await cart.pendingMerge('actor-a')).toEqual(old);
});
it('does not permit replacing a reservation with foreign or duplicated lines',async()=>{
  const {storage}=storageFor(),cart=createGuestCart(storage);await cart.add(line('a'));const old=(await cart.reserveMerge('actor-a',()=> 'original-intent'))!;
  for(const ids of [['foreign'],['a','a']])await expect(cart.replaceCancelledMerge(old,ids,()=> 'replacement-intent',{state:'cancelled',operation:'merge'})).rejects.toThrow();
  expect(await cart.pendingMerge('actor-a')).toEqual(old);
});
