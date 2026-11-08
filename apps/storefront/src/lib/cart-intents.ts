'use client';
import { canonicalIntentPayload, createPersistentIntentStore, PendingIntentError } from '@kora/core';
import { captureBuyerApi } from './actor-api';
let intents: ReturnType<typeof createPersistentIntentStore>|undefined;
const inFlight=new Map<string,{payload:string;promise:Promise<void>}>();
export function addReviewedCart(buyerId:string,variantId:string,quantity:number,refresh:()=>Promise<unknown>):Promise<void>{
  const slot=JSON.stringify([buyerId,variantId]);const payload=canonicalIntentPayload({variantId,quantity});const old=inFlight.get(slot);
  if(old)return old.payload===payload?old.promise:Promise.reject(new Error('Comprueba la incorporación anterior antes de cambiar la cantidad.'));
  const run=async()=>{
    if(!navigator.locks)throw new Error('Este navegador no puede coordinar el carrito entre pestañas. Usa un navegador actualizado.');
    return navigator.locks.request('mayami.cart.add:'+slot,{ifAvailable:true},async lock=>{
      if(!lock)throw new Error('Hay una incorporación en curso en otra pestaña. Espera a comprobarla.');
      const bound=await captureBuyerApi(buyerId);
      intents??=createPersistentIntentStore(window.localStorage,()=>crypto.randomUUID());
      const scope={actorId:buyerId,operation:'cart.add',slot:variantId};const prior=await intents.read(scope);
      let intent;
      try{intent=await intents.prepare(scope,{variantId,quantity});}
      catch(error){if(error instanceof PendingIntentError){const original=JSON.parse(error.pending.payloadJson) as {quantity:number};throw new Error(`Hay una incorporación de ${original.quantity} unidades pendiente. Vuelve a esa cantidad para comprobar su resultado.`);}throw error;}
      await bound.assertCurrent();
      try{await bound.api.cart.addWithIntent(variantId,quantity,intent.key);}
      catch(error){if(!prior&&['unavailable','sold_out','invalid_input','rate_limited'].includes((error as {code?:string}).code??'')){await bound.assertCurrent();await intents.complete(intent);}throw error;}
      await bound.assertCurrent();await refresh();await bound.assertCurrent();await intents.complete(intent);
    });
  };
  const promise=run().finally(()=>{if(inFlight.get(slot)?.promise===promise)inFlight.delete(slot);});inFlight.set(slot,{payload,promise});return promise;
}
