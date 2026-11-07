import type { CategorySummary } from '@kora/api';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme';
import { ProductImage } from './ProductImage';
import { MAX_CONTENT } from './ProductGrid';

const categoryArtwork: Record<string, number> = {
  tecnologia: require('../../../assets/category-art/tecnologia.webp'),
  audio: require('../../../assets/category-art/audio.webp'),
  belleza: require('../../../assets/category-art/belleza.webp'),
  hogar: require('../../../assets/category-art/hogar.webp'),
  odontologia: require('../../../assets/category-art/odontologia.webp'),
  mascotas: require('../../../assets/category-art/mascotas.webp'),
  accesorios: require('../../../assets/category-art/accesorios.webp'),
};
const featuredOrder = ['tecnologia', 'audio', 'belleza', 'hogar'];

/** Category imagery is navigation only, never a product, price or stock claim. */
export function CategoryShowcase({ categories }: { categories: CategorySummary[] }) {
  const { width, fontScale } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_CONTENT);
  const tileWidth = contentWidth >= 360 && fontScale <= 1.25
    ? Math.min(140, Math.floor((contentWidth - 56) / 4))
    : Math.min(140, Math.max(100, Math.floor((contentWidth - 56) / 3.35)));
  const rank = (slug: string) => { const index = featuredOrder.indexOf(slug); return index < 0 ? featuredOrder.length : index; };
  const ordered = [...categories].sort((a, b) => rank(a.slug) - rank(b.slug));
  return (
    <ScrollView testID="home-categories-scroll" horizontal showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'flex-start' }}>
      {ordered.map((category) => <CategoryTile key={category.id} category={category} width={tileWidth} />)}
    </ScrollView>
  );
}

function CategoryTile({ category, width }: { category: CategorySummary; width: number }) {
  const t = useTheme();
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const [failedArt, setFailedArt] = useState<string>();
  useEffect(() => {
    if (!failedPhoto) return;
    let wasOffline = !onlineManager.isOnline();
    return onlineManager.subscribe(() => {
      if (!onlineManager.isOnline()) wasOffline = true;
      else if (wasOffline) setFailedPhoto(undefined);
    });
  }, [failedPhoto]);
  // Legacy sample files are not evidence of a current commercial photograph.
  const photo = category.image_path && !category.image_path.startsWith('demo/') && failedPhoto !== category.image_path ? category.image_path : null;
  const art = failedArt === category.slug ? undefined : categoryArtwork[category.slug];
  const isDentistry = category.slug === 'odontologia';
  // Optional syllable break; the accessible name and navigation retain the original name.
  const label = isDentistry ? category.name.replace(/^(odonto)(logía)$/i, '$1\u00ad$2') : category.name;
  return (
    <ScalePressable testID={`category-${category.slug}`} accessibilityRole="link" accessibilityLabel={category.name}
      onPress={() => router.push({ pathname: '/catalog', params: { category: category.slug, title: category.name } })}
      style={{ width, minHeight: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: t.colors.editorialSoft, borderWidth: 1, borderColor: t.colors.border }}>
      {art ? (
        <Image testID={`category-art-${category.slug}`} source={art} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" accessible={false} onError={() => setFailedArt(category.slug)} />
      ) : photo ? <View testID={`category-photo-${category.slug}`}><ProductImage path={photo} tone={category.tone} aspect={1} radius={0} style={{ width: '100%' }} onRemoteError={() => setFailedPhoto(photo)} /></View> : (
        <View testID={`category-fallback-${category.slug}`} style={{ width: '100%', aspectRatio: 1, backgroundColor: t.tone(category.tone).bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={category.icon ?? 'tag'} size={32} color={t.scheme === 'dark' ? t.colors.text : t.tone(category.tone).dark} />
        </View>
      )}
      <View style={{ minHeight: 30, paddingHorizontal: isDentistry ? 3 : 4, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID={`category-name-${category.slug}`} accessibilityLabel={category.name} variant="caption" align="center" style={[{ fontFamily: 'PlusJakartaSans_600SemiBold' }, isDentistry ? { alignSelf: 'stretch', minWidth: 0, maxWidth: '100%' } : undefined]}>{label}</Text>
      </View>
    </ScalePressable>
  );
}
