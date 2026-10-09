import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { api } from './supabase';

/**
 * Recommendation measurement. A product counts as an impression only when its section is actually on screen,
 * and a click when it is opened from that section. Events are batched and sent best effort; the server
 * ignores them for visitors and for people who turned personalization off.
 */

const pending = new Map<string, Set<string>>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  pending.forEach((ids, slot) => {
    const list = [...ids];
    for (let i = 0; i < list.length; i += 40) void api.catalog.trackRecommendation(slot, 'impression', list.slice(i, i + 40));
  });
  pending.clear();
}

export function recordImpressions(slot: string, ids: string[]) {
  if (!ids.length) return;
  const set = pending.get(slot) ?? new Set<string>();
  ids.forEach((id) => set.add(id));
  pending.set(slot, set);
  if (!timer) timer = setTimeout(flush, 1200);
}

export function recordClick(slot: string, productId: string) {
  void api.catalog.trackRecommendation(slot, 'click', [productId]);
}

class Viewport {
  y = 0;
  h = 0;
  listeners = new Set<() => void>();
  update(y: number, h: number) {
    this.y = y;
    if (h) this.h = h;
    this.listeners.forEach((l) => l());
  }
}

const Ctx = createContext<{ vp: Viewport; enabled: boolean } | null>(null);

/** Owns the visible window of one vertical scroller; attach onScroll/onLayout to it and wrap it in ImpressionScope. */
export function useViewportTracking() {
  const vp = useRef(new Viewport()).current;
  return {
    vp,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => vp.update(e.nativeEvent.contentOffset.y, e.nativeEvent.layoutMeasurement.height),
    onLayout: (e: LayoutChangeEvent) => vp.update(vp.y, e.nativeEvent.layout.height),
  };
}

export function ImpressionScope({ tracking, enabled, children }: { tracking: { vp: Viewport }; enabled: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ vp: tracking.vp, enabled }), [tracking.vp, enabled]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTrackingEnabled = () => useContext(Ctx)?.enabled ?? false;

/**
 * Section placed directly in the scroll content. The first time any part of it enters the viewport, the first
 * `visible` products (what fits without scrolling sideways) are recorded once.
 */
export function TrackedSection({ slot, ids, visible = 3, children, testID }: { slot: string; ids: string[]; visible?: number; children: ReactNode; testID?: string }) {
  const ctx = useContext(Ctx);
  const box = useRef<{ y: number; h: number } | null>(null);
  const done = useRef(false);
  const key = ids.join(',');
  const check = useRef(() => {});
  check.current = () => {
    if (!ctx?.enabled || done.current || !box.current || !ctx.vp.h) return;
    const { y, h } = box.current;
    if (y < ctx.vp.y + ctx.vp.h && y + h > ctx.vp.y) {
      done.current = true;
      recordImpressions(slot, ids.slice(0, visible));
    }
  };
  useEffect(() => {
    done.current = false;
    if (!ctx) return;
    const l = () => check.current();
    ctx.vp.listeners.add(l);
    l();
    return () => {
      ctx.vp.listeners.delete(l);
    };
  }, [ctx, key]);
  return (
    <View
      testID={testID}
      onLayout={(e) => {
        box.current = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
        check.current();
      }}
    >
      {children}
    </View>
  );
}
