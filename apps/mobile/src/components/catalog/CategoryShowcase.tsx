import type { CategorySummary } from '@kora/api';
import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { MAX_CONTENT } from './ProductGrid';

/** One truthful category destination per tile; images come only from the published catalog feed. */
export function CategoryShowcase({ categories }: { categories: CategorySummary[] }) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_CONTENT);
  const tileWidth = Math.min(140, Math.max(106, Math.floor((contentWidth - 56) / 3.35)));
  return (
    <ScrollView testID="home-categories-scroll" horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {categories.map((category) => <CategoryTile key={category.id} category={category} width={tileWidth} />)}
    </ScrollView>
  );
}

function CategoryTile({ category, width }: { category: CategorySummary; width: number }) {
  const t = useTheme();
  // Legacy sample files are not evidence of a current commercial photograph.
  const photo = category.image_path && !category.image_path.startsWith('demo/') ? category.image_path : null;
  return (
    <ScalePressable testID={`category-${category.slug}`} accessibilityRole="link" accessibilityLabel={category.name}
      onPress={() => router.push({ pathname: '/catalog', params: { category: category.slug, title: category.name } })}
      style={{ width, minHeight: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
      {photo ? <View testID={`category-photo-${category.slug}`}><ProductImage path={photo} tone={category.tone} aspect={1} radius={0} style={{ width: '100%' }} /></View> : (
        <View testID={`category-fallback-${category.slug}`} style={{ width: '100%', aspectRatio: 1, backgroundColor: t.tone(category.tone).bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={category.icon ?? 'tag'} size={32} color={t.scheme === 'dark' ? t.colors.text : t.tone(category.tone).dark} />
        </View>
      )}
      <View style={{ minHeight: 40, paddingHorizontal: 5, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" align="center" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{category.name}</Text>
      </View>
    </ScalePressable>
  );
}
