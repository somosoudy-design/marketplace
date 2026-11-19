import type { ProductPricing, SellerEditableProduct, SellerProductChanges, SellerProductReview } from '@kora/api';
import { MODERATION_LABEL, AVAILABILITY, type Availability } from '@kora/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SellerChoice } from '@/components/seller/SellerChoice';
import { CatalogAuthoring, type CatalogAuthoringState } from '@/components/seller/CatalogAuthoring';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { IMAGE_TYPES, imageBytes, pickSellerImage, type PickedImage } from '@/components/seller/SellerImage';
import { UnsavedChanges } from '@/components/seller/UnsavedChanges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { Banner, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { brand } from '@/lib/brand';
import { haptics } from '@/lib/haptics';
import { useCategories } from '@/lib/hooks';
import { useSeller } from '@/lib/seller';
import { api, apiForActor, catalogImage } from '@/lib/supabase';

export default function ProductScreen() { return <SellerScreen><LoadProduct /></SellerScreen>; }
function LoadProduct() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { store } = useSeller(); const { user } = useAuth();
  const ready = useQuery({ queryKey: ['seller-editor-ready', user!.id], queryFn: async()=>{const bound=await apiForActor(user!.id);const result=await bound.api.seller.editorReady();await bound.assertCurrent();return result;}, staleTime: 0, refetchOnMount: 'always' });
  const q = useQuery({ queryKey: ['seller-product', user!.id, store!.id, id], queryFn: async()=>{const bound=await apiForActor(user!.id);const row=await bound.api.seller.productReviewed(store!.id,id!);await bound.assertCurrent();return row;}, enabled: !!id && ready.data === true });
  if (ready.isPending || (id && ready.data && q.isPending)) return <SellerLoading />;
  if (ready.isError || (id && q.isError)) return <ErrorState error={ready.error ?? q.error} onRetry={() => { ready.refetch(); q.refetch(); }} />;
  if (!ready.data) return <SellerScroll><Banner tone="warning" body="La edición móvil aún no está habilitada. Puedes consultar el catálogo o usar el panel web." /><AdvancedPanel path="/vendedor/productos" /></SellerScroll>;
  if (id && !q.data) return <SellerScroll><Banner tone="warning" body="El producto ya no está disponible para editar. Vuelve al catálogo y actualiza la lista." /><AdvancedPanel path="/vendedor/productos" /></SellerScroll>;
  return <Editor key={`${user!.id}:${store!.id}:${id ?? 'new'}`} initialReview={q.data ?? null} />;
}
type VariantDraft = { id: string; title: string; sku: string; price: string; stock: string; active: boolean; cost: string };
type ImageDraft = { id: string; path?: string; picked?: PickedImage };
const decimal = (s: string) => s.trim().replace(',', '.');
const amount = /^\d{1,7}([.,]\d{1,2})?$/;
const choices = Object.keys(AVAILABILITY) as Availability[];
type Editable = SellerEditableProduct | SellerProductReview['product'];
type Pricing = ProductPricing | SellerProductReview['pricing'];
const fieldsFor = (p: Editable | null) => ({ title:p?.title??'',subtitle:p?.subtitle??'',description:p?.description??'',highlights:(p?.highlights??[]).join('\n'),category_id:p?.category_id??'',availability:p?.availability??'available',weight:String(p?.weight_kg??0.5),max:String(p?.max_per_order??10),compare:p?.compare_at_usd?String(p.compare_at_usd):'' });
const variantsFor = (p: Editable, pricing: Pricing | null): VariantDraft[] => [...p.product_variants].sort((a,b)=>a.sort-b.sort).map(v=>({id:v.id,title:v.title,sku:v.sku??'',price:String(v.price_usd),stock:v.stock==null?'':String(v.stock),active:v.active,cost:String(pricing?.variants.find(row=>row.variant_id===v.id)?.cost_usd??'')}));
const imagesFor = (p: Editable): ImageDraft[] => [...p.product_images].sort((a,b)=>a.sort-b.sort).map(i=>({id:i.id,path:i.path}));
const costsFor = (pricing: Pricing | null) => ({ freight:String(pricing?.costs?.freight_usd??''),logistics:String(pricing?.costs?.logistics_usd??''),margin:String(pricing?.costs?.margin_pct??'') });
type FieldsDraft = ReturnType<typeof fieldsFor>;
type CostsDraft = ReturnType<typeof costsFor>;
type PreservedDraft = { fields:FieldsDraft; variants:VariantDraft[]; images:ImageDraft[]; costs:CostsDraft; existingVariantIds:string[] };
const fieldLabels:Record<keyof FieldsDraft,string>={title:'Nombre',subtitle:'Subtítulo',description:'Descripción',highlights:'Características',category_id:'Categoría',availability:'Disponibilidad',weight:'Peso',max:'Máximo por pedido',compare:'Precio anterior'};
const variantLabels:Record<Exclude<keyof VariantDraft,'id'>,string>={title:'Nombre',sku:'SKU',price:'Precio USD',stock:'Inventario',active:'Estado',cost:'Costo USD'};
const showValue = (v:unknown) => typeof v==='boolean'?(v?'Activa':'Pausada'):String(v??'').trim()||'Vacío';
function Editor({ initialReview }: { initialReview:SellerProductReview|null }) {
  const { store }=useSeller();const { user }=useAuth();const s=store!;const qc=useQueryClient();const categories=useCategories();
  const [review,setReview]=useState(initialReview);const p=review?.product??null;const pricing=review?.pricing??null;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [id]=useState(()=>p?.id??Crypto.randomUUID());
  const [f,setF]=useState(()=>fieldsFor(p));
  const [variants,setVariants]=useState<VariantDraft[]>(()=>p?variantsFor(p,pricing):[{id:Crypto.randomUUID(),title:'Única',sku:'',price:'',stock:'',active:true,cost:''}]);
  const [images,setImages]=useState<ImageDraft[]>(()=>p?imagesFor(p):[]);
  const [costs,setCosts]=useState(()=>costsFor(pricing));const auto=pricing?.costs?.auto_price===true;
  const intent=useRef<{revision:string;payload:string;key:string}|null>(null);
  const [uncertain,setUncertain]=useState(false);const [needsReview,setNeedsReview]=useState(false);
  const [preserved,setPreserved]=useState<PreservedDraft[]>([]);const [discardDraft,setDiscardDraft]=useState<number|null>(null);
  const readCurrent=async(bound=api)=>{const next=await bound.seller.productReviewed(s.id,id);if(!next)throw new Error('El producto ya no está disponible para editar.');return next;};
  const applyCurrent=(next:SellerProductReview)=>{
    const nextF=fieldsFor(next.product),nextVariants=variantsFor(next.product,next.pricing),nextImages=imagesFor(next.product),nextCosts=costsFor(next.pricing);
    setReview(next);setF(nextF);setVariants(nextVariants);setImages(nextImages);setCosts(nextCosts);
    setBaseline(JSON.stringify({f:nextF,variants:nextVariants,images:nextImages.map(i=>({id:i.id,path:i.path,uri:undefined})),costs:nextCosts}));
    qc.setQueryData(['seller-product',user!.id,s.id,id],next);
  };
  const draft = JSON.stringify({ f, variants, images: images.map((i) => ({ id:i.id, path:i.path, uri:i.picked?.uri })), costs });
  const [baseline, setBaseline] = useState(draft); const dirty = draft !== baseline;
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogAuthoringState>({ dirty: false, busy: false, locked: false });
  const blocked = busy || uncertain || needsReview || catalogState.busy || catalogState.locked;
  const set = (key: keyof typeof f, value: string) => setF((old) => ({ ...old, [key]: value }));
  const variant = (index: number, patch: Partial<VariantDraft>) => setVariants((rows) => rows.map((v, i) => i===index ? { ...v, ...patch } : v));
  const validation = f.title.trim().length < 3 ? 'El nombre necesita al menos 3 caracteres.' : !f.category_id ? 'Elige una categoría.'
    : !variants.some((v) => v.active) ? 'Conserva al menos una variante activa. Para pausar el producto, elige «No disponible».'
    : variants.some((v) => !v.title.trim() || !amount.test(v.price.trim()) || Number(decimal(v.price)) <= 0 || (v.stock.trim() && !/^\d{1,6}$/.test(v.stock.trim()))) ? 'Cada variante necesita nombre, precio positivo con hasta dos decimales e inventario entero o vacío.'
    : !/^\d{1,3}([.,]\d{1,3})?$/.test(f.weight) || !/^\d{1,3}$/.test(f.max) || Number(f.max)<1 || Number(f.max)>100 ? 'Revisa el peso y el máximo por pedido (1 a 100).'
    : f.compare.trim() && (!amount.test(f.compare.trim()) || Number(decimal(f.compare)) <= Math.min(...variants.filter((v) => v.active).map((v) => Number(decimal(v.price))))) ? 'El precio anterior debe ser mayor que el actual.'
    : auto && (Object.values(costs).some((c) => c.trim() && !amount.test(c.trim())) || Number(decimal(costs.margin || '0'))>500 || variants.some((v) => v.cost.trim() && (!amount.test(v.cost.trim()) || Number(decimal(v.cost))<=0))) ? 'Revisa costos, flete, gastos y margen (máximo 500 %).' : null;
  const save = async () => {
    if (lock.current || catalogState.busy || catalogState.locked) return;
    if (validation) return setError(validation);
    lock.current = true; setBusy(true); setError(null);let writeConfirmed=false;
    try {
      const operation=await apiForActor(user!.id);const bound=operation.api;
      const assertCurrent=async()=>{await operation.assertCurrent();if(!mounted.current)throw new Error('El editor se cerró. Vuelve a abrirlo.');};
      await assertCurrent();
      const saveImages: ImageDraft[] = [];
      for (const img of images) {
        const picked = img.picked;
        if (!picked || picked.uploaded) { saveImages.push(img); continue; }
        const bytes = await imageBytes(picked);
        await assertCurrent();
        const uploaded = await bound.seller.uploadImage('catalog', `${s.id}/${id}/${img.id}.${IMAGE_TYPES[picked.type]}`, bytes, picked.type);
        await assertCurrent();
        const completedImage = { ...img, picked: { ...picked, uploaded } };
        saveImages.push(completedImage);
        // Retain each successful immutable upload even if a later photo or RPC fails.
        setImages(rows => rows.map(row => row.id === img.id && row.picked?.uri === picked.uri ? { ...row, picked: { ...picked, uploaded } } : row));
      }
      const fields={title:f.title.trim(),subtitle:f.subtitle.trim()||null,description:f.description.trim()||null,highlights:f.highlights.split('\n').map(h=>h.trim()).filter(Boolean).slice(0,6),category_id:f.category_id,availability:f.availability,weight_kg:Number(decimal(f.weight)),max_per_order:Number(f.max),compare_at_usd:f.compare.trim()?Number(decimal(f.compare)):null};
      const allVariants=variants.map((v,sort)=>({id:v.id,title:v.title.trim(),sku:v.sku.trim()||null,price_usd:Number(decimal(v.price)),stock:v.stock.trim()?Number(v.stock):null,active:v.active,sort}));
      if(review){
        const baseFields=fieldsFor(review.product);const changes:SellerProductChanges={fields:{},variants:[],images:[]};
        const fieldMap:Record<keyof FieldsDraft,keyof typeof fields>={title:'title',subtitle:'subtitle',description:'description',highlights:'highlights',category_id:'category_id',availability:'availability',weight:'weight_kg',max:'max_per_order',compare:'compare_at_usd'};
        for(const k of Object.keys(fieldMap) as (keyof FieldsDraft)[])if(f[k]!==baseFields[k])Object.assign(changes.fields!,{[fieldMap[k]]:fields[fieldMap[k]]});
        const baseVariants=variantsFor(review.product,review.pricing);
        for(const row of allVariants){
          const original=review.product.product_variants.find(v=>v.id===row.id);const before=baseVariants.find(v=>v.id===row.id);const draftRow=variants.find(v=>v.id===row.id)!;
          if(!original){changes.variants!.push(row);continue;}
          const patch:{id:string}&Record<string,unknown>={id:row.id};
          const map={title:'title',sku:'sku',price:'price_usd',stock:'stock',active:'active'} as const;
          for(const k of Object.keys(map) as (keyof typeof map)[])if(draftRow[k]!==before![k])patch[map[k]]=row[map[k]];
          if(row.sort!==original.sort)patch.sort=row.sort;
          if(Object.keys(patch).length>1)changes.variants!.push(patch);
        }
        saveImages.forEach((img,sort)=>{const original=review.product.product_images.find(v=>v.id===img.id);if(!original)changes.images!.push({id:img.id,path:img.picked?.uploaded??img.path!,sort});else if(original.sort!==sort)changes.images!.push({id:img.id,sort});});
        if(auto){
          changes.costs={};const before=costsFor(review.pricing);const map={freight:'freight_usd',logistics:'logistics_usd',margin:'margin_pct'} as const;
          for(const k of Object.keys(map) as (keyof typeof map)[])if(costs[k]!==before[k])Object.assign(changes.costs,{[map[k]]:costs[k].trim()?Number(decimal(costs[k])):null});
          changes.variantCosts=variants.filter(v=>v.cost!==baseVariants.find(b=>b.id===v.id)?.cost).map(v=>({variant_id:v.id,cost_usd:v.cost.trim()?Number(decimal(v.cost)):null}));
        }
        const payload=JSON.stringify(changes);
        if(!intent.current||intent.current.revision!==review.revision||intent.current.payload!==payload)intent.current={revision:review.revision,payload,key:Crypto.randomUUID()};
        await assertCurrent();
        await bound.seller.saveProductReviewed(s.id,id,intent.current.revision,intent.current.key,changes);
      }else{
        // Creation remains explicit: the reviewed contract only updates existing products.
        await assertCurrent();
        await bound.seller.saveProduct(s.id,id,{fields,variants:allVariants,images:saveImages.map((img,sort)=>({id:img.id,path:img.picked?.uploaded??img.path!,sort}))});
      }
      writeConfirmed=true;
      // The result may be historical on a replay. Only a fresh snapshot becomes the editor baseline.
      const current=await readCurrent(bound);await assertCurrent();applyCurrent(current);intent.current=null;setUncertain(false);setNeedsReview(false);
      await Promise.all(['seller-products','seller-dashboard','store','search','home','product'].map(key=>qc.invalidateQueries({queryKey:[key]})));
      haptics.success(); router.setParams({ id, saved:'1' });
    } catch (e) {
      if(!mounted.current)return;
      const code=(e as {code?:string}).code;
      if(code==='seller_revision_conflict'){setNeedsReview(true);setUncertain(false);intent.current=null;}
      else if(!writeConfirmed&&code&&['invalid_input','seller_price_review_required','catalog_metadata_review_required','catalog_sensitive_review_required','idempotency_conflict','forbidden','auth_required','store_access_denied','not_found','product_busy'].includes(code)){intent.current=null;setUncertain(false); }
      else if(intent.current){setUncertain(true);}
      setError((e as Error).message||'No pudimos guardar. Intenta de nuevo.');
    }
    finally { lock.current=false; if(mounted.current)setBusy(false); }
  };
  const reconcile=async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError(null);
    try{const operation=await apiForActor(user!.id);const next=await readCurrent(operation.api);await operation.assertCurrent();if(!mounted.current)return;setPreserved(old=>[...old,{fields:{...f},variants:variants.map(v=>({...v})),images:images.map(i=>({...i})),costs:{...costs},existingVariantIds:review?.product.product_variants.map(v=>v.id)??[]}]);applyCurrent(next);setNeedsReview(false);setUncertain(false);intent.current=null;}
    catch(e){setError((e as Error).message||'No pudimos leer la versión actual.');}
    finally{lock.current=false;setBusy(false);}
  };
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const categoryItems = (categories.data ?? []).filter((c)=>c.active).map((c)=>({ value:c.id,label:c.name+(c.requires_review||c.risk_level!=='low'?' · revisión':'') }));
  return <><UnsavedChanges dirty={dirty || preserved.length>0 || catalogState.dirty || catalogState.locked} busy={busy || catalogState.busy} /><SellerScroll>
    <Text variant="title">{p ? 'Editar producto' : 'Agregar producto'}</Text>
    {saved === '1' && !dirty ? <Banner tone="success" body="Producto guardado. Consulta su estado de publicación." /> : null}
    {p ? <Badge label={MODERATION_LABEL[p.moderation_status] ?? p.moderation_status} tone={p.moderation_status==='published'?'success':'warning'} /> : null}
    {p?.moderation_note ? <Banner tone={p.moderation_status==='rejected'||p.moderation_status==='suspended'?'warning':'info'} body={`${p.moderation_note}${p.moderation_status==='rejected'?' Corrige y guarda para volver a revisión.':p.moderation_status==='suspended'?' La administración debe levantar la suspensión.':''}`} /> : null}
    {s.status!=='active' ? <Banner tone="warning" body="Tu tienda debe estar activa antes de publicar productos." /> : null}
    <Card style={{ gap:16 }}><Text variant="subtitle">Información del producto</Text>
      <TextField testID="product-edit-title" label="Nombre del producto" value={f.title} maxLength={140} editable={!blocked} onChangeText={(v)=>set('title',v)} />
      <TextField label="Subtítulo" value={f.subtitle} maxLength={140} editable={!blocked} onChangeText={(v)=>set('subtitle',v)} />
      <TextField testID="product-edit-description" label="Descripción del producto" value={f.description} multiline maxLength={8000} editable={!blocked} onChangeText={(v)=>set('description',v)} />
      <TextField testID="product-edit-highlights" label="Características destacadas" helper="Una por línea, máximo seis." value={f.highlights} multiline editable={!blocked} onChangeText={(v)=>set('highlights',v)} />
      {categories.isError ? <ErrorState error={categories.error} onRetry={()=>categories.refetch()} /> : <SellerChoice label="Categoría" testID="product-category" value={f.category_id} items={categoryItems} disabled={blocked||categories.isPending} onChange={(v)=>set('category_id',v)} />}
      <SellerChoice label="Disponibilidad" testID="product-availability" value={f.availability} items={choices.map((a)=>({value:a,label:AVAILABILITY[a].label}))} disabled={blocked} onChange={(v)=>set('availability',v)} />
      <Text variant="caption" color="textSecondary">No disponible pausa la venta. Agotado se ajusta al inventario. {brand.name} revisa la publicación cuando corresponde.</Text>
    </Card>
    <Card style={{ gap:16 }}><Text variant="subtitle">Precio e inventario</Text><Text variant="bodySmall" color="textSecondary">{auto ? `Este precio sigue al costo. Actualiza costos abajo; ${brand.name} calcula el resultado con la regla vigente.` : 'El precio del producto corresponde a la variante activa más económica. El cobro se calcula al comprar.'}</Text>
      {variants.map((v,i)=><View key={v.id} style={{ gap:12 }}><Text variant="label">Variante {i+1}</Text>
        <TextField testID={`variant-title-${i}`} label={`Nombre de variante ${i+1}`} value={v.title} editable={!blocked} onChangeText={(value)=>variant(i,{ title:value })} />
        <TextField testID={`variant-price-${i}`} label={`Precio USD de variante ${i+1}`} value={v.price} keyboardType="decimal-pad" editable={!blocked&&!auto} onChangeText={(value)=>variant(i,{ price:value })} />
        <TextField testID={`variant-stock-${i}`} label={`Inventario de variante ${i+1}`} helper="Vacío: sin control de cantidades. La disponibilidad se ajusta al inventario." value={v.stock} keyboardType="number-pad" editable={!blocked} onChangeText={(value)=>variant(i,{ stock:value })} />
        <TextField label={`SKU de variante ${i+1}`} value={v.sku} editable={!blocked} onChangeText={(value)=>variant(i,{ sku:value })} />
        {auto ? <TextField testID={`variant-cost-${i}`} label={`Costo USD de variante ${i+1}`} value={v.cost} keyboardType="decimal-pad" editable={!blocked} onChangeText={(value)=>variant(i,{ cost:value })} /> : null}
        <Button testID={`variant-active-${i}`} title={v.active?'Pausar variante':'Activar variante'} variant="secondary" disabled={blocked} onPress={()=>variant(i,{ active:!v.active })} />
      </View>)}
      {!auto ? <Button title="Agregar variante" variant="secondary" disabled={blocked||variants.length>=50} onPress={()=>setVariants((old)=>[...old,{ id:Crypto.randomUUID(),title:'',sku:'',price:old[0]?.price??'',stock:'',active:true,cost:'' }])} /> : null}
      <TextField label="Peso en kg" value={f.weight} keyboardType="decimal-pad" editable={!blocked} onChangeText={(v)=>set('weight',v)} />
      <TextField label="Máximo por pedido" value={f.max} keyboardType="number-pad" editable={!blocked} onChangeText={(v)=>set('max',v)} />
      <TextField label="Precio anterior en USD" helper="Solo si realmente se vendió a ese precio." value={f.compare} keyboardType="decimal-pad" editable={!blocked} onChangeText={(v)=>set('compare',v)} />
    </Card>
    {auto ? <Card style={{ gap:16 }}><Text variant="subtitle">Costos y precio automático</Text>{(['freight','logistics','margin'] as const).map((k)=><TextField key={k} label={k==='freight'?'Flete por unidad (USD)':k==='logistics'?'Gastos por unidad (USD)':'Margen (%)'} helper="Vacío: usar regla general." value={costs[k]} keyboardType="decimal-pad" editable={!blocked} onChangeText={(v)=>setCosts((old)=>({...old,[k]:v}))} />)}<Text color="textSecondary" variant="bodySmall">{pricing?.snapshot && new Date(pricing.snapshot.valid_until)>new Date()?`${brand.name} calcula el precio con la regla vigente.`:'Sin brecha vigente: se conserva el precio actual.'} Cambiar el modo de precio o ampliar variantes automáticas sigue disponible en el panel.</Text></Card> : null}
    <Card style={{ gap:12 }}><Text variant="subtitle">Fotografías ({images.length}/10)</Text><Text variant="bodySmall" color="textSecondary">Usa imágenes propias o autorizadas. La primera es la portada.</Text>
      {images.map((img,i)=><View key={img.id} style={{ gap:8 }}><Image source={{uri:img.picked?.uri??catalogImage(img.path??null)??undefined}} accessibilityLabel={`Foto ${i+1} del producto`} style={{ width:'100%',height:180,borderRadius:12 }} contentFit="cover" />
        {i>0 ? <Button title={`Hacer portada la foto ${i+1}`} variant="secondary" disabled={blocked} onPress={()=>setImages((old)=>[old[i]!,...old.filter((_,index)=>index!==i)])} /> : null}
        {img.picked ? <Button title={`Descartar foto ${i+1}`} variant="ghost" disabled={blocked} onPress={()=>setImages((old)=>old.filter((_,index)=>index!==i))} /> : null}
      </View>)}
      <Button testID="product-add-photo" title="Agregar fotografía" icon="image" variant="secondary" full disabled={blocked||images.length>=10} onPress={async()=>{try{const picked=await pickSellerImage();if(picked)setImages((old)=>[...old,{id:Crypto.randomUUID(),picked}]);}catch(e){setError((e as Error).message);}}} />
    </Card>
    {review ? <CatalogAuthoring key={`${user!.id}:${s.id}:${id}`} actorId={user!.id} storeId={s.id} review={review} generalDirty={dirty} generalBusy={busy || uncertain || needsReview} onStateChange={setCatalogState} onSaved={applyCurrent} /> : <Banner body="Después de crear el producto podrás indicar su condición y asociar sus fotos a cada opción." />}
    {p?.moderation_events.length ? <Card style={{ gap:10 }}><Text variant="subtitle">Historial de revisión</Text>{[...p.moderation_events].sort((a,b)=>b.id-a.id).slice(0,6).map((e)=><Text variant="bodySmall" key={e.id}>{new Date(e.created_at).toLocaleDateString('es-VE')} · {MODERATION_LABEL[e.to_status]}{e.automatic?' · automático':''}{e.note&&!e.note.startsWith('auto:')?` · ${e.note}`:''}</Text>)}</Card> : null}
    {dirty ? <Text color="textSecondary">Cambios sin guardar</Text> : null}{error ? <Banner tone="danger" body={error} /> : null}
    {uncertain ? <Banner tone="warning" body="No hemos podido confirmar el resultado. Conservamos este intento: usa Reintentar guardado para recuperarlo antes de seguir editando." /> : null}
    {needsReview ? <Card style={{gap:12}}><Text variant="subtitle">El producto cambió</Text><Text>Tu borrador sigue intacto. Revisa los datos actuales antes de guardar; podrás recuperar cada cambio por separado.</Text><Button testID="product-review-current" title="Revisar versión actual" loading={busy} onPress={reconcile} /></Card> : null}
    {preserved.map((old,n)=><View key={n} testID={`product-preserved-${n}`}><Card style={{gap:12}}><Text variant="subtitle">Borrador conservado {n+1}</Text><Text variant="bodySmall" color="textSecondary">El formulario muestra ahora el estado actual. Recupera sólo los valores que quieras conservar; revisa especialmente inventario y precios.</Text>
      {(Object.keys(old.fields) as (keyof FieldsDraft)[]).filter(k=>old.fields[k]!==f[k]).map(k=><View key={k} style={{gap:6}}><Text variant="label">{fieldLabels[k]}</Text><Text variant="bodySmall">Actual: {showValue(f[k])}</Text><Text variant="bodySmall" numberOfLines={3}>Borrador: {showValue(old.fields[k])}</Text><Button testID={`product-restore-field-${n}-${k}`} title={`Usar valor del borrador: ${fieldLabels[k]}`} variant="secondary" disabled={blocked} onPress={()=>setF(value=>({...value,[k]:old.fields[k]}))} /></View>)}
      {old.variants.map(v=>{const current=variants.find(row=>row.id===v.id);return current?<View key={v.id} style={{gap:8}}><Text variant="label">Variante: {v.title}</Text>{(Object.keys(variantLabels) as (keyof typeof variantLabels)[]).filter(k=>v[k]!==current[k]).map(k=><View key={k} style={{gap:6}}><Text variant="bodySmall">{variantLabels[k]} actual: {showValue(current[k])} · Borrador: {showValue(v[k])}</Text><Button testID={`product-restore-variant-${n}-${v.id}-${k}`} title={`Usar ${variantLabels[k].toLowerCase()} del borrador`} variant="secondary" disabled={blocked} onPress={()=>setVariants(rows=>rows.map(row=>row.id===v.id?{...row,[k]:v[k]}:row))} /></View>)}</View>:<View key={v.id} style={{gap:6}}><Text variant="bodySmall">{v.title}: {old.existingVariantIds.includes(v.id)?'esta variante fue retirada; sus datos se conservan aquí.':'variante nueva de tu borrador.'}</Text>{!old.existingVariantIds.includes(v.id)?<Button title={`Recuperar variante ${v.title}`} variant="secondary" disabled={blocked||variants.length>=50} onPress={()=>setVariants(rows=>[...rows,{...v}])} />:null}</View>;})}
      {(Object.keys(old.costs) as (keyof CostsDraft)[]).filter(k=>auto&&old.costs[k]!==costs[k]).map(k=><View key={k} style={{gap:6}}><Text variant="bodySmall">{k==='freight'?'Flete':k==='logistics'?'Gastos':'Margen'} actual: {showValue(costs[k])} · Borrador: {showValue(old.costs[k])}</Text><Button title={`Recuperar ${k==='freight'?'flete':k==='logistics'?'gastos':'margen'} del borrador`} variant="secondary" disabled={blocked} onPress={()=>setCosts(value=>({...value,[k]:old.costs[k]}))} /></View>)}
      {old.images.filter(img=>img.picked&&!images.some(row=>row.id===img.id)).map(img=><Button key={img.id} title="Recuperar fotografía nueva del borrador" variant="secondary" disabled={blocked||images.length>=10} onPress={()=>setImages(rows=>[...rows,{...img}])} />)}
      <Button title="Descartar este borrador conservado" variant="ghost" disabled={blocked} onPress={()=>setDiscardDraft(n)} />
    </Card></View>)}
    <ConfirmSheet visible={discardDraft!==null} title="¿Descartar el borrador conservado?" body="Los valores que ya recuperaste en el formulario se conservan. Se eliminará solamente esta copia anterior." confirm="Descartar copia" onClose={()=>setDiscardDraft(null)} onConfirm={()=>{setPreserved(rows=>rows.filter((_,i)=>i!==discardDraft));setDiscardDraft(null);}} testID="product-discard-preserved" />
    <Button testID="product-edit-save" title={error?'Reintentar guardado':p?'Guardar producto':'Crear producto'} loading={busy} disabled={needsReview || catalogState.busy || catalogState.locked || (!!p&&!dirty)} full onPress={save} />
    <Text variant="caption" color="textMuted">Los borradores aún no están disponibles. Guarda cuando la información esté lista.</Text>
    <AdvancedPanel path={p?`/vendedor/productos/editar?id=${p.id}`:'/vendedor/productos'} />
  </SellerScroll></>;
}
