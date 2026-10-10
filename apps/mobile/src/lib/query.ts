import { ApiError } from '@kora/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

const DAY = 24 * 60 * 60_000;

// Errors the user can fix (validation, permissions, business rules) are not retried; network blips are.
const RETRYABLE = new Set(['network', 'unknown']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // kept as long as the saved copy (below), otherwise restored data would be dropped right away
      gcTime: DAY,
      retry: (count, error) => count < 2 && (!(error instanceof ApiError) || RETRYABLE.has(error.code)),
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
    },
    // a payment or an order must fail with a clear "sin conexión" instead of waiting silently to resume later
    mutations: { retry: false, networkMode: 'always' },
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

// Online state comes from the device's connection, so queries pause while offline and refetch when it returns.
// No reachability probe: it would call a third-party URL from the buyer's phone.
NetInfo.configure({ reachabilityShouldRun: () => false });
onlineManager.setEventListener((setOnline) => {
  const stop = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
  if (Platform.OS !== 'web' || typeof window === 'undefined') return stop;
  // NetInfo's web build only watches navigator.connection, which Chrome does not always update when the
  // connection returns; the browser's own online/offline events do fire
  const sync = () => setOnline(navigator.onLine);
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  return () => {
    stop();
    window.removeEventListener('online', sync);
    window.removeEventListener('offline', sync);
  };
});

export function useOnline() {
  return useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline(), () => true);
}

/**
 * What the app keeps on the device to open without a connection: the buyer's own orders, addresses, favorites
 * and notices, the home feed, the delivery step names and the support contact. Never the exchange rate,
 * payment methods, quotes, cart or checkout: those are only valid as the server returns them now. The saved
 * copy expires after a day and is erased on sign-out.
 */
const PERSISTED = new Set(['home', 'categories', 'orders', 'order', 'fulfillment-steps', 'addresses', 'favorites', 'notifications', 'profile', 'claims', 'support']);

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'kora-offline-v1', throttleTime: 2000 });

export const persistOptions = {
  persister,
  maxAge: DAY,
  // bump when a persisted response changes shape, so an old copy is discarded instead of rendered
  buster: '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: Query) => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
  },
};

/** Forget everything this device knows about the signed-in buyer. */
export async function clearAccountCache() {
  queryClient.clear();
  await persister.removeClient();
}

export const qk = {
  home: ['home'] as const,
  search: (p: object) => ['search', p] as const,
  product: (id: string) => ['product', id] as const,
  store: (slug: string) => ['store', slug] as const,
  reviews: (productId: string) => ['reviews', productId] as const,
  myReviews: (orderId: string) => ['my-reviews', orderId] as const,
  /** The buyer's delivered purchases of a product and their reviews, for "Calificar tu compra" on its page. */
  reviewable: (productId: string) => ['my-reviews', 'product', productId] as const,
  categories: ['categories'] as const,
  cart: (addressId?: string | null) => ['cart', addressId ?? null] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  addresses: ['addresses'] as const,
  favorites: ['favorites'] as const,
  notifications: ['notifications'] as const,
  profile: ['profile'] as const,
  /** Signed link to the user's own photo; not persisted, since the link expires. */
  avatar: (path: string) => ['avatar', path] as const,
  rate: ['rate'] as const,
  pricing: ['pricing-today'] as const,
  methods: ['payment-methods'] as const,
  steps: ['fulfillment-steps'] as const,
  claims: ['claims'] as const,
  support: ['support'] as const,
};
