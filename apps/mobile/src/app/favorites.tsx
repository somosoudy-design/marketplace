import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { MAX_CONTENT, ProductCard, useGridColumns } from '@/components/catalog/ProductGrid';
import { ExhibitionNotice } from '@/components/catalog/ExhibitionNotice';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { Banner, EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { authTarget } from '@/lib/auth-navigation';
import { useFavorites } from '@/lib/hooks';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function FavoritesScreen() {
  const t = useTheme();
  const grid = useGridColumns();
  const { user } = useAuth();
  const fav = useFavorites();
  const guestIds = user ? [] : [...fav.ids];
  const ownPendingIds = user ? fav.pendingIds : [];
  // Keep the authenticated query stable: pending removals retain the existing card/error/retry flow.
  const accountProducts = useQuery({ queryKey: ['favorite-products', user?.id], queryFn: () => api.account.favoriteProductsForBuyer(user!.id), enabled: !!user && !fav.syncing });
  const guestProducts = useQuery({ queryKey: ['guest-favorite-products', guestIds.join(',')], queryFn: () => api.catalog.cardsByIds(guestIds), enabled: !user && !fav.loading && !fav.error && guestIds.length > 0 });
  const pendingProducts = useQuery({ queryKey: ['pending-favorite-products', user?.id, ownPendingIds.join(',')], queryFn: () => api.catalog.cardsByIds(ownPendingIds), enabled: !!user && ownPendingIds.length > 0 });
  const products = user ? accountProducts : guestProducts;
  const all = user ? [...(accountProducts.data ?? []), ...(pendingProducts.data ?? [])] : guestProducts.data ?? [];
  const items = [...new Map(all.map(product => [product.id, product])).values()].filter(product => fav.loading || fav.ids.has(product.id) || fav.isPending(product.id));
  const header = items.length ? (
    <Text variant="bodySmall" color="textMuted" style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }} testID="favorites-count">
      {items.length === 1 ? '1 producto guardado' : `${items.length} productos guardados`}
    </Text>
  ) : <View style={{ height: 16 }} />;
  const syncNotice = fav.syncError ? <View testID="favorites-sync-pending" style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
    <Banner tone="warning" title="Favoritos por incorporar" body={fav.syncError} />
    <Button testID="favorites-sync-retry" title="Reintentar" variant="secondary" loading={fav.syncing} onPress={() => { void fav.retrySync().catch(() => undefined); }} />
  </View> : null;
  const readNotice = fav.error && items.length ? <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
    <Banner tone="danger" body={(fav.error as Error).message || 'No pudimos actualizar tus favoritos.'} />
    <Button title="Reintentar" variant="secondary" onPress={() => { void fav.retry(); }} />
  </View> : null;
  return (
    <FlatList
      testID="favorites-list"
      key={grid.columns}
      data={items}
      numColumns={grid.columns}
      keyExtractor={product => product.id}
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingBottom: 40, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
      columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap, paddingHorizontal: 16 } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
      ListHeaderComponent={<View><View style={{ paddingHorizontal: 16 }}><ExhibitionNotice /></View>{syncNotice}{readNotice}{header}</View>}
      ListFooterComponent={!user && items.length ? <View style={{ padding: 16 }}><Button title="Iniciar sesión" variant="secondary" onPress={() => router.push(authTarget('/sign-in', '/favorites'))} /></View> : null}
      renderItem={({ item }) => <ProductCard product={item} width={grid.cardWidth} />}
      ListEmptyComponent={
        !user && fav.error ? (
          <ErrorState error={fav.error} onRetry={() => fav.retry()} />
        ) : !user && waitingForNetwork(products) ? (
          <EmptyState icon="wifi-off" title="Sin conexión" body="Tus favoritos siguen guardados. Los productos se mostrarán cuando vuelva la conexión." />
        ) : products.isLoading || fav.loading ? (
          <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16 }}>{[0, 1].map(i => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}</View>
        ) : waitingForNetwork(products) ? (
          <OfflineState />
        ) : fav.error ? (
          <ErrorState error={fav.error} onRetry={() => fav.retry()} />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : pendingProducts.isError && ownPendingIds.length ? (
          <ErrorState error={pendingProducts.error} onRetry={() => pendingProducts.refetch()} />
        ) : fav.ids.size ? (
          <EmptyState icon="heart" title="No pudimos mostrar estos productos" body="Tu selección sigue guardada. Reintenta para consultar su disponibilidad." action="Reintentar" onAction={() => products.refetch()} />
        ) : (
          <EmptyState icon="heart" title="Aún no tienes favoritos" body="Toca el corazón en cualquier producto para guardarlo aquí." action="Explorar" onAction={() => router.navigate('/explore')} />
        )
      }
    />
  );
}
