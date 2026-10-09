import type { StoreSummary } from '@kora/api';
import { storeAccents } from '@kora/design-tokens';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { storeImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

export function StoreCard({ store, width }: { store: StoreSummary; width: number }) {
  const t = useTheme();
  const accent = storeAccents[store.accent as keyof typeof storeAccents] ?? t.colors.brand;
  return (
    <ScalePressable
      testID={`store-${store.slug}`}
      accessibilityRole="link"
      accessibilityLabel={`Tienda ${store.name}`}
      onPress={() => router.push({ pathname: '/store/[slug]', params: { slug: store.slug } })}
      style={{ width, backgroundColor: t.colors.surface, borderRadius: t.radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border }}
    >
      <View style={{ aspectRatio: 16 / 9, backgroundColor: accent }}>
        {store.cover_path ? <Image source={{ uri: storeImage(store.cover_path) ?? undefined }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={{ padding: 12, paddingTop: 30, gap: 4 }}>
        <View style={{ position: 'absolute', top: -26, left: 12, width: 52, height: 52, borderRadius: 16, backgroundColor: t.colors.surface, padding: 3, ...t.elevation.low }}>
          {store.logo_path ? (
            <Image source={{ uri: storeImage(store.logo_path) ?? undefined }} style={{ flex: 1, borderRadius: 13 }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, borderRadius: 13, backgroundColor: accent }} />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>{store.name}</Text>
          {store.kind === 'platform' ? <Badge label="Oficial" tone="brand" /> : null}
        </View>
        {store.tagline ? <Text variant="caption" color="textMuted" numberOfLines={2}>{store.tagline}</Text> : null}
      </View>
    </ScalePressable>
  );
}
