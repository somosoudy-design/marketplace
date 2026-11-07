import { favoriteState, type FavoriteEntry, type CheckoutSummary, type ProductDetail, type ProductVariant, type SearchParams } from '@kora/api';
import { useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { guestCart, type GuestLine } from './guest-cart';
import { qk } from './query';
import { api } from './supabase';
import { captureActorApi, assertCurrentActor } from './actor-api';
import { addAccountCart } from './operation-intents';
import { resolveProductSelection } from '@kora/core';

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
    guestCart.read().then(setLines).catch(() => undefined);
    return guestCart.subscribe(setLines);
  }, []);
  return lines;
}

export function useCart(addressId?: string | null) {
  const { user, cartSyncing } = useAuth();
  return useQuery({ queryKey: ['cart',user?.id,addressId??null], queryFn: async () => { const bound=await captureActorApi(user!.id);const result=await bound.api.cart.summaryReviewed(addressId);await bound.assertCurrent();return result; }, enabled: !!user && !cartSyncing });
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
        const selection=resolveProductSelection(product,variant.id);
        await guestCart.add({
          variant_id: variant.id,
          product_id: product.id,
          quantity,
          title: product.title,
          variant_title: product.variants.length > 1 ? variant.title : null,
          image_path: selection.cover?.path ?? (selection.mediaState==='unclassified'?product.general_images?.[0]?.path??null:null),
          product_condition: product.condition,
          price_usd: Number(variant.price_usd),
          availability: product.availability,
        });
        return;
      }
      await addAccountCart(user.id, variant.id, quantity, product.id, () => qc.invalidateQueries({ queryKey: ['cart'] }));
    },
  });
}

export function useSetCartQuantity() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ variantId, quantity }: { variantId: string; quantity: number }) => {
      if (!user) return guestCart.setQuantity(variantId, quantity);
      const bound = await captureActorApi(user.id);
      await bound.assertCurrent();
      await bound.api.cart.setQuantity(variantId, quantity);
      await bound.assertCurrent();
    },
    onMutate: async ({ variantId, quantity }) => {
      if (!user) return { actorId: null, snapshots: [] as [readonly unknown[], CheckoutSummary | undefined][] };
      await assertCurrentActor(user.id);
      // optimistic update so steppers feel instant; the server response replaces it
      await qc.cancelQueries({ queryKey: ['cart',user.id] });
      await assertCurrentActor(user.id);
      const snapshots = qc.getQueriesData<CheckoutSummary>({ queryKey: ['cart',user.id] });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<CheckoutSummary>(key, {
          ...data,
          groups: data.groups
            .map((g) => ({ ...g, lines: g.lines.map((l) => (l.variant_id === variantId ? { ...l, quantity } : l)).filter((l) => l.quantity > 0) }))
            .filter((g) => g.lines.length > 0),
        });
      });
      return { snapshots, actorId: user.id };
    },
    onError: async (_e, _v, ctx) => {
      if (!ctx?.actorId) return;
      try { await assertCurrentActor(ctx.actorId); } catch { return; }
      ctx.snapshots.forEach(([key, data]) => { if (qc.getQueryState(key)) qc.setQueryData(key, data); });
    },
    onSettled: async (_data, _error, _variables, ctx) => {
      if (!ctx?.actorId) return;
      try { await assertCurrentActor(ctx.actorId); } catch { return; }
      await qc.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

// ---------- favorites ----------
export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [...qk.favorites, user?.id];
  const mutationKey = ['favorite-write', user?.id];
  const q = useQuery({ queryKey: key, queryFn: () => api.account.favoritesForBuyer(user!.id), enabled: !!user });
  const ids = useMemo(() => new Set((user ? q.data ?? [] : []).map((f) => f.product_id)), [q.data, user]);
  const pending = useMutationState({ filters: { mutationKey, status: 'pending' }, select: (mutation) => (mutation.state.variables as { productId: string }).productId });
  const toggle = useMutation({
    mutationKey,
    mutationFn: ({ userId, productId, on }: { userId: string; productId: string; on: boolean }) => api.account.setFavorite(userId, productId, on),
    onMutate: async ({ userId, productId, on }) => {
      const queryKey = [...qk.favorites, userId];
      await qc.cancelQueries({ queryKey, exact: true });
      const previous = qc.getQueryData<FavoriteEntry[]>(queryKey)?.find((row) => row.product_id === productId) ?? null;
      // A logout may have removed this query while cancellation was in flight.
      if (qc.getQueryState(queryKey)) qc.setQueryData<FavoriteEntry[]>(queryKey, (rows = []) => favoriteState(rows, productId, on ? previous ?? { product_id: productId, created_at: new Date().toISOString() } : null));
      return { previous, queryKey };
    },
    onError: (_e, v, ctx) => {
      if (ctx && qc.getQueryState(ctx.queryKey)) qc.setQueryData<FavoriteEntry[]>(ctx.queryKey, (rows = []) => favoriteState(rows, v.productId, ctx.previous));
    },
    onSettled: (_d, _e, v) => {
      // Do not refetch over another product's optimistic update.
      if (qc.isMutating({ mutationKey: ['favorite-write', v.userId] }) === 1) {
        qc.invalidateQueries({ queryKey: [...qk.favorites, v.userId], exact: true });
        qc.invalidateQueries({ queryKey: ['favorite-products', v.userId] });
      }
      qc.invalidateQueries({ queryKey: qk.product(v.productId) });
    },
  });
  return {
    ids, isFavorite: (id: string) => ids.has(id), enabled: !!user,
    loading: !!user && q.isPending, refreshing: q.isFetching, error: q.error, retry: q.refetch,
    isPending: (id: string) => pending.includes(id),
    toggle: ({ productId, on }: { productId: string; on: boolean }, callbacks?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
      if (!user || qc.getQueryState([...qk.favorites, user.id])?.status !== 'success' || qc.getMutationCache().findAll({ mutationKey, status: 'pending' }).some((mutation) => (mutation.state.variables as { productId: string }).productId === productId)) return false;
      toggle.mutate({ userId: user.id, productId, on }, callbacks);
      return true;
    },
  };
}

// ---------- account ----------
export const useAddresses = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: [...qk.addresses, user?.id], queryFn: () => api.account.addressesForBuyer(user!.id), enabled: !!user });
};
export const useOrders = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: [...qk.orders, user?.id], queryFn: () => api.orders.list(user!.id), enabled: !!user });
};
export const useOrder = (id: string, freshOnMount = false) => {
  const { user } = useAuth();
  return useQuery({ queryKey: [...qk.order(id), user?.id], queryFn: () => api.orders.detail(id, user!.id), enabled: !!user && !!id, refetchInterval: 30_000, refetchOnMount: freshOnMount ? 'always' : true });
};
export const useFulfillmentSteps = () => useQuery({ queryKey: qk.steps, queryFn: api.orders.steps, staleTime: 30 * 60_000 });
export const useNotifications = () => {
  const { user } = useAuth();
  const q = useInfiniteQuery({
    queryKey: [...qk.notifications, user?.id, 'pages'],
    queryFn: ({ pageParam }) => api.account.notificationPage(user!.id, pageParam, 50),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, offset) => last.hasMore ? offset + 50 : undefined,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const data = useMemo(() => q.data ? Array.from(new Map(q.data.pages.flatMap((page) => page.items).map(n => [n.id, n])).values()) : undefined, [q.data]);
  return { ...q, data };
};
export const useUnreadCount = () => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: [...qk.notifications, user?.id, 'unread'],
    queryFn: () => api.account.notificationUnreadCount(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  return user && !q.isError ? q.data ?? 0 : 0;
};
export const usePaymentMethods = () => useQuery({ queryKey: qk.methods, queryFn: api.payments.methods, staleTime: 10 * 60_000 });
export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: qk.profile, queryFn: () => api.account.profile(user!.id), enabled: !!user });
};

/** Link to show the user's photo (private bucket, signed for an hour; refreshed before it expires). */
export const useAvatarUrl = (path: string | null | undefined) =>
  useQuery({ queryKey: qk.avatar(path ?? ''), queryFn: () => api.account.avatarUrl(path!), enabled: !!path, staleTime: 50 * 60_000, gcTime: 55 * 60_000 });

/** Support contact set by the operator; the brand file's email is the fallback while it loads or offline. */
export const useSupport = () => useQuery({ queryKey: qk.support, queryFn: api.catalog.support, staleTime: 60 * 60_000 });
