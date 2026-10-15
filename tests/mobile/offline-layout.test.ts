import { describe, expect, it } from 'vitest';
import { offlineLayout } from '../../apps/mobile/src/components/offline-layout';

describe('offline strip and system inset occupy space only once', () => {
  for (const platform of ['android', 'ios', 'web']) {
    for (const top of [0, 24, 48]) {
      it(`${platform}, top inset ${top}: only the strip moves the header and content`, () => {
        const insets = { top, right: 0, bottom: 24, left: 0 };
        const online = offlineLayout(platform, false, insets);
        const offline = offlineLayout(platform, true, insets);
        // Android native-stack keeps its window inset independently of the JS context.
        const headerInset = platform === 'android' ? top : offline.navigatorInsets.top;
        for (const stripHeight of [32, 48]) {
          const navigatorStart = top + stripHeight + offline.navigatorMarginTop;
          expect(navigatorStart + headerInset - online.navigatorInsets.top).toBe(stripHeight);
          expect(navigatorStart + headerInset).toBeGreaterThanOrEqual(top + stripHeight);
        }
        expect(offline.navigatorInsets.bottom).toBe(insets.bottom);
        expect(offlineLayout(platform, false, insets)).toEqual(online);
        if (platform === 'android') expect(offline.navigatorInsets).toEqual(insets);
      });
    }
  }
});
