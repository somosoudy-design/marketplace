import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, View, type View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useCartCount } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

// Web has no system tab bar: a custom bottom bar with the same four destinations.
const TABS: { name: string; href: '/' | '/explore' | '/cart' | '/account'; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Inicio', icon: 'house' },
  { name: 'explore', href: '/explore', label: 'Explorar', icon: 'search' },
  { name: 'cart', href: '/cart', label: 'Carrito', icon: 'shopping-bag' },
  { name: 'account', href: '/account', label: 'Cuenta', icon: 'user' },
];

const TabButton = forwardRef<RNView, TabTriggerSlotProps & { icon: IconName; label: string; badge?: number }>(function TabButton(
  { isFocused, icon, label, badge, ...props },
  ref,
) {
  const { colors } = useTheme();
  const color = isFocused ? colors.brand : colors.textMuted;
  return (
    <Pressable ref={ref} {...props} accessibilityRole="tab" aria-selected={!!isFocused} accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 }}>
      <View>
        <Icon name={icon} size={23} color={color} strokeWidth={isFocused ? 2.1 : 1.75} />
        {badge ? (
          <View style={{ position: 'absolute', right: -10, top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" style={{ color: '#fff', fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold' }}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" style={{ color, fontFamily: isFocused ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
});

export default function TabsLayoutWeb() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={{ flexDirection: 'row', backgroundColor: colors.tabBar, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom, justifyContent: 'center' }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton icon={t.icon} label={t.label} badge={t.name === 'cart' ? cartCount : undefined} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
