import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCartCount } from '@/lib/hooks';
import { useTheme } from '@/theme';
import { ScreenErrorBoundary } from '@/components/ErrorBoundary';

export const ErrorBoundary = ScreenErrorBoundary;

// System tab bar (UITabBarController / Material bottom navigation). Product, checkout and other flows are pushed on
// the root stack, so the tab bar is naturally hidden there and each tab keeps its scroll and filters underneath.
// Four destinations, each with its label (Material hides the labels of unselected items by default). Favorites is
// a saved list rather than a place to browse: it opens from the heart next to notifications and from Account.
export default function TabsLayout() {
  const { colors } = useTheme();
  const cartCount = useCartCount();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.brandSoft}
      tintColor={colors.brand}
      labelStyle={{ selected: { color: colors.brand } }}
      labelVisibilityMode="labeled"
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Buscar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <NativeTabs.Trigger.Label>Carrito</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="shopping_bag" />
        {cartCount > 0 ? <NativeTabs.Trigger.Badge>{cartCount > 9 ? '9+' : String(cartCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Cuenta</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
