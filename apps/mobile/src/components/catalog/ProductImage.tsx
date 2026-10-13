import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { catalogImage } from '@/lib/supabase';
import { productExhibitionPhoto } from '@/lib/catalog-exhibition';
import { useTheme } from '@/theme';

interface Props {
  productId?: string;
  path: string | null | undefined;
  tone?: string | null;
  alt?: string;
  radius?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
  fit?: 'cover' | 'contain';
}

/** Every product photo sits on its category tone at 4:5, so mixed sources still look like one catalog. */
export function ProductImage({ productId, path, tone, alt, radius, aspect, style, priority = 'normal', fit = 'cover' }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const bg = t.tone(tone);
  const uri = catalogImage(path);
  const exhibition = productExhibitionPhoto(productId, path);
  const exhibitionKey = exhibition ? `${productId}:${exhibition.sha256}:${path}` : undefined;
  const [failed, setFailed] = useState<string>();
  const localPhoto = exhibition && failed !== exhibitionKey ? exhibition : undefined;
  return (
    <View style={[{ aspectRatio: aspect ?? t.imagery.productAspect, backgroundColor: bg.bg, borderRadius: radius ?? t.radii.lg, overflow: 'hidden' }, style]}>
      {localPhoto || uri ? (
        <Image
          source={localPhoto?.source ?? { uri: uri! }}
          style={{ width: '100%', height: '100%' }}
          contentFit={localPhoto ? 'contain' : fit}
          transition={reduced ? 0 : 180}
          priority={priority}
          recyclingKey={localPhoto ? exhibitionKey : uri ?? undefined}
          onError={localPhoto ? () => setFailed(exhibitionKey) : undefined}
          accessibilityLabel={alt ?? ''}
          accessible={!!alt}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
