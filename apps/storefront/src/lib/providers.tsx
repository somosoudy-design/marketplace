'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { browser } from './browser';
import { configured } from './env';
const Context = createContext<{ session: Session | null; ready: boolean }>({ session: null, ready: false });
export const useAccount = () => useContext(Context);
function Account({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<{ session: Session | null; ready: boolean }>({
    session: null,
    ready: !configured,
  });
  useEffect(() => {
    if (!configured) return;
    let active = true;
    let identity: string | null | undefined;
    const accept = (session: Session | null) => {
      if (!active) return;
      if (identity !== session?.user.id) {
        qc.cancelQueries();
        qc.clear();
      }
      identity = session?.user.id;
      setState({ session, ready: true });
    };
    const { client } = browser();
    const { data } = client.auth.onAuthStateChange((_event, session) => accept(session));
    client.auth
      .getSession()
      .then(({ data }) => accept(data.session))
      .catch(() => accept(null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [qc]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 20_000, retry: false }, mutations: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <Account>{children}</Account>
    </QueryClientProvider>
  );
}
