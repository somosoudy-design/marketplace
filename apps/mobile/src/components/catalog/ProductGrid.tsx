import type { ProductCard as Card } from '@kora/api';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';
import { ProductCard } from './ProductCard';

export const MAX_CONTENT = 1100;

export function useGridColumns() {
  const { width } = useWindowDimensions();
  const content = Math.min(width, MAX_CONTENT);
  const columns = content >= 900 ? 4 : content >= 600 ? 3 : 2;
  const gap = 14;
  const cardWidth = Math.floor((content - 32 - gap * (columns - 1)) / columns);
  return { columns, gap, cardWidth };
}

/** Horizontal product rail with a peek of the next card, so it reads as scrollable. */
export function ProductRail({ products, loading, testID }: { products: Card[]; loading?: boolean; testID?: string }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(Math.round((Math.min(width, MAX_CONTENT) - 32) / 2.35), 200);
  if (loading) {
    return (
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16 }}>
        {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} width={cardWidth} />)}
      </View>
    );
  }
  return (
    <FlatList
      testID={testID}
      horizontal
      data={products}
      keyExtractor={(p) => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
      snapToInterval={cardWidth + 14}
      decelerationRate="fast"
      renderItem={({ item, index }) => <ProductCard product={item} width={cardWidth} priority={index < 3 ? 'high' : 'normal'} />}
      initialNumToRender={4}
      windowSize={5}
    />
  );
}

export { ProductCard };
