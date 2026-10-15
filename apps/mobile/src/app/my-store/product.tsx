import type { ProductPricing, SellerEditableProduct } from '@kora/api';
import { MODERATION_LABEL, AVAILABILITY, type Availability } from '@kora/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { SellerChoice } from '@/components/seller/SellerChoice';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { IMAGE_TYPES, imageBytes, pickSellerImage, type PickedImage } from '@/components/seller/SellerImage';
import { UnsavedChanges } from '@/components/seller/UnsavedChanges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { Banner, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useCategories } from '@/lib/hooks';
import { useSeller } from '@/lib/seller';
import { api, catalogImage } from '@/lib/supabase';

export default function ProductScreen() { return <SellerScreen><LoadProduct /></SellerScreen>; }
function LoadProduct() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { store } = useSeller(); const { user } = useAuth();
  const ready = useQuery({ queryKey: ['seller-editor-ready', user!.id], queryFn: api.seller.editorReady, staleTime: 0, refetchOnMount: 'always' });
  const q = useQuery({ queryKey: ['seller-product', user!.id, store!.id, id], queryFn: async () => ({ product: await api.seller.product(store!.id, id!), pricing: await api.seller.productPricing(id!) }), enabled: !!id && ready.data === true });
  if (ready.isPending || (id && ready.data && q.isPending)) return <SellerLoading />;
  if (ready.isError || (id && q.isError)) return <ErrorState error={ready.error ?? q.error} onRetry={() => { ready.refetch(); q.refetch(); }} />;
  if (!ready.data) return <SellerScroll><Banner tone="warning" body="La edición móvil aún no está habilitada. Puedes consultar el catálogo o usar el panel web." /><AdvancedPanel path="/vendedor/productos" /></SellerScroll>;
  return <Editor key={id ?? 'new'} product={q.data?.product ?? null} pricing={q.data?.pricing ?? null} />;
}
type VariantDraft = { id: string; title: string; sku: string; price: string; stock: string; active: boolean; cost: string };
type ImageDraft = { id: string; path?: string; picked?: PickedImage };
const decimal = (s: string) => s.trim().replace(',', '.');
const amount = /^\d{1,7}([.,]\d{1,2})?$/;
const choices = Object.keys(AVAILABILITY) as Availability[];
function Editor({ product: p, pricing }: { product: SellerEditableProduct | null; pricing: ProductPricing | null }) {
  const { store } = useSeller(); const { user } = useAuth(); const s = store!; const qc = useQueryClient(); const categories = useCategories();
  const [id] = useState(() => p?.id ?? Crypto.randomUUID());
  const [f, setF] = useState({ title: p?.title ?? '', subtitle: p?.subtitle ?? '', description: p?.description ?? '', highlights: (p?.highlights ?? []).join('\n'), category_id: p?.category_id ?? '', availability: p?.availability ?? 'available', weight: String(p?.weight_kg ?? 0.5), max: String(p?.max_per_order ?? 10), compare: p?.compare_at_usd ? String(p.compare_at_usd) : '' });
  const [variants, setVariants] = useState<VariantDraft[]>(() => p ? [...p.product_variants].sort((a,b) => a.sort-b.sort).map((v) => ({ id: v.id, title: v.title, sku: v.sku ?? '', price: String(v.price_usd), stock: v.stock == null ? '' : String(v.stock), active: v.active, cost: String(pricing?.variants.find((row) => row.variant_id === v.id)?.cost_usd ?? '') })) : [{ id: Crypto.randomUUID(), title: 'Única', sku: '', price: '', stock: '', active: true, cost: '' }]);
  const [images, setImages] = useState<ImageDraft[]>(() => [...(p?.product_images ?? [])].sort((a,b) => a.sort-b.sort).map((i) => ({ id: i.id, path: i.path })));
  const [costs, setCosts] = useState({ freight: String(pricing?.costs?.freight_usd ?? ''), logistics: String(pricing?.costs?.logistics_usd ?? ''), margin: String(pricing?.costs?.margin_pct ?? '') });
  const auto = pricing?.costs?.auto_price === true;
  const draft = JSON.stringify({ f, variants, images: images.map((i) => ({ id:i.id, path:i.path, uri:i.picked?.uri })), costs });
  const [baseline, setBaseline] = useState(draft); const dirty = draft !== baseline;
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof f, value: string) => setF((old) => ({ ...old, [key]: value }));
  const variant = (index: number, patch: Partial<VariantDraft>) => setVariants((rows) => rows.map((v, i) => i===index ? { ...v, ...patch } : v));
  const validation = f.title.trim().length < 3 ? 'El nombre necesita al menos 3 caracteres.' : !f.category_id ? 'Elige una categoría.'
    : !variants.some((v) => v.active) ? 'Conserva al menos una variante activa. Para pausar el producto, elige «No disponible».'
    : variants.some((v) => !v.title.trim() || !amount.test(v.price.trim()) || Number(decimal(v.price)) <= 0 || (v.stock.trim() && !/^\d{1,6}$/.test(v.stock.trim()))) ? 'Cada variante necesita nombre, precio positivo con hasta dos decimales e inventario entero o vacío.'
    : !/^\d{1,3}([.,]\d{1,3})?$/.test(f.weight) || !/^\d{1,3}$/.test(f.max) || Number(f.max)<1 || Number(f.max)>100 ? 'Revisa el peso y el máximo por pedido (1 a 100).'
    : f.compare.trim() && (!amount.test(f.compare.trim()) || Number(decimal(f.compare)) <= Math.min(...variants.filter((v) => v.active).map((v) => Number(decimal(v.price))))) ? 'El precio anterior debe ser mayor que el actual.'
    : auto && (Object.values(costs).some((c) => c.trim() && !amount.test(c.trim())) || Number(decimal(costs.margin || '0'))>500 || variants.some((v) => v.cost.trim() && (!amount.test(v.cost.trim()) || Number(decimal(v.cost))<=0))) ? 'Revisa costos, flete, gastos y margen (máximo 500 %).' : null;
  const save = async () => {
    if (lock.current) return; if (validation) return setError(validation);
    lock.current = true; setBusy(true); setError(null);
    try {
      for (const img of images) if (img.picked) {
        img.picked.uploaded ??= await api.seller.uploadImage('catalog', `${s.id}/${id}/${img.id}.${IMAGE_TYPES[img.picked.type]}`, await imageBytes(img.picked), img.picked.type);
      }
      await api.seller.saveProduct(s.id, id, { fields: { title:f.title.trim(), subtitle:f.subtitle.trim()||null, description:f.description.trim()||null, highlights:f.highlights.split('\n').map((h)=>h.trim()).filter(Boolean).slice(0,6), category_id:f.category_id, availability:f.availability, weight_kg:Number(decimal(f.weight)), max_per_order:Number(f.max), compare_at_usd:f.compare.trim()?Number(decimal(f.compare)):null },
        variants:variants.map((v,sort)=>({ id:v.id,title:v.title.trim(),sku:v.sku.trim()||null,price_usd:Number(decimal(v.price)),stock:v.stock.trim()?Number(v.stock):null,active:v.active,sort })),
        images:images.map((i,sort)=>({ id:i.id,path:i.picked?.uploaded ?? i.path!,sort })),
        ...(auto ? { costs:{ ...pricing!.costs!, freight_usd:costs.freight.trim()?decimal(costs.freight):null,logistics_usd:costs.logistics.trim()?decimal(costs.logistics):null,margin_pct:costs.margin.trim()?decimal(costs.margin):null },variantCosts:variants.map((v)=>({ variant_id:v.id,cost_usd:v.cost.trim()?Number(decimal(v.cost)):null })) } : {}),
      });
      const updated = await api.seller.product(s.id,id);
      qc.setQueryData(['seller-product',user!.id,s.id,id], { product:updated, pricing:await api.seller.productPricing(id) });
      await Promise.all(['seller-products','seller-dashboard','store','search','home','product'].map((key)=>qc.invalidateQueries({ queryKey:[key] })));
      const nextF = { ...f, availability:updated.availability };
      const nextVariants = variants.map((v)=>({ ...v, price:String(updated.product_variants.find((row)=>row.id===v.id)!.price_usd) }));
      setF(nextF); setVariants(nextVariants); setBaseline(JSON.stringify({f:nextF,variants:nextVariants,images:images.map((i)=>({id:i.id,path:i.path,uri:i.picked?.uri})),costs}));
      haptics.success(); router.setParams({ id, saved:'1' });
    } catch (e) { setError((e as Error).message || 'No pudimos guardar. Intenta de nuevo.'); }
    finally { lock.current=false; setBusy(false); }
  };
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const categoryItems = (categories.data ?? []).filter((c)=>c.active).map((c)=>({ value:c.id,label:c.name+(c.requires_review||c.risk_level!=='low'?' · revisión':'') }));
  return <><UnsavedChanges dirty={dirty} busy={busy} /><SellerScroll>
    <Text variant="title">{p ? 'Editar producto' : 'Agregar producto'}</Text>
    {saved === '1' && !dirty ? <Banner tone="success" body="Producto guardado. Consulta su estado de publicación." /> : null}
    {p ? <Badge label={MODERATION_LABEL[p.moderation_status] ?? p.moderation_status} tone={p.moderation_status==='published'?'success':'warning'} /> : null}
    {p?.moderation_note ? <Banner tone={p.moderation_status==='rejected'||p.moderation_status==='suspended'?'warning':'info'} body={`${p.moderation_note}${p.moderation_status==='rejected'?' Corrige y guarda para volver a revisión.':p.moderation_status==='suspended'?' La administración debe levantar la suspensión.':''}`} /> : null}
    {s.status!=='active' ? <Banner tone="warning" body="Tu tienda debe estar activa antes de publicar productos." /> : null}
    <Card style={{ gap:16 }}><Text variant="subtitle">Información del producto</Text>
      <TextField testID="product-edit-title" label="Nombre del producto" value={f.title} maxLength={140} editable={!busy} onChangeText={(v)=>set('title',v)} />
      <TextField label="Subtítulo" value={f.subtitle} maxLength={140} editable={!busy} onChangeText={(v)=>set('subtitle',v)} />
      <TextField testID="product-edit-description" label="Descripción del producto" value={f.description} multiline maxLength={8000} editable={!busy} onChangeText={(v)=>set('description',v)} />
      <TextField testID="product-edit-highlights" label="Características destacadas" helper="Una por línea, máximo seis." value={f.highlights} multiline editable={!busy} onChangeText={(v)=>set('highlights',v)} />
      {categories.isError ? <ErrorState error={categories.error} onRetry={()=>categories.refetch()} /> : <SellerChoice label="Categoría" testID="product-category" value={f.category_id} items={categoryItems} disabled={busy||categories.isPending} onChange={(v)=>set('category_id',v)} />}
      <SellerChoice label="Disponibilidad" testID="product-availability" value={f.availability} items={choices.map((a)=>({value:a,label:AVAILABILITY[a].label}))} disabled={busy} onChange={(v)=>set('availability',v)} />
      <Text variant="caption" color="textSecondary">No disponible pausa la venta. Agotado se ajusta al inventario. HAYAZGO revisa la publicación cuando corresponde.</Text>
    </Card>
    <Card style={{ gap:16 }}><Text variant="subtitle">Precio e inventario</Text><Text variant="bodySmall" color="textSecondary">{auto ? 'Este precio sigue al costo. Actualiza costos abajo; HAYAZGO calcula el resultado con la regla vigente.' : 'El precio del producto corresponde a la variante activa más económica. El cobro se calcula al comprar.'}</Text>
      {variants.map((v,i)=><View key={v.id} style={{ gap:12 }}><Text variant="label">Variante {i+1}</Text>
        <TextField testID={`variant-title-${i}`} label={`Nombre de variante ${i+1}`} value={v.title} editable={!busy} onChangeText={(value)=>variant(i,{ title:value })} />
        <TextField testID={`variant-price-${i}`} label={`Precio USD de variante ${i+1}`} value={v.price} keyboardType="decimal-pad" editable={!busy&&!auto} onChangeText={(value)=>variant(i,{ price:value })} />
        <TextField testID={`variant-stock-${i}`} label={`Inventario de variante ${i+1}`} helper="Vacío: sin control de cantidades. La disponibilidad se ajusta al inventario." value={v.stock} keyboardType="number-pad" editable={!busy} onChangeText={(value)=>variant(i,{ stock:value })} />
        <TextField label={`SKU de variante ${i+1}`} value={v.sku} editable={!busy} onChangeText={(value)=>variant(i,{ sku:value })} />
        {auto ? <TextField testID={`variant-cost-${i}`} label={`Costo USD de variante ${i+1}`} value={v.cost} keyboardType="decimal-pad" editable={!busy} onChangeText={(value)=>variant(i,{ cost:value })} /> : null}
        <Button testID={`variant-active-${i}`} title={v.active?'Pausar variante':'Activar variante'} variant="secondary" disabled={busy} onPress={()=>variant(i,{ active:!v.active })} />
      </View>)}
      {!auto ? <Button title="Agregar variante" variant="secondary" disabled={busy||variants.length>=50} onPress={()=>setVariants((old)=>[...old,{ id:Crypto.randomUUID(),title:'',sku:'',price:old[0]?.price??'',stock:'',active:true,cost:'' }])} /> : null}
      <TextField label="Peso en kg" value={f.weight} keyboardType="decimal-pad" editable={!busy} onChangeText={(v)=>set('weight',v)} />
      <TextField label="Máximo por pedido" value={f.max} keyboardType="number-pad" editable={!busy} onChangeText={(v)=>set('max',v)} />
      <TextField label="Precio anterior en USD" helper="Solo si realmente se vendió a ese precio." value={f.compare} keyboardType="decimal-pad" editable={!busy} onChangeText={(v)=>set('compare',v)} />
    </Card>
    {auto ? <Card style={{ gap:16 }}><Text variant="subtitle">Costos y precio automático</Text>{(['freight','logistics','margin'] as const).map((k)=><TextField key={k} label={k==='freight'?'Flete por unidad (USD)':k==='logistics'?'Gastos por unidad (USD)':'Margen (%)'} helper="Vacío: usar regla general." value={costs[k]} keyboardType="decimal-pad" editable={!busy} onChangeText={(v)=>setCosts((old)=>({...old,[k]:v}))} />)}<Text color="textSecondary" variant="bodySmall">{pricing?.snapshot && new Date(pricing.snapshot.valid_until)>new Date()?'HAYAZGO calcula el precio con la regla vigente.':'Sin brecha vigente: se conserva el precio actual.'} Cambiar el modo de precio o ampliar variantes automáticas sigue disponible en el panel.</Text></Card> : null}
    <Card style={{ gap:12 }}><Text variant="subtitle">Fotografías ({images.length}/10)</Text><Text variant="bodySmall" color="textSecondary">Usa imágenes propias o autorizadas. La primera es la portada.</Text>
      {images.map((img,i)=><View key={img.id} style={{ gap:8 }}><Image source={{uri:img.picked?.uri??catalogImage(img.path??null)??undefined}} accessibilityLabel={`Foto ${i+1} del producto`} style={{ width:'100%',height:180,borderRadius:12 }} contentFit="cover" />
        {i>0 ? <Button title={`Hacer portada la foto ${i+1}`} variant="secondary" disabled={busy} onPress={()=>setImages((old)=>[old[i]!,...old.filter((_,index)=>index!==i)])} /> : null}
        {img.picked ? <Button title={`Descartar foto ${i+1}`} variant="ghost" disabled={busy} onPress={()=>setImages((old)=>old.filter((_,index)=>index!==i))} /> : null}
      </View>)}
      <Button testID="product-add-photo" title="Agregar fotografía" icon="image" variant="secondary" full disabled={busy||images.length>=10} onPress={async()=>{try{const picked=await pickSellerImage();if(picked)setImages((old)=>[...old,{id:Crypto.randomUUID(),picked}]);}catch(e){setError((e as Error).message);}}} />
    </Card>
    {p?.moderation_events.length ? <Card style={{ gap:10 }}><Text variant="subtitle">Historial de revisión</Text>{[...p.moderation_events].sort((a,b)=>b.id-a.id).slice(0,6).map((e)=><Text variant="bodySmall" key={e.id}>{new Date(e.created_at).toLocaleDateString('es-VE')} · {MODERATION_LABEL[e.to_status]}{e.automatic?' · automático':''}{e.note&&!e.note.startsWith('auto:')?` · ${e.note}`:''}</Text>)}</Card> : null}
    {dirty ? <Text color="textSecondary">Cambios sin guardar</Text> : null}{error ? <Banner tone="danger" body={error} /> : null}
    <Button testID="product-edit-save" title={error?'Reintentar guardado':p?'Guardar producto':'Crear producto'} loading={busy} disabled={!!p&&!dirty} full onPress={save} />
    <Text variant="caption" color="textMuted">Los borradores aún no están disponibles. Guarda cuando la información esté lista.</Text>
    <AdvancedPanel path={p?`/vendedor/productos/editar?id=${p.id}`:'/vendedor/productos'} />
  </SellerScroll></>;
}
