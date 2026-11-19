'use client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { ErrorBox, Loading, Notice } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { koraForActor, run } from '@/lib/kora';
import { ReviewedProductEditor, type EditorStore } from '../../../vendedor/productos/editar/ProductEditor';

/** Admin layout supplies Guard; no seller membership or selected-store state is changed. */
export default function AdminProductEditor() {
  const params = useSearchParams();
  const storeId = params.get('store');
  const productId = params.get('id');
  const { userId, isAdmin } = useAuth();
  const allowed = !!userId && isAdmin && !!storeId && !!productId;
  const q = useQuery({
    queryKey: ['admin-editor-store', userId, storeId],
    enabled: allowed,
    queryFn: async () => {
      const operation = await koraForActor(userId!);
      const store = await run<EditorStore | null>(operation.client.from('stores').select('id, name, kind, status').eq('id', storeId!).maybeSingle());
      await operation.assertCurrent();
      return store;
    },
  });
  if (!allowed) return <Notice tone="warning">Abre una ficha desde Productos y moderación.</Notice>;
  if (q.isPending) return <Loading rows={6} />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <Notice tone="warning">No encontramos la tienda de este producto.</Notice>;
  return <ReviewedProductEditor store={q.data} admin />;
}
