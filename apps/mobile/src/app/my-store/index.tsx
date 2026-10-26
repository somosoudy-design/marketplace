import { isPrivateCatalogPresentation } from '@/lib/catalog-exhibition';
import type { ModerationStatus } from '@kora/api';
import { MODERATION_LABEL, STORE_STATUS_LABEL } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Divider, ListRow } from '@/components/ui/Layout';
import { ScalePressable } from '@/components/ui/Pressable';
import { ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useSeller } from '@/lib/seller';
import { api, storeImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function MyStoreScreen() { return <SellerScreen><Dashboard /></SellerScreen>; }

function Dashboard() {
  const t = useTheme();
  const { user } = useAuth();
  const { store, access, selectStore } = useSeller();
  const s = store!;
  const q = useQuery({ queryKey: ['seller-dashboard', user!.id, s.id], queryFn: () => api.seller.dashboard(s.id) });
  const d = q.data;
  const total = Object.values(d?.products ?? {}).reduce((sum, count) => sum + count, 0);
  return <SellerScroll refreshing={q.isFetching && !q.isPending} refresh={() => { access.refetch(); q.refetch(); }}>
    {access.data!.stores.length > 1 ? <View style={{ gap: 8 }}>
      <Text variant="label">Elige tu tienda</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{access.data!.stores.map((item) => <ScalePressable key={item.id} testID={`seller-store-${item.id}`} accessibilityRole="button" accessibilityLabel={`Administrar ${item.name}`} accessibilityState={{ selected: item.id === s.id }} aria-pressed={item.id === s.id} onPress={() => selectStore(item.id)}
        style={{ minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: t.radii.md, borderWidth: 1, borderColor: item.id === s.id ? t.colors.brand : t.colors.border, backgroundColor: item.id === s.id ? t.colors.brandSoft : t.colors.surface }}><Text variant="label" color={item.id === s.id ? 'brand' : 'text'} numberOfLines={2}>{item.name}</Text></ScalePressable>)}</View>
    </View> : null}
    <Card style={{ gap: 14, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {s.logo_path ? <Image accessibilityLabel={`Logotipo de ${s.name}`} source={{ uri: storeImage(s.logo_path) ?? undefined }} style={{ width: 64, height: 64, borderRadius: 16 }} contentFit="contain" /> : <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: t.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="store" size={28} color={t.colors.brand} /></View>}
        <View style={{ flex: 1, gap: 6 }}><Text variant="overline" color="textMuted">Tu negocio</Text><Text variant="displayM" testID="seller-store-name">{s.name}</Text></View>
      </View>
      {s.tagline ? <Text color="textSecondary">{s.tagline}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Badge label={STORE_STATUS_LABEL[s.status] ?? 'Estado sin informar'} tone={s.status === 'active' ? 'success' : 'warning'} />{s.is_demo && !isPrivateCatalogPresentation ? <Badge label="Tienda de demostración" /> : null}</View>
    </Card>
    {q.isPending ? <SellerLoading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <>
      <Text variant="title">Tu tienda de un vistazo</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat title="Productos" value={total} testID="seller-product-count" />
        <Stat title="Por preparar" value={d!.to_prepare} testID="seller-prepare-count" />
        <Stat title="En camino" value={d!.in_transit} testID="seller-transit-count" />
      </View>
      <Card style={{ gap: 12 }}><Text variant="subtitle">Estado de tus productos</Text>
        {total === 0 ? <Text variant="bodySmall" color="textSecondary">Aún no tienes productos. Puedes preparar tu catálogo desde el panel web.</Text> : Object.entries(MODERATION_LABEL).map(([key, label]) => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text variant="bodySmall" color="textSecondary">{label}</Text><Text variant="label" tabular>{d!.products?.[key as ModerationStatus] ?? 0}</Text></View>)}
      </Card>
    </>}
    <Card padded={false}>
      <ListRow testID="seller-products-link" icon="package" title="Mis productos" subtitle="Consulta tu catálogo y sus estados" onPress={() => router.push('/my-store/products')} /><Divider inset={68} />
      <ListRow testID="seller-orders-link" icon="receipt" title="Pedidos" subtitle="Entregas recibidas y seguimiento" onPress={() => router.push('/my-store/orders')} /><Divider inset={68} />
      <ListRow testID="seller-settings-link" icon="settings" title="Configuración de tienda" subtitle="Datos y políticas de tu negocio" onPress={() => router.push('/my-store/settings')} />
    </Card>
    <AdvancedPanel />
    <Button testID="seller-buy" title="Volver a comprar" variant="ghost" full onPress={() => router.dismissTo('/account')} />
  </SellerScroll>;
}

function Stat({ title, value, testID }: { title: string; value: number; testID: string }) {
  return <Card style={{ flexGrow: 1, flexBasis: 90, gap: 6 }}><Text variant="displayM" tabular testID={testID}>{value}</Text><Text variant="bodySmall" color="textSecondary">{title}</Text></Card>;
}
