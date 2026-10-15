import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { palette } from '@kora/design-tokens';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Bar pinned to the bottom edge (purchase, checkout, payment). Opaque on purpose: translucent bars without a
 * real blur let the content underneath ghost through the price and the button.
 */
export function BottomBar({ children, maxWidth = 760, testID, safeArea = true }: { children: ReactNode; maxWidth?: number; testID?: string; /** false inside tabs, where the tab bar already owns the bottom inset */ safeArea?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: (safeArea ? insets.bottom : 0) + 12,
        backgroundColor: t.colors.chrome,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.colors.borderStrong,
        shadowColor: palette.ink[900],
        shadowOpacity: t.scheme === 'dark' ? 0 : 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 6,
      }}
    >
      <View style={{ width: '100%', maxWidth, alignSelf: 'center', gap: 10 }}>{children}</View>
    </View>
  );
}

/** Amount that cross-fades when it changes, so a recalculated total reads as an update rather than a glitch. */
export function ChangingText({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Animated.View key={value} entering={FadeIn.duration(180)}>
      {children}
    </Animated.View>
  );
}

/**
 * Scroll position for screens whose header changes as the hero scrolls away. `onJS` receives the visible window
 * on the JS thread, at most every `step` points of travel, for work that does not need every frame.
 */
export function useScrollY(onJS?: (y: number, height: number) => void, step = 48) {
  const y = useSharedValue(0);
  const sent = useSharedValue(-1000);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
    if (onJS && Math.abs(e.contentOffset.y - sent.value) >= step) {
      sent.value = e.contentOffset.y;
      scheduleOnRN(onJS, e.contentOffset.y, e.layoutMeasurement.height);
    }
  });
  return { y, onScroll };
}

/**
 * Header for screens that open on a full-bleed hero (product, store). Over the hero only the floating controls
 * show; once the hero scrolls away an opaque bar fades in with the title, so controls never sit on top of text.
 */
export function CollapsingHeader({ y, threshold, title, left, right }: { y: SharedValue<number>; threshold: number; title?: string; left?: ReactNode; right?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // the bar is fully opaque by the time the photo's lower edge reaches the bar's own lower edge, so nothing of the
  // photo (or its "imagen demo" badge) is left showing through behind the buttons
  const barHeight = insets.top + 60;
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [threshold - barHeight - 60, threshold - barHeight], [0, 1], Extrapolation.CLAMP) }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [threshold - 40, threshold], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [threshold - 40, threshold], [6, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.chrome, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.borderStrong }, bar]}
      />
      <View pointerEvents="box-none" style={{ paddingTop: insets.top + 8, paddingBottom: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {left}
        <Animated.View pointerEvents="none" style={[{ flex: 1 }, label]} importantForAccessibility="no-hide-descendants">
          {title ? <Text variant="subtitle" numberOfLines={1}>{title}</Text> : null}
        </Animated.View>
        {right}
      </View>
    </View>
  );
}
