import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';

export function Skeleton({ width = '100%', height = 14, radius, style }: { width?: DimensionValue; height?: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors, radii } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) o.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius ?? radii.sm, backgroundColor: colors.skeleton }, a, style]}
    />
  );
}

export function ProductCardSkeleton({ width }: { width: number }) {
  const { radii, colors } = useTheme();
  return (
    <View style={{ width, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Skeleton height={(width - 2) * 1.25} radius={0} />
      <View style={{ padding: 10, gap: 8 }}>
        <Skeleton width="90%" height={12} />
        <Skeleton width="45%" height={18} />
      </View>
    </View>
  );
}
