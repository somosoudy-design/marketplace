import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

// Test builds receive new screens and fixes through EAS Update (channel set per build profile in eas.json). The
// app checks when it opens and when it comes back to the foreground; a downloaded version starts on the next
// launch, or right away from this notice. Only JavaScript and images travel this way: anything native needs a
// new APK, and the runtime version keeps an update from reaching a build it does not fit.
const CHECK_EVERY_MS = 10 * 60_000;

export function UpdateNotice() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // offline or the update server is unreachable: the next foreground tries again
      }
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending || dismissed) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 76, alignItems: 'center' }}
    >
      <View
        testID="update-notice"
        accessibilityRole="alert"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 480, width: '100%', paddingLeft: 16, paddingRight: 6, paddingVertical: 6, borderRadius: t.radii.pill, backgroundColor: t.colors.text }}
      >
        <Icon name="sparkles" size={16} color={t.colors.background} />
        <Text variant="label" style={{ flex: 1, color: t.colors.background }} numberOfLines={1}>Hay una versión nueva lista</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.tap();
            Updates.reloadAsync().catch(() => setDismissed(true));
          }}
          style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: t.radii.pill, backgroundColor: t.colors.background }}
        >
          <Text variant="label" color="text">Reiniciar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Más tarde" hitSlop={8} onPress={() => setDismissed(true)} style={{ padding: 6 }}>
          <Icon name="x" size={16} color={t.colors.background} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
