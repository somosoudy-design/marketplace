import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, useEffect } from 'react';
import { Pressable, View, useWindowDimensions, type View as RNView } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountBadge } from '@/components/ui/CountBadge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useCartCount } from '@/lib/hooks';
import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DESTINATIONS: { name: string; href: '/' | '/explore' | '/cart' | '/account'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Inicio', icon: 'house' },
  { name: 'explore', href: '/explore', label: 'Buscar', icon: 'search' },
  { name: 'cart', href: '/cart', label: 'Carrito', icon: 'shopping-bag' },
  { name: 'account', href: '/account', label: 'Cuenta', icon: 'user' },
];

const TabButton = forwardRef<RNView, TabTriggerSlotProps & { name: string; icon: IconName; label: string; badge?: number }>(function TabButton(
  { isFocused, name, icon, label, badge = 0, onPress, ...props }, ref,
) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const focus = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    focus.value = withTiming(isFocused ? 1 : 0, { duration: reduced ? 0 : 180, easing: Easing.out(Easing.quad) });
  }, [focus, isFocused, reduced]);
  const expandedGrow = fontScale > 1.2 ? 2.8 : 2.2;
  const button = useAnimatedStyle(() => ({
    flexGrow: 1 + focus.value * (expandedGrow - 1),
    backgroundColor: interpolateColor(focus.value, [0, 1], [colors.surface, colors.brandSoft]),
  }));
  const caption = useAnimatedStyle(() => ({ width: focus.value * (label.length * 7.5 * fontScale + 8), opacity: focus.value }));
  const color = isFocused ? colors.brand : colors.textSecondary;
  const countLabel = badge > 0 ? `Carrito, ${badge} ${badge === 1 ? 'producto' : 'productos'}` : label;
  return (
    <AnimatedPressable
      ref={ref} {...props}
      testID={`buyer-tab-${name}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      aria-selected={!!isFocused}
      accessibilityLabel={countLabel}
      onPress={(event) => { if (!isFocused) haptics.select(); onPress?.(event); }}
      style={[{ flexBasis: 0, minWidth: 44, height: 48, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, button]}
    >
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={23} color={color} strokeWidth={isFocused ? 2.2 : 1.8} />
        <CountBadge count={badge} testID="tab-cart-count" />
      </View>
      <Animated.View style={[{ overflow: 'hidden', flexShrink: 1 }, caption]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {isFocused ? <Text testID="active-tab-label" variant="caption" numberOfLines={1} style={{ marginLeft: 8, color, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12 }}>{label}</Text> : null}
      </Animated.View>
    </AnimatedPressable>
  );
});

/** One JS tab bar for the installed APK and web. Inactive screens keep their filters and scroll. */
export function BuyerTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cartCount = useCartCount();
  return (
    <Tabs options={{ backBehavior: 'history' }} style={{ flex: 1, backgroundColor: colors.background }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList
        testID="buyer-tab-bar"
        accessibilityRole="tablist"
        accessibilityLabel="Navegación principal"
        style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 28, padding: 7, marginTop: 6, marginBottom: Math.max(insets.bottom, 8), width: Math.min(width - 24, 520), alignSelf: 'center' }}
      >
        {DESTINATIONS.map((destination) => (
          <TabTrigger key={destination.name} name={destination.name} href={destination.href} asChild>
            <TabButton name={destination.name} icon={destination.icon} label={destination.label} badge={destination.name === 'cart' ? cartCount : undefined} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
