import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useFulfillmentSteps } from '@/lib/hooks';
import { useSeller } from '@/lib/seller';
import { api } from '@/lib/supabase';

export default function SellerOrdersScreen() { return <SellerScreen><Orders /></SellerScreen>; }

function Orders() {
  const { store } = useSeller();
  const { user } = useAuth();
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const steps = useFulfillmentSteps();
  const q = useQuery({ queryKey: ['seller-fulfillments', user!.id, store!.id, scope], queryFn: () => api.seller.fulfillments(store!.id, scope) });
  const ready = useQuery({ queryKey: ['seller-orders-ready', user!.id], queryFn: api.seller.ordersReady, staleTime: 0, refetchOnMount: 'always' });
  const rows = q.data ?? [];
  return <SellerScroll refresh={() => q.refetch()} refreshing={q.isFetching && !q.isPending}>
    <Text variant="title">{store!.name}</Text><Text color="textSecondary">Solo las entregas de esta tienda. La plataforma confirma los pagos. Prepara y despacha cuando estén habilitados.</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button title="En curso" accessibilityLabel={scope === 'open' ? 'En curso, filtro activo' : 'Mostrar entregas en curso'} testID="seller-orders-open" variant={scope === 'open' ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setScope('open')} /><Button title="Cerrados" accessibilityLabel={scope === 'done' ? 'Cerrados, filtro activo' : 'Mostrar entregas cerradas'} testID="seller-orders-done" variant={scope === 'done' ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setScope('done')} /></View>
    {ready.isError ? <ErrorState error={ready.error} onRetry={() => ready.refetch()} /> : ready.data === false ? <Text color="textSecondary">Las acciones móviles aún no están habilitadas. Puedes consultar los pedidos o usar el panel.</Text> : null}
    {q.isPending ? <SellerLoading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState icon="receipt" title={scope === 'open' ? 'No hay entregas pendientes' : 'Sin entregas cerradas'} body={scope === 'open' ? 'Cuando recibas un pedido, su entrega aparecerá aquí.' : 'Se muestran las entregas terminadas o canceladas de los últimos 180 días.'} /> : rows.map((f) => <Card key={f.id} testID={`seller-order-${f.id}`} style={{ gap: 12 }}>
      <Text variant="subtitle">Pedido {f.order_number} · entrega {f.seq}</Text>
      <Text variant="caption" color="textSecondary">{new Date(f.placed_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Badge label={f.order_status === 'cancelled' ? 'Cancelado' : steps.data?.find((step) => step.flow === f.flow && step.code === f.status)?.label ?? 'Consulta el estado en el panel'} />
        <Badge label={f.payment_level === 'full' ? 'Pago confirmado' : f.payment_level === 'down_payment' ? 'Anticipo confirmado' : 'Esperando pago'} tone={f.payment_level === 'none' ? 'warning' : 'success'} /></View>
      {f.items.map((line) => <View key={line.id} style={{ gap: 2 }}><Text variant="label">{line.title}</Text><Text variant="bodySmall" color="textSecondary">{line.quantity} {line.quantity === 1 ? 'unidad' : 'unidades'}{line.variant_title && line.variant_title !== 'Única' ? ` · ${line.variant_title}` : ''}{line.refunded_qty ? ` · ${line.refunded_qty} reembolsadas` : ''}</Text></View>)}
      {f.shipping_method_name ? <Text variant="bodySmall" color="textSecondary">{f.shipping_method_name}</Text> : null}
      {f.tracking_number ? <Text variant="bodySmall" color="textSecondary">Guía: {f.tracking_number}{f.carrier_name ? ` · ${f.carrier_name}` : ''}</Text> : null}
      {ready.data ? <Button testID={`seller-open-delivery-${f.id}`} title="Ver entrega y acciones" variant="secondary" full onPress={() => router.push({ pathname: '/my-store/order', params: { id: f.id } })} /> : null}
    </Card>)}
    <Text variant="caption" color="textMuted">Máximo 200 entregas por vista; cerrados de los últimos 180 días. Para consultas avanzadas, usa el panel.</Text>
    <AdvancedPanel path="/vendedor/pedidos" />
  </SellerScroll>;
}

