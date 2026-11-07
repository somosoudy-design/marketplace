import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { captureActorApi } from '@/lib/actor-api';
import { guestCart, type GuestLine } from '@/lib/guest-cart';
import { intentKey } from '@/lib/ids';
import { Banner } from '../ui/States';
import { Button } from '../ui/Button';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Text } from '../ui/Text';

export function PendingCartMerge() {
  const { user, cartSyncing, cartSyncError, retryCartSync } = useAuth();
  const qc=useQueryClient();const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [remove,setRemove]=useState<GuestLine|null>(null);
  const pending=useQuery({queryKey:['pending-guest-merge',user?.id,cartSyncError],queryFn:()=>guestCart.pendingMerge(user!.id),enabled:!!user&&!!cartSyncError});
  if(!cartSyncError)return null;
  const reconcilePending=async(variantId?:string)=>{
    if(!user||!pending.data||busy)return;
    const reserved=pending.data;setBusy(true);setError(null);
    try{
      const bound=await captureActorApi(user.id);await bound.assertCurrent();
      const result=await bound.api.cart.cancelIntent({operation:'merge',payload:reserved.lines.map(line=>({variant_id:line.variant_id,quantity:line.quantity}))},reserved.key);
      await bound.assertCurrent();
      if(result.state==='completed')await guestCart.completeMerge(reserved);
      else await guestCart.replaceCancelledMerge(reserved,reserved.lines.filter(line=>line.variant_id!==variantId).map(line=>line.variant_id),()=>intentKey('merge'),result);
      await bound.assertCurrent();await qc.invalidateQueries({queryKey:['cart']});await pending.refetch();setRemove(null);retryCartSync();
    }catch(e){setError((e as Error).message||'No pudimos comprobar el cambio. Tus productos siguen guardados.');}
    finally{setBusy(false);}
  };
  return <View testID="cart-sync-pending" style={{gap:10,marginTop:12}}>
    <Banner tone="warning" title="Productos por incorporar" body={cartSyncError} />
    {pending.data?.lines.map(line=><View key={line.variant_id} style={{gap:4}}><Text variant="bodySmall">{line.title}{line.variant_title?` · ${line.variant_title}`:''} · {line.quantity}</Text><Button testID={`cart-sync-remove-${line.variant_id}`} title="Quitar de estos productos" variant="ghost" disabled={busy||cartSyncing} onPress={()=>setRemove(line)}/></View>)}
    {error?<Banner tone="danger" body={error}/>:null}
    <Button testID="cart-sync-retry" title="Reintentar incorporación" variant="secondary" disabled={busy||cartSyncing||pending.isFetching} onPress={()=>pending.data?void reconcilePending():retryCartSync()}/>
    <ConfirmSheet visible={!!remove} title="¿Quitar este producto?" body="Primero comprobaremos la operación anterior. Si ya se incorporó, actualizaremos tu carrito para que puedas revisar su cantidad." confirm="Quitar" loading={busy} error={error} onConfirm={()=>void reconcilePending(remove?.variant_id)} onClose={()=>!busy&&setRemove(null)}/>
  </View>;
}
