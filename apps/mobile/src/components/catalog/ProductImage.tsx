import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { catalogImage } from '@/lib/supabase';
import { useTheme } from '@/theme';

interface Props {
  path: string | null | undefined;
  tone?: string | null;
  alt?: string;
  radius?: number;
  aspect?: number;
  style?: StyleProp<ViewStyle>;
  priority?: 'low' | 'normal' | 'high';
}

/** Every product photo sits on its category tone at 4:5, so mixed sources still look like one catalog. */
export function ProductImage({ path, tone, alt, radius, aspect, style, priority = 'normal' }: Props) {
  const t = useTheme();
  const bg = t.tone(tone);
  const uri = catalogImage(path);
  return (
    <View style={[{ aspectRatio: aspect ?? t.imagery.productAspect, backgroundColor: bg.bg, borderRadius: radius ?? t.radii.lg, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={180}
          priority={priority}
          recyclingKey={uri}
          accessibilityLabel={alt}
          accessible={!!alt}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
