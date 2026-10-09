import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT, ProductCard, useGridColumns } from '@/components/catalog/ProductGrid';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState, OfflineState, waitingForNetwork } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/hooks';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function FavoritesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const grid = useGridColumns();
  const { user } = useAuth();
  const fav = useFavorites();
  const products = useQuery({ queryKey: ['favorite-products', [...fav.ids].sort().join(',')], queryFn: api.account.favoriteProducts, enabled: !!user });
  const header = <Text variant="displayL" style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 16 }}>Favoritos</Text>;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background }}>
        {header}
        <EmptyState icon="heart" title="Guarda lo que te gusta" body="Inicia sesión para guardar productos y recibir avisos cuando vuelvan a estar disponibles." action="Iniciar sesión" onAction={() => router.push('/sign-in')} />
      </View>
    );
  }
  const items = (products.data ?? []).filter((p) => fav.ids.has(p.id));
  return (
    <FlatList
      key={grid.columns}
      data={items}
      numColumns={grid.columns}
      keyExtractor={(p) => p.id}
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingBottom: 40, width: '100%', maxWidth: MAX_CONTENT, alignSelf: 'center' }}
      columnWrapperStyle={grid.columns > 1 ? { gap: grid.gap, paddingHorizontal: 16 } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ProductCard product={item} width={grid.cardWidth} />}
      ListEmptyComponent={
        products.isLoading ? (
          <View style={{ flexDirection: 'row', gap: grid.gap, paddingHorizontal: 16 }}>{[0, 1].map((i) => <ProductCardSkeleton key={i} width={grid.cardWidth} />)}</View>
        ) : waitingForNetwork(products) ? (
          <OfflineState />
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : (
          <EmptyState icon="heart" title="Aún no tienes favoritos" body="Toca el corazón en cualquier producto para guardarlo aquí." action="Explorar" onAction={() => router.navigate('/explore')} />
        )
      }
    />
  );
}
