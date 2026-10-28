import type { CategorySummary } from '@kora/api';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { catalogImage } from '@/lib/supabase';
import { categoryExhibitionPhoto, useProductExhibitionPhoto } from '@/lib/catalog-exhibition';
import { useTheme } from '@/theme';

const SIZE = 58;
const COMPACT_SIZE = 48;

/** Compact category shelf: each category shows its most popular product on its tone, not an icon. */
export function CategoryTiles({ categories, compact = false }: { categories: CategorySummary[]; compact?: boolean }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: compact ? 16 : 10, gap: compact ? 10 : 0 }}>
      {categories.map((c) => {
        const tone = t.tone(c.tone);
        return (
          <ScalePressable
            key={c.id}
            testID={`category-${c.slug}`}
            accessibilityRole="link"
            accessibilityLabel={c.name}
            onPress={() => router.push({ pathname: '/catalog', params: { category: c.slug, title: c.name } })}
            style={compact ? { minWidth: 68, maxWidth: 144, minHeight: 44, alignItems: 'center', gap: 5, paddingVertical: 6 } : { width: SIZE + 22, alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: compact ? COMPACT_SIZE : SIZE, height: compact ? COMPACT_SIZE : SIZE, borderRadius: compact ? 12 : SIZE / 2, backgroundColor: tone.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <CategoryImage category={c} compact={compact} />
            </View>
            <Text variant="caption" numberOfLines={compact ? 2 : 1} align="center" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{c.name}</Text>
          </ScalePressable>
        );
      })}
    </ScrollView>
  );
}

function CategoryImage({ category: c, compact }: { category: CategorySummary; compact: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const candidate = compact && c.icon ? undefined : categoryExhibitionPhoto(c.image_path);
  const exhibition = useProductExhibitionPhoto(candidate?.productId, compact && c.icon ? null : c.image_path);
  const uri = catalogImage(c.image_path);
  if (compact && c.icon) return <Icon name={c.icon} size={24} color={t.scheme === 'dark' ? t.colors.text : t.tone(c.tone).dark} />;
  if (!exhibition && !uri) return <Icon name={c.icon ?? 'tag'} size={26} color={t.scheme === 'dark' ? t.colors.text : t.tone(c.tone).dark} />;
  return <Image source={exhibition?.source ?? { uri: uri! }} accessibilityLabel="" style={compact || exhibition ? { width: compact ? COMPACT_SIZE : SIZE, height: compact ? COMPACT_SIZE : SIZE } : { width: SIZE * 1.18, height: SIZE * 1.18 * 1.25, marginTop: SIZE * 0.08 }} contentFit={compact || exhibition ? 'contain' : 'cover'} transition={reduced ? 0 : 150} cachePolicy="memory-disk" accessible={false} />;
}
