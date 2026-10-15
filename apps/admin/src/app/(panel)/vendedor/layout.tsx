'use client';
import { Guard } from '@/components/Guard';
import { Shell } from '@/components/Shell';
import { Loading } from '@/components/ui';
import { StoreProvider, useStore } from '@/lib/store';

function Ready({ children }: { children: React.ReactNode }) {
  const { store, loading } = useStore();
  if (loading || !store) return <Loading rows={4} />;
  return <>{children}</>;
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
