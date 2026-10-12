import type { CategorySummary } from '@kora/api';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { catalogImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

const SIZE = 58;

/** Compact category shelf: each category shows its most popular product on its tone, not an icon. */
export function CategoryTiles({ categories, compact = false }: { categories: CategorySummary[]; compact?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: compact ? 16 : 10, gap: compact ? 16 : 0 }}>
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
            style={compact ? { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 } : { width: SIZE + 22, alignItems: 'center', gap: 6 }}
          >
            <View style={{ width: compact ? 28 : SIZE, height: compact ? 28 : SIZE, borderRadius: compact ? 6 : SIZE / 2, backgroundColor: tone.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {uri ? (
                <Image source={{ uri }} accessibilityLabel="" style={compact ? { width: 28, height: 28 } : { width: SIZE * 1.18, height: SIZE * 1.18 * 1.25, marginTop: SIZE * 0.08 }} contentFit={compact ? 'contain' : 'cover'} transition={reduced ? 0 : 150} cachePolicy="memory-disk" accessible={false} />
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
