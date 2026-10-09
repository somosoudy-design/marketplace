import type { CategorySummary } from '@kora/api';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';

export function CategoryTiles({ categories }: { categories: CategorySummary[] }) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
      {categories.map((c) => {
        const tone = t.tone(c.tone);
        return (
          <ScalePressable
            key={c.id}
            testID={`category-${c.slug}`}
            accessibilityRole="link"
            accessibilityLabel={c.name}
            onPress={() => router.push({ pathname: '/catalog', params: { category: c.slug, title: c.name } })}
            style={{ width: 76, alignItems: 'center', gap: 8 }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.icon ?? 'tag'} size={26} color={t.scheme === 'dark' ? t.colors.text : tone.dark} />
            </View>
            <Text variant="caption" numberOfLines={2} align="center" style={{ fontFamily: 'Manrope_600SemiBold' }}>{c.name}</Text>
          </ScalePressable>
        );
      })}
    </ScrollView>
  );
}
