import { router } from 'expo-router';
import { IconButton } from '@/components/ui/IconButton';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/hooks';
import { useTheme } from '@/theme';

/** A separate control beside the product link, so saving never opens the product by accident. */
export function ProductFavorite({ id, slug }: { id: string; slug: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const favorites = useFavorites();
  const saved = favorites.isFavorite(id);
  return (
    <IconButton
      testID={`card-favorite-${slug}`}
      icon="heart"
      label={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      size={44}
      tone="glass"
      color={saved ? colors.danger : colors.text}
      filled={saved}
      onPress={() => user ? favorites.toggle({ productId: id, on: !saved }) : router.push('/sign-in')}
    />
  );
}
