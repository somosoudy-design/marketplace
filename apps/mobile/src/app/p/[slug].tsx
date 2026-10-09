import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { EmptyState } from '@/components/ui/States';
import { api } from '@/lib/supabase';

/** Universal link https://<domain>/p/<slug> → product screen. */
export default function ProductLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['slug', slug], queryFn: () => api.catalog.productIdBySlug(slug) });
  if (q.data) return <Redirect href={{ pathname: '/product/[id]', params: { id: q.data } }} />;
  if (q.isLoading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <EmptyState icon="package" title="No encontramos ese producto" />;
}
