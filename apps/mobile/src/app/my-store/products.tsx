import { MODERATION_LABEL, presentAvailability } from '@kora/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
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
  const rows = q.data?.pages.flat() ?? [];
  return <SellerScroll refresh={() => q.refetch()} refreshing={q.isRefetching}>
    <Text variant="title">{store!.name}</Text><Text color="textSecondary">Tu catálogo, incluidos los productos pendientes de publicación. Consulta sus estados; la edición sigue disponible en el panel web.</Text>
    {q.isPending ? <SellerLoading /> : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <>
      {rows.length === 0 ? <EmptyState icon="package" title="Aún no tienes productos" body="Prepara tu primer producto desde el panel web. Cuando lo guardes, aparecerá aquí." /> : rows.map((p) => {
        const image = [...p.product_images].sort((a, b) => a.sort - b.sort)[0];
        return <Card testID={`seller-product-${p.id}`} key={p.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {image ? <Image source={{ uri: catalogImage(image.path) ?? undefined }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" accessibilityLabel={p.title} /> : null}
            <View style={{ flex: 1, gap: 6 }}><Text variant="subtitle" numberOfLines={2}>{p.title}</Text><Price usd={p.base_price_usd} size="sm" /><Text variant="bodySmall" color="textSecondary">{presentAvailability(p.availability).label}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><Badge label={MODERATION_LABEL[p.moderation_status] ?? 'Estado sin informar'} tone={p.moderation_status === 'published' ? 'success' : p.moderation_status === 'rejected' || p.moderation_status === 'suspended' ? 'danger' : 'warning'} />{p.is_demo ? <Badge label="Demo" /> : null}</View>
          {p.moderation_note ? <Text variant="bodySmall" color="textSecondary">{p.moderation_note}</Text> : null}
        </Card>;
      })}
      {q.isFetchNextPageError ? <ErrorState error={q.error} onRetry={() => q.fetchNextPage()} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.hasNextPage ? <Button testID="seller-products-more" title="Ver más productos" variant="secondary" full loading={q.isFetchingNextPage} onPress={() => q.fetchNextPage()} /> : null}
    </>}
    <AdvancedPanel path="/vendedor/productos" />
  </SellerScroll>;
}
