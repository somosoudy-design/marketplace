import { useQuery } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { api } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Universal link https://<domain>/p/<slug> → product screen. Often the first screen of a cold start, so it always offers a way on. */
export default function ProductLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['slug', slug], queryFn: () => api.catalog.productIdBySlug(slug) });
  if (q.data) return <Redirect href={{ pathname: '/product/[id]', params: { id: q.data } }} />;
  if (q.isLoading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.colors.background }}><ActivityIndicator color={t.colors.brand} /></View>;
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 56, backgroundColor: t.colors.background }}>
      <View style={{ position: 'absolute', left: 16, top: insets.top + 8 }}>
        <IconButton icon="chevron-left" label="Volver" tone="surface" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <EmptyState icon="package" title="Este producto no está disponible" body="El enlace puede ser antiguo o el producto fue retirado por la tienda." action="Ver catálogo" onAction={() => router.replace('/explore')} />
      )}
    </View>
  );
}
