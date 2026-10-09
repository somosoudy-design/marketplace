import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useOnline } from '@/lib/query';
import { useTheme } from '@/theme';

// a connection that drops for a moment (switching towers, leaving wifi) should not make the whole app jump
const SETTLE_MS = 1200;

function useShownOffline() {
  const online = useOnline();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (online) {
      const done = setTimeout(() => setShown(false), 0);
      return () => clearTimeout(done);
    }
    const later = setTimeout(() => setShown(true), SETTLE_MS);
    return () => clearTimeout(later);
  }, [online]);
  return shown && !online;
}

/**
 * Wraps the navigator. While the device has no connection a strip sits under the status bar and the screens move
 * down to make room, so it never covers a title, a back button or a price. Screens keep showing what was saved
 * (orders, addresses, favorites, home) and refresh by themselves when the connection comes back.
 */
export function OfflineFrame({ children }: { children: ReactNode }) {
  const offline = useShownOffline();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {offline ? (
        <View style={{ paddingTop: insets.top, backgroundColor: t.colors.background }}>
          <Animated.View
            testID="offline-notice"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(160)}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: t.colors.text }}
          >
            <Icon name="wifi-off" size={14} color={t.colors.background} />
            <Text variant="label" numberOfLines={1} style={{ color: t.colors.background, fontSize: 13 }}>Sin conexión · ves lo último que cargaste</Text>
          </Animated.View>
        </View>
      ) : null}
      {/* the strip already clears the status bar, so headers below it must not add that space again */}
      <SafeAreaInsetsContext.Provider value={offline ? { ...insets, top: 0 } : insets}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}
