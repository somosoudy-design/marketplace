import type { EdgeInsets } from 'react-native-safe-area-context';

export function offlineLayout(platform: string, offline: boolean, insets: EdgeInsets) {
  // Android native-stack still applies the window inset: its native topInsetEnabled setter is a no-op.
  // Keep that inset stable and cancel the strip's extra system padding, moving screens only by strip height.
  const nativeInset = platform === 'android';
  return {
    navigatorInsets: offline && !nativeInset ? { ...insets, top: 0 } : insets,
    navigatorMarginTop: offline && nativeInset ? -insets.top : 0,
  };
}
