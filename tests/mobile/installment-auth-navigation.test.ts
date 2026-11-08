import { beforeEach, describe, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({
  dismissTo: vi.fn(), back: vi.fn(), replace: vi.fn(), canGoBack: vi.fn(), params: vi.fn(),
}));
vi.mock('expo-router', () => ({
  router: { dismissTo: ports.dismissTo, back: ports.back, replace: ports.replace, canGoBack: ports.canGoBack },
  useLocalSearchParams: ports.params,
}));
import { authTarget, finishAuth, safeAuthReturn, useAuthReturn } from '../../apps/mobile/src/lib/auth-navigation';

describe('payment preference through existing mobile account and legal screens', () => {
  beforeEach(() => { vi.clearAllMocks(); ports.canGoBack.mockReturnValue(false); });

  it('preserves the sanitized preference across sign-in, sign-up and email verification', () => {
    const returnTo = '/checkout?plan=three_parts';
    for (const pathname of ['/sign-in', '/sign-up', '/verify-email'] as const) {
      const target = authTarget(pathname, returnTo, { email: 'buyer@example.com' });
      expect(target).toEqual({ pathname, params: { email: 'buyer@example.com', returnTo } });
      ports.params.mockReturnValue(target.params);
      expect(useAuthReturn()).toBe(returnTo);
    }
    expect(ports.dismissTo).not.toHaveBeenCalled();
  });

  it('never forwards duplicated or invalid plans, tokens or outside destinations', () => {
    for (const value of ['/checkout?plan=full&plan=three_parts', '/checkout?plan=%2Fexternal', '/checkout?access_token=discard']) {
      expect(safeAuthReturn(value)).toBe('/checkout');
    }
    for (const value of ['//outside.invalid/checkout', '/checkout#token', ['/checkout?plan=three_parts']]) {
      expect(safeAuthReturn(value)).toBeUndefined();
    }
    expect(safeAuthReturn('/product/p1?variant=v1&plan=three_parts&other=discard')).toBe('/product/p1?variant=v1&plan=three_parts');
  });

  it('finishes only at the internal destination and retains the existing back/home fallback', () => {
    finishAuth('/checkout?plan=three_parts');
    expect(ports.dismissTo).toHaveBeenCalledWith('/checkout?plan=three_parts');
    expect(ports.back).not.toHaveBeenCalled(); expect(ports.replace).not.toHaveBeenCalled();
    ports.canGoBack.mockReturnValue(true); finishAuth('//outside.invalid');
    expect(ports.back).toHaveBeenCalledOnce();
    ports.canGoBack.mockReturnValue(false); finishAuth();
    expect(ports.replace).toHaveBeenCalledWith('/');
  });
});
