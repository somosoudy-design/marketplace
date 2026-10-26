import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { catalogImage } from '@/lib/supabase';
import { useProductExhibitionPhoto } from '@/lib/catalog-exhibition';
import { exhibitionSourceKey } from '@/lib/catalog-exhibition-policy';
import { useTheme } from '@/theme';

interface Props {
  productId?: string;
  variantId?: string;
  productIsDemo?: boolean;
  path: string | null | undefined;
  tone?: string | null;
  alt?: string;
  radius?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
  fit?: 'cover' | 'contain';
  onExhibitionError?: (key: string) => void;
  onExhibitionLoad?: (key: string) => void;
}

/** Every product photo sits on its category tone at 4:5, so mixed sources still look like one catalog. */
export function ProductImage({ productId, variantId, productIsDemo, path, tone, alt, radius, aspect, style, priority = 'normal', fit = 'cover', onExhibitionError, onExhibitionLoad }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const bg = t.tone(tone);
  const uri = catalogImage(path);
  const exhibition = useProductExhibitionPhoto(productId, path, variantId, productIsDemo);
  const exhibitionKey = exhibitionSourceKey(productId, path, exhibition);
  const [failed, setFailed] = useState<string>();
  const localPhoto = exhibition && failed !== exhibitionKey ? exhibition : undefined;
  return (
    <View testID={localPhoto ? `exhibition-photo-${productId}` : undefined} style={[{ aspectRatio: aspect ?? t.imagery.productAspect, backgroundColor: localPhoto?.kind === 'generated-demo' ? '#F5F4F1' : bg.bg, borderRadius: radius ?? t.radii.lg, overflow: 'hidden' }, style]}>
      {localPhoto || uri ? (
        <Image
          source={localPhoto?.source ?? { uri: uri! }}
          style={{ width: '100%', height: '100%' }}
          contentFit={localPhoto ? 'contain' : fit}
          transition={reduced ? 0 : 180}
          priority={priority}
          recyclingKey={localPhoto ? exhibitionKey : uri ?? undefined}
          onError={localPhoto && exhibitionKey ? () => { setFailed(exhibitionKey); onExhibitionError?.(exhibitionKey); } : undefined}
          onLoad={localPhoto && exhibitionKey ? () => onExhibitionLoad?.(exhibitionKey) : undefined}
          accessibilityLabel={alt ?? ''}
          accessible={!!alt}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
