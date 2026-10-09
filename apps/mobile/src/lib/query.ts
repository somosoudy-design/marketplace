import { ApiError } from '@kora/api';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

// Errors the user can fix (validation, permissions, business rules) are not retried; network blips are.
const RETRYABLE = new Set(['network', 'unknown']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, error) => count < 2 && (!(error instanceof ApiError) || RETRYABLE.has(error.code)),
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

export const qk = {
  home: ['home'] as const,
  search: (p: object) => ['search', p] as const,
  product: (id: string) => ['product', id] as const,
  store: (slug: string) => ['store', slug] as const,
  categories: ['categories'] as const,
  cart: (addressId?: string | null) => ['cart', addressId ?? null] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,
  addresses: ['addresses'] as const,
  favorites: ['favorites'] as const,
  notifications: ['notifications'] as const,
  profile: ['profile'] as const,
  rate: ['rate'] as const,
  methods: ['payment-methods'] as const,
  steps: ['fulfillment-steps'] as const,
  claims: ['claims'] as const,
};
