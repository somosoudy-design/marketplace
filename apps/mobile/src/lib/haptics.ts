import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  tap: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  select: () => on && Haptics.selectionAsync().catch(() => undefined),
  success: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
};
