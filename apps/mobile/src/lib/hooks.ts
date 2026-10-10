import type { CheckoutSummary, ProductDetail, ProductVariant, SearchParams } from '@kora/api';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { guestCart, type GuestLine } from './guest-cart';
import { qk } from './query';
import { api } from './supabase';

export const useHome = () => useQuery({ queryKey: qk.home, queryFn: api.catalog.home });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: api.catalog.categories, staleTime: 10 * 60_000 });
export const useProduct = (id: string | undefined) =>
  useQuery({ queryKey: qk.product(id ?? ''), queryFn: () => api.catalog.product(id!), enabled: !!id });

/** Reference USD/VES rate for showing bolívar equivalents. Returns null when no fresh rate exists. */
/** Current USD/VES reference rate, or null when none is valid. `demo` marks the development rate. */
/** Today's USD/VES rate with its source and age, for the rate details sheet. */
export function useRateStatus() {
  return useQuery({ queryKey: qk.rate, queryFn: () => api.catalog.rate('USD/VES'), staleTime: 5 * 60_000 });
}

export function useVesRate(): { rate: number; demo: boolean } | null {
  const q = useRateStatus();
  return q.data && q.data.available ? { rate: Number(q.data.rate), demo: q.data.source === 'demo' } : null;
}

/**
 * The day's gap for showing what Zelle/USDT pay (docs/PRECIOS.md): `factor(code)` turns BCV dollars into the method's
 * currency; `best` is the most conservative factor among the enabled divisas methods, for a single "en divisas"
 * price. Null when no gap is in force: then nothing special is shown, exactly when the server stops quoting it.
 * Display only; the quote is what charges. Never persisted offline (qk.pricing is not in PERSISTED).
 */
export function useDivisas(): { best: number; label: string; gapPct: number; factor: (code: string) => number | null } | null {
  const q = useQuery({ queryKey: qk.pricing, queryFn: api.catalog.pricingToday, staleTime: 5 * 60_000 });
  return useMemo(() => {
    const d = q.data;
    if (!d?.available || !d.methods.length) return null;
    const byCode = new Map(d.methods.map((m) => [m.code, Number(m.factor)]));
    const names = [...new Set(d.methods.map((m) => DIVISAS_SHORT[m.code] ?? m.name))];
    const label = names.length > 1 ? `${names.slice(0, -1).join(', ')} o ${names.at(-1)}` : names[0]!;
    return { best: Math.max(...byCode.values()), label, gapPct: Number(d.snapshot.gap_pct), factor: (code: string) => byCode.get(code) ?? null };
  }, [q.data]);
}
const DIVISAS_SHORT: Record<string, string> = { zelle: 'Zelle', usdt_trc20: 'USDT', binance_pay: 'Binance Pay', paypal: 'PayPal', efectivo_usd: 'efectivo' };

const PAGE = 20;
export function useSearch(params: Omit<SearchParams, 'limit' | 'offset'>) {
  return useInfiniteQuery({
    queryKey: qk.search(params),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.catalog.search({ ...params, limit: PAGE, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PAGE ? undefined : all.length * PAGE),
    placeholderData: (prev) => prev,
  });
}

// ---------- cart (server cart for accounts, device cart for visitors) ----------
export function useGuestCart(): GuestLine[] {
  const [lines, setLines] = useState<GuestLine[]>([]);
  useEffect(() => {
    guestCart.read().then(setLines);
    return guestCart.subscribe(setLines);
  }, []);
  return lines;
}

export function useCart(addressId?: string | null) {
  const { user, cartSyncing } = useAuth();
  return useQuery({ queryKey: qk.cart(addressId), queryFn: () => api.cart.summary(addressId), enabled: !!user && !cartSyncing });
}

export function useCartCount(): number {
  const { user } = useAuth();
  const guest = useGuestCart();
  const cart = useCart();
  if (!user) return guest.reduce((s, l) => s + l.quantity, 0);
  return cart.data?.groups.reduce((s, g) => s + g.lines.reduce((a, l) => a + l.quantity, 0), 0) ?? 0;
}

export function useAddToCart() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product, variant, quantity }: { product: ProductDetail; variant: ProductVariant; quantity: number }) => {
      if (!user) {
        await guestCart.add({
          variant_id: variant.id,
          product_id: product.id,
          quantity,
          title: product.title,
          variant_title: product.variants.length > 1 ? variant.title : null,
          image_path: product.image_path,
          price_usd: Number(variant.price_usd),
          availability: product.availability,
        });
        return;
      }
      await api.cart.add(variant.id, quantity);
      void api.catalog.track('add_to_cart', { productId: product.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
}

export function useSetCartQuantity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, quantity }: { variantId: string; quantity: number }) => {
      if (!user) return guestCart.setQuantity(variantId, quantity);
      await api.cart.setQuantity(variantId, quantity);
    },
    onMutate: async ({ variantId, quantity }) => {
      // optimistic update so steppers feel instant; the server response replaces it
      await qc.cancelQueries({ queryKey: ['cart'] });
      const snapshots = qc.getQueriesData<CheckoutSummary>({ queryKey: ['cart'] });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<CheckoutSummary>(key, {
          ...data,
          groups: data.groups
            .map((g) => ({ ...g, lines: g.lines.map((l) => (l.variant_id === variantId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0) }))
            .filter((g) => g.lines.length > 0),
        });
      });
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
}

// ---------- favorites ----------
export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.favorites, queryFn: api.account.favorites, enabled: !!user });
  const ids = useMemo(() => new Set((q.data ?? []).map((f) => f.product_id)), [q.data]);
  const toggle = useMutation({
    mutationFn: ({ productId, on }: { productId: string; on: boolean }) => api.account.setFavorite(user!.id, productId, on),
    onMutate: async ({ productId, on }) => {
      await qc.cancelQueries({ queryKey: qk.favorites });
      const prev = qc.getQueryData<{ product_id: string; created_at: string }[]>(qk.favorites) ?? [];
      qc.setQueryData(qk.favorites, on ? [{ product_id: productId, created_at: new Date().toISOString() }, ...prev] : prev.filter((f) => f.product_id !== productId));
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(qk.favorites, ctx?.prev),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: qk.favorites });
      qc.invalidateQueries({ queryKey: ['favorite-products'] });
      qc.invalidateQueries({ queryKey: qk.product(v.productId) });
    },
  });
  return { ids, isFavorite: (id: string) => ids.has(id), toggle: toggle.mutate, enabled: !!user };
}

// ---------- account ----------
export const useAddresses = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.addresses, queryFn: api.account.addresses, enabled: !!user });
};
export const useOrders = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.orders, queryFn: api.orders.list, enabled: !!user });
};
export const useOrder = (id: string) => useQuery({ queryKey: qk.order(id), queryFn: () => api.orders.detail(id), refetchInterval: 30_000 });
export const useFulfillmentSteps = () => useQuery({ queryKey: qk.steps, queryFn: api.orders.steps, staleTime: 30 * 60_000 });
export const useNotifications = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.notifications, queryFn: () => api.account.notifications(), enabled: !!user, refetchInterval: 60_000 });
};
export const useUnreadCount = () => (useNotifications().data ?? []).filter((n) => !n.read_at).length;
export const usePaymentMethods = () => useQuery({ queryKey: qk.methods, queryFn: api.payments.methods, staleTime: 10 * 60_000 });
export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.profile, queryFn: () => api.account.profile(user!.id), enabled: !!user });
};

/** Support contact set by the operator; the brand file's email is the fallback while it loads or offline. */
export const useSupport = () => useQuery({ queryKey: qk.support, queryFn: api.catalog.support, staleTime: 60 * 60_000 });
