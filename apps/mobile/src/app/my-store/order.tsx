import type { FulfillmentStep, SellerFulfillment } from '@kora/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { SellerChoice } from '@/components/seller/SellerChoice';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { UnsavedChanges } from '@/components/seller/UnsavedChanges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { Card } from '@/components/ui/Layout';
import { Banner, EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { useFulfillmentSteps } from '@/lib/hooks';
import { useSeller } from '@/lib/seller';
import { api } from '@/lib/supabase';

/** Presentation of server flags/payment level; advance_fulfillment authorizes the actual transition. */
function optionsFor(steps: FulfillmentStep[], f: SellerFulfillment) {
  const current = steps.find((s) => s.flow === f.flow && s.code === f.status);
  if (!current || current.is_terminal || f.order_status === 'cancelled') return [];
  return steps.filter((s) => s.flow === f.flow && s.seq > current.seq && s.code !== 'cancelled' && s.seller_can_set
    && (!s.requires_payment || f.payment_level === 'full' || (s.requires_payment === 'down_payment' && f.payment_level === 'down_payment')));
}
export default function OrderScreen() { return <SellerScreen><LoadOrder /></SellerScreen>; }
function LoadOrder() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const { store } = useSeller(); const { user } = useAuth();
  const ready = useQuery({ queryKey: ['seller-orders-ready', user!.id], queryFn: api.seller.ordersReady, staleTime: 0, refetchOnMount: 'always' });
  const q = useQuery({ queryKey: ['seller-delivery', user!.id, store!.id, id], queryFn: () => api.seller.fulfillment(store!.id, id!), enabled: !!id && ready.data === true });
  const steps = useFulfillmentSteps();
  if (ready.isPending || (id && ready.data && q.isPending) || steps.isPending) return <SellerLoading />;
  if (ready.isError || q.isError || steps.isError) return <ErrorState error={ready.error ?? q.error ?? steps.error} onRetry={() => { ready.refetch(); q.refetch(); steps.refetch(); }} />;
  if (!ready.data) return <SellerScroll><Banner tone="info" body="Las acciones móviles aún no están habilitadas. Puedes consultar los pedidos o usar el panel." /><AdvancedPanel path="/vendedor/pedidos" /></SellerScroll>;
  if (!id || !q.data) return <EmptyState icon="receipt" title="No encontramos esta entrega" body="Puede pertenecer a otra tienda. Vuelve a Pedidos y actualiza la lista." />;
  return <Delivery key={q.data.id} f={q.data} steps={steps.data ?? []} refresh={() => q.refetch()} />;
}
function Delivery({ f, steps, refresh }: { f: SellerFulfillment; steps: FulfillmentStep[]; refresh: () => unknown }) {
  const { user } = useAuth(); const { store } = useSeller(); const qc = useQueryClient();
  const key = ['seller-delivery', user!.id, store!.id, f.id];
  const [step, setStep] = useState(''); const [note, setNote] = useState(''); const [tracking, setTracking] = useState(f.tracking_number ?? ''); const [carrier, setCarrier] = useState(f.carrier_name ?? '');
  const draft = JSON.stringify({ step, note, tracking, carrier }); const [baseline, setBaseline] = useState(draft); const dirty = draft !== baseline;
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [confirm, setConfirm] = useState<FulfillmentStep | null>(null);
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const options = optionsFor(steps, f); const chosen = options.find((s) => s.code === step) ?? options[0];
  const label = (code: string) => steps.find((s) => s.flow === f.flow && s.code === code)?.label ?? code;
  const current = steps.find((s) => s.flow === f.flow && s.code === f.status);
  const next = current && steps.find((s) => s.flow === f.flow && s.seq > current.seq && s.code !== 'cancelled');
  const needsTracking = chosen?.code === 'dispatched' && f.flow === 'seller_shipping' && f.shipping_kind === 'home_delivery' && !tracking.trim() && !f.tracking_number;
  const fresh = async () => { const value = await api.seller.fulfillment(store!.id, f.id); if (!value) throw new Error('No encontramos esta entrega. Actualiza la lista.'); qc.setQueryData(key, value); return value; };
  const review = async () => {
    if (lock.current || !chosen) return;
    if (needsTracking) return setError('Agrega el número de guía para despachar.');
    lock.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      const [now, actualSteps] = await Promise.all([fresh(), api.orders.steps()]);
      const action = optionsFor(actualSteps, now).find((s) => s.code === chosen.code);
      if (!action) throw new Error('El estado o el pago cambió. Revisa los datos actualizados antes de continuar.');
      setConfirm(action);
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (lock.current || !confirm) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const [now, actualSteps] = await Promise.all([fresh(), api.orders.steps()]);
      if (now.status === confirm.code) {
        const event = [...now.fulfillment_events].sort((a, b) => b.id - a.id).find((e) => e.step_code === confirm.code);
        const matches = (event?.note ?? '') === note.trim()
          && (!tracking.trim() || now.tracking_number === tracking.trim())
          && (!carrier.trim() || now.carrier_name === carrier.trim());
        if (!matches) throw new Error('Otra sesión completó este paso con datos distintos. Conservamos tu nota y guía; revisa el historial antes de continuar.');
      } else {
        if (!optionsFor(actualSteps, now).some((s) => s.code === confirm.code)) throw new Error('Esta acción ya no está permitida. Revisa el pago y el estado actual.');
        await api.seller.advance(f.id, confirm.code, { note: note.trim() || undefined, tracking: tracking.trim() || undefined, carrier: carrier.trim() || undefined });
      }
      const updated = await fresh();
      const nextDraft = { step:'', note:'', tracking:updated.tracking_number ?? '', carrier:updated.carrier_name ?? '' };
      setStep(''); setNote(''); setTracking(nextDraft.tracking); setCarrier(nextDraft.carrier); setBaseline(JSON.stringify(nextDraft));
      setSuccess(`Estado confirmado: ${label(updated.status)}. Revisa el historial de la entrega.`); setConfirm(null); haptics.success();
      await Promise.all(['seller-fulfillments','seller-dashboard','orders','order'].map((name) => qc.invalidateQueries({ queryKey:[name] })));
    } catch (e) { setError((e as Error).message || 'No pudimos actualizar. Intenta de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const addr = f.ship_to && typeof f.ship_to === 'object' && !Array.isArray(f.ship_to) ? f.ship_to : {};
  return <><UnsavedChanges dirty={dirty} busy={busy} /><SellerScroll refresh={!dirty && !busy ? () => refresh() : undefined}>
    <Text variant="title">Pedido {f.order_number}</Text><Text color="textSecondary">Entrega {f.seq} · {store!.name}</Text>
    <Badge label={label(f.status)} tone={f.status === 'delivered' ? 'success' : 'brand'} />
    <Badge label={f.payment_level === 'full' ? 'Pago confirmado' : f.payment_level === 'down_payment' ? 'Anticipo confirmado' : 'Esperando pago'} tone={f.payment_level === 'none' ? 'warning' : 'success'} />
    <Card style={{ gap:12 }}><Text variant="subtitle">Qué sigue</Text><Text testID="seller-next-action" color="textSecondary">{current?.is_terminal || f.order_status === 'cancelled' ? 'Esta entrega está cerrada. Puedes consultar su historial.' : options.length ? `Puedes actualizar a «${chosen!.label}» cuando completes esa tarea.` : next && !next.seller_can_set ? 'El siguiente paso lo gestiona la plataforma. No necesitas actualizarlo desde tu tienda.' : 'Espera a que la plataforma confirme el pago requerido. No prepares ni despaches todavía.'}</Text></Card>
    <Card style={{ gap:12 }}><Text variant="subtitle">Productos de esta entrega</Text>{f.items.map((item) => <Text key={item.id}>{item.quantity} × {item.title}{item.variant_title && item.variant_title !== 'Única' ? ` · ${item.variant_title}` : ''}{item.refunded_qty ? ` · ${item.refunded_qty} reembolsadas` : ''}</Text>)}</Card>
    <Card style={{ gap:10 }}><Text variant="subtitle">Destino y transporte</Text><Text>{addr.anonymized ? `Datos anonimizados · ${String(addr.city ?? '')}` : [addr.recipient, addr.phone, addr.line1, addr.municipality, addr.city, addr.reference].filter(Boolean).join(' · ') || 'Sin dirección registrada'}</Text>
      <Text color="textSecondary">{f.shipping_method_name ?? 'Sin método de envío'}</Text><Text color="textSecondary">{f.carrier_name ?? 'Sin transportista registrado'}{f.tracking_number ? ` · guía ${f.tracking_number}` : ''}</Text>
    </Card>
    {options.length ? <Card style={{ gap:16 }}><Text variant="subtitle">Actualizar la entrega</Text>
      <SellerChoice label="Paso completado" testID="delivery-step" value={chosen!.code} items={options.map((s) => ({ value:s.code, label:s.label }))} disabled={busy} onChange={setStep} />
      {chosen && ['dispatched','in_transit','out_for_delivery'].includes(chosen.code) ? <><TextField testID="delivery-carrier" label="Empresa de envío" value={carrier} editable={!busy} onChangeText={setCarrier} /><TextField testID="delivery-tracking" label="Número de guía" value={tracking} editable={!busy} onChangeText={setTracking} /></> : null}
      <TextField testID="delivery-note" label="Nota para el cliente (opcional)" value={note} multiline editable={!busy} onChangeText={setNote} />
      <Button testID="delivery-review" title="Revisar actualización" full loading={busy && !confirm} disabled={!!confirm} onPress={review} />
    </Card> : null}
    {error && !confirm ? <Banner tone="danger" body={error} /> : null}{success ? <Banner tone="success" body={success} /> : null}
    <Card style={{ gap:12 }}><Text variant="subtitle">Historial de estados</Text>{f.fulfillment_events.length ? [...f.fulfillment_events].sort((a,b) => b.id-a.id).map((e) => <Text key={e.id} variant="bodySmall">{new Date(e.created_at).toLocaleString('es-VE')} · {label(e.step_code)}{e.note ? ` · ${e.note}` : ''}{e.source === 'seller' ? ' · tienda' : e.source === 'admin' ? ' · administración' : ''}{!e.visible_to_buyer ? ' · interno' : ''}</Text>) : <Text color="textSecondary">Sin cambios de estado registrados.</Text>}</Card>
    <AdvancedPanel path="/vendedor/pedidos" />
  </SellerScroll><ConfirmSheet testID="delivery-confirm" visible={!!confirm} title={`Actualizar a «${confirm?.label ?? ''}»`} body={`Confirma que completaste este paso para la entrega ${f.seq} del pedido ${f.order_number}. ${note.trim() ? `Nota: ${note.trim()}. ` : ''}${tracking.trim() ? `Guía: ${tracking.trim()}. ` : ''}El comprador podrá ver el avance.`} confirm="Confirmar actualización" danger={false} loading={busy} error={error} onClose={() => { if (!busy) { setConfirm(null); setError(null); } }} onConfirm={save} /></>;
}
