'use client';
import { Guard } from '@/components/Guard';
import { Shell } from '@/components/Shell';
import { Empty, ErrorBox, Loading } from '@/components/ui';
import { StoreProvider, useStore } from '@/lib/store';

function Ready({ children }: { children: React.ReactNode }) {
  const { store, loading, error, retry } = useStore();
  if (loading) return <Loading rows={4} />;
  if (error) return <ErrorBox error={error} onRetry={retry} />;
  if (!store) return <Empty title="No hay una tienda disponible" body="No encontramos una tienda asociada a tu cuenta." />;
  return <div key={store.id}>{children}</div>;
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard need="seller">
      <StoreProvider>
        <Shell area="seller">
          <Ready>{children}</Ready>
        </Shell>
      </StoreProvider>
    </Guard>
  );
}
