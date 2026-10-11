import { MODERATION_LABEL, presentAvailability } from '@kora/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AdvancedPanel, SellerLoading, SellerScreen, SellerScroll } from '@/components/seller/SellerScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { Price } from '@/components/ui/Price';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useSeller } from '@/lib/seller';
import { api, catalogImage } from '@/lib/supabase';

export default function SellerProductsScreen() { return <SellerScreen><Products /></SellerScreen>; }

function Products() {
  const { store } = useSeller();
  const { user } = useAuth();
  const q = useInfiniteQuery({ queryKey: ['seller-products', user!.id, store!.id], initialPageParam: 0,
    queryFn: ({ pageParam }) => api.seller.products(store!.id, pageParam),
    getNextPageParam: (last, pages) => last.length === 30 ? pages.length * 30 : undefined });
  const editor = useQuery({ queryKey: ['seller-editor-ready', user!.id], queryFn: api.seller.editorReady, staleTime: 0, refetchOnMount: 'always' });
  const rows = q.data?.pages.flat() ?? [];
  return <SellerScroll refresh={() => q.refetch()} refreshing={q.isRefetching}>
    <Text variant="title">{store!.name}</Text><Text color="textSecondary">Gestiona el catálogo de tu tienda y consulta sus estados de publicación.</Text>
    {editor.data ? <Button testID="seller-add-product" title="Agregar producto" icon="plus" full onPress={() => router.push('/my-store/product')} /> : editor.isError ? <ErrorState error={editor.error} onRetry={() => editor.refetch()} /> : editor.data === false ? <Text color="textSecondary">La edición móvil necesita una actualización del backend. Puedes usar el panel mientras tanto.</Text> : null}
    {q.isPending ? <SellerLoading /> : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <>
      {rows.length === 0 ? <EmptyState icon="package" title="Aún no tienes productos" body="Agrega tu primer producto con sus fotos, precio e inventario. Si la edición móvil no está habilitada, usa el panel web." /> : rows.map((p) => {
        const image = [...p.product_images].sort((a, b) => a.sort - b.sort)[0];
        return <Card testID={`seller-product-${p.id}`} key={p.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {image ? <Image source={{ uri: catalogImage(image.path) ?? undefined }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" accessibilityLabel={p.title} /> : null}
            <View style={{ flex: 1, gap: 6 }}><Text variant="subtitle" numberOfLines={2}>{p.title}</Text><Price usd={p.base_price_usd} size="sm" /><Text variant="bodySmall" color="textSecondary">{presentAvailability(p.availability).label}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Badge label={MODERATION_LABEL[p.moderation_status] ?? 'Estado sin informar'} tone={p.moderation_status === 'published' ? 'success' : p.moderation_status === 'rejected' || p.moderation_status === 'suspended' ? 'danger' : 'warning'} />{p.is_demo ? <Badge label="Demo" /> : null}</View>
          {editor.data ? <Button testID={`seller-edit-${p.id}`} title="Editar producto" variant="secondary" full onPress={() => router.push({ pathname: '/my-store/product', params: { id: p.id } })} /> : null}
          {p.moderation_note ? <Text variant="bodySmall" color="textSecondary">{p.moderation_note}</Text> : null}
        </Card>;
      })}
      {q.isFetchNextPageError ? <ErrorState error={q.error} onRetry={() => q.fetchNextPage()} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.hasNextPage ? <Button testID="seller-products-more" title="Ver más productos" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
    </>}
    <AdvancedPanel path="/vendedor/productos" />
  </SellerScroll>;
}
