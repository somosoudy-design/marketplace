import type { ProductCard as Card } from '@kora/api';
import { useRef } from 'react';
import { FlatList, useWindowDimensions, View, type ViewToken } from 'react-native';
import { recordImpressions, useTrackingEnabled } from '@/lib/impressions';
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
export function ProductRail({ products, loading, testID, slot }: { products: Card[]; loading?: boolean; testID?: string; slot?: string }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(Math.round((Math.min(width, MAX_CONTENT) - 32) / 2.35), 200);
  const tracking = useTrackingEnabled();
  const dragged = useRef(false);
  // cards revealed by swiping sideways count as impressions; the first ones are counted by the enclosing TrackedSection
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Card>[] }) => {
    if (dragged.current && slotRef.current) recordImpressions(slotRef.current, viewableItems.map((v) => v.item.id));
  }).current;
  const slotRef = useRef<string | undefined>(undefined);
  slotRef.current = tracking ? slot : undefined;
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
      onScrollBeginDrag={() => (dragged.current = true)}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      renderItem={({ item, index }) => <ProductCard product={item} width={cardWidth} slot={slot} priority={index < 3 ? 'high' : 'normal'} />}
      initialNumToRender={4}
      windowSize={5}
    />
  );
}

export { ProductCard };
