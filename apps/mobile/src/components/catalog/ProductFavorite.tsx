import { router } from 'expo-router';
import { colors as colorTokens } from '@kora/design-tokens';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/hooks';
import { useTheme } from '@/theme';

/** A separate control beside the product link, so saving never opens the product by accident. */
export function ProductFavorite({ id, slug, onPhoto = false }: { id: string; slug: string; onPhoto?: boolean }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const favorites = useFavorites();
  const saved = favorites.isFavorite(id);
  return (
    <ScalePressable
      testID={`card-favorite-${slug}`}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      accessibilityState={{ selected: saved }}
      aria-pressed={saved}
      scaleTo={0.9}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      onPress={() => { haptics.tap(); if (user) favorites.toggle({ productId: id, on: !saved }); else router.push('/sign-in'); }}
    >
      <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: onPhoto ? colorTokens.light.surface : 'transparent' }}>
        <Icon name="heart" size={19} color={saved ? onPhoto ? colorTokens.light.brand : colors.brand : onPhoto ? colorTokens.light.text : colors.textSecondary} fill={saved ? onPhoto ? colorTokens.light.brand : colors.brand : 'none'} strokeWidth={1.8} />
      </View>
    </ScalePressable>
  );
}
