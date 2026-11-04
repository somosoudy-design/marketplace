import { router } from 'expo-router';
import { colors as colorTokens } from '@kora/design-tokens';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ScalePressable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/lib/hooks';
import { useTheme } from '@/theme';

/** One favorite interaction for cards and detail; the touch target never shrinks with the icon. */
type Props = { id: string; slug: string; onPhoto?: boolean; testID?: string };
export function ProductFavorite(props: Props) {
  const { user } = useAuth();
  return <FavoriteControl key={`${user?.id ?? 'guest'}:${props.id}`} {...props} />;
}
function FavoriteControl({ id, slug, onPhoto = false, testID }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const favorites = useFavorites();
  const saved = favorites.isFavorite(id);
  const pending = favorites.isPending(id);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const ring = useSharedValue(1);
  const [failed, setFailed] = useState(false);
  const [retryOn, setRetryOn] = useState(false);
  const color = saved ? onPhoto ? colorTokens.light.brand : colors.brand : onPhoto ? colorTokens.light.text : colors.textSecondary;
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: (1 - ring.value) * 0.5, transform: [{ scale: 0.65 + ring.value * 0.7 }] }));
  const save = async (on: boolean) => {
    if (!user) { router.push('/sign-in'); return; }
    setRetryOn(on);
    if (favorites.error) {
      const result = await favorites.retry();
      if (result.isError) { setFailed(true); return; }
    }
    const accepted = favorites.toggle({ productId: id, on }, {
      onSuccess: () => setFailed(false),
      onError: () => { setFailed(true); haptics.warning(); },
    });
    if (!accepted) return;
    setFailed(false);
    haptics.select();
    if (!reduced) {
      scale.value = withSequence(withTiming(on ? 1.23 : 0.85, { duration: 90 }), withTiming(1, { duration: 150 }));
      if (on) { ring.value = 0; ring.value = withTiming(1, { duration: 260 }); }
    }
  };
  return <>
    <ScalePressable
      testID={testID ?? `card-favorite-${slug}`}
      accessibilityRole="button"
      accessibilityLabel={favorites.error ? 'Reintentar favoritos' : saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      accessibilityState={{ selected: saved, busy: pending, disabled: pending || favorites.loading }}
      aria-pressed={saved}
      aria-busy={pending}
      disabled={pending || favorites.loading}
      scaleTo={1}
      focusInset
      focusBackground={colors.surface}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      onPress={() => save(!saved)}
    >
      <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: onPhoto ? colorTokens.light.surface : 'transparent' }}>
        {!reduced ? <Animated.View pointerEvents="none" accessible={false} style={[{ position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: onPhoto ? colorTokens.light.brand : colors.brand }, ringStyle]} /> : null}
        <Animated.View style={heartStyle}><Icon name="heart" size={19} color={color} fill={saved ? color : 'none'} strokeWidth={1.8} /></Animated.View>
      </View>
    </ScalePressable>
    <Sheet visible={failed && !!user} title="No pudimos actualizar favoritos" testID="favorite-error" onClose={() => setFailed(false)} footer={<Button title="Reintentar" onPress={() => save(retryOn)} loading={pending || favorites.refreshing} />}>
      <Text variant="bodySmall" accessibilityRole="alert">El cambio no se guardó. Revisa tu conexión e inténtalo de nuevo.</Text>
    </Sheet>
  </>;
}
