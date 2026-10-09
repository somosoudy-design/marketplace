import { forwardRef, useState } from 'react';
import { Pressable as RNPressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@kora/design-tokens';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
}

/** Pressable with a short physical press response. Collapses to no motion when the OS asks for reduced motion. */
export const ScalePressable = forwardRef<View, ScalePressableProps>(function ScalePressable(
  { scaleTo = motion.pressScale, style, onPressIn, onPressOut, ...rest },
  ref,
) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Animated components take plain style objects, so a style callback is resolved here.
  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      ref={ref}
      onPressIn={(e) => {
        if (!reduced) scale.value = withSpring(scaleTo, motion.spring.snappy);
        if (typeof style === 'function') setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduced) scale.value = withSpring(1, motion.spring.snappy);
        if (typeof style === 'function') setPressed(false);
        onPressOut?.(e);
      }}
      style={[resolved, animated]}
      {...rest}
    />
  );
});
