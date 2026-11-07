import { safePlanCode } from '@kora/core';
import { router, useLocalSearchParams, type Href } from 'expo-router';

/** Destinations are internal navigation data, never an instruction to add, quote or place an order. */
export function safeAuthReturn(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return undefined;
  try {
    const url = new URL(value, 'https://mayami.local');
    if (url.origin !== 'https://mayami.local' || url.hash) return undefined;
    const fixed = new Set(['/', '/cart', '/favorites', '/account', '/explore', '/checkout']);
    if (!fixed.has(url.pathname) && !/^\/(?:product|p|tienda)\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return undefined;
    // Keep only the product option and the bounded payment-plan preference.
    const variant = url.searchParams.get('variant');
    const query = new URLSearchParams();
    if (variant && /^[a-zA-Z0-9_-]+$/.test(variant)) query.set('variant', variant);
    const planValues = url.searchParams.getAll('plan');
    const plan = planValues.length === 1 ? safePlanCode(planValues[0]) : undefined;
    if (plan) query.set('plan', plan);
    const encoded = query.toString();
    return url.pathname + (encoded ? `?${encoded}` : '');
  } catch { return undefined; }
}

export function useAuthReturn() {
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  return safeAuthReturn(params.returnTo);
}
export function authTarget(pathname: '/sign-in' | '/sign-up' | '/verify-email' | '/forgot-password', returnTo?: string, extra: Record<string, string> = {}) {
  const safe = safeAuthReturn(returnTo);
  return { pathname, params: { ...extra, ...(safe ? { returnTo: safe } : {}) } };
}
export function finishAuth(returnTo?: string) {
  const safe = safeAuthReturn(returnTo);
  if (safe) router.dismissTo(safe as Href);
  else if (router.canGoBack()) router.back();
  else router.replace('/');
}
