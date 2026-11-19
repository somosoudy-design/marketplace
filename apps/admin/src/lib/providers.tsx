'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@kora/api';
import { ToastProvider } from '@/components/toast';
import { AuthProvider } from './auth';

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            // business errors (permissions, validation) are final; only retry transport failures
            retry: (n, e) => n < 2 && (!(e instanceof ApiError) || e.code === 'network' || e.code === 'unknown'),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
