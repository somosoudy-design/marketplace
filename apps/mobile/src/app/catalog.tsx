import { Stack, useLocalSearchParams } from 'expo-router';
import { Catalog } from '@/components/catalog/Catalog';

/** Catalog pushed from Home (category or collection). Deep link: kora://catalog?category=tecnologia */
export default function CatalogScreen() {
  const p = useLocalSearchParams<{ category?: string; collection?: string; q?: string; title?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: p.title ?? 'Catálogo' }} />
      <Catalog
        testID="catalog-list"
        initial={{ category: p.category ?? null, collection: p.collection ?? null, query: p.q ?? '' }}
        locked={p.category || p.collection ? ['category'] : []}
      />
    </>
  );
}
