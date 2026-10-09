import type { CategorySummary } from '@kora/api';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { catalogImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

const SIZE = 58;

/** Compact category shelf: each category shows its most popular product on its tone, not an icon. */
export function CategoryTiles({ categories }: { categories: CategorySummary[] }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 0 }}>
      {categories.map((c) => {
        const tone = t.tone(c.tone);
        const uri = catalogImage(c.image_path);
        return (
          <ScalePressable
            key={c.id}
            testID={`category-${c.slug}`}
            accessibilityRole="link"
            accessibilityLabel={c.name}
            onPress={() => router.push({ pathname: '/catalog', params: { category: c.slug, title: c.name } })}
            style={{ width: SIZE + 22, alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: tone.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {uri ? (
                <Image source={{ uri }} style={{ width: SIZE * 1.18, height: SIZE * 1.18 * 1.25, marginTop: SIZE * 0.08 }} contentFit="cover" transition={150} cachePolicy="memory-disk" accessible={false} />
              ) : (
                <Icon name={c.icon ?? 'tag'} size={26} color={t.scheme === 'dark' ? t.colors.text : tone.dark} />
              )}
            </View>
            <Text variant="caption" numberOfLines={1} align="center" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>{c.name}</Text>
          </ScalePressable>
        );
      })}
    </ScrollView>
  );
}
