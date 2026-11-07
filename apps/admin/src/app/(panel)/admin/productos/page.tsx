'use client';
import { MODERATION_LABEL, presentAvailability } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { ProductReview, type ProductRow } from '@/components/ProductReview';
import { Badge, Card, Empty, ErrorBox, Input, Loading, PageHeader, Select, Table, Tabs, Td, Thumb } from '@/components/ui';
import { ago, money, moderationTone } from '@/lib/format';
import { useCategoriesIndex, useStoresIndex } from '@/lib/hooks';
import { catalogImage, db, run } from '@/lib/kora';

const STATUSES = ['pending', 'in_review', 'published', 'rejected', 'suspended'] as const;
type Status = (typeof STATUSES)[number];
const SELECT = 'id, slug, title, subtitle, description, highlights, base_price_usd, compare_at_usd, availability, moderation_status, moderation_note, is_demo, source_url, source_provider, origin, updated_at, store_id, category_id, product_images(path, sort), product_variants(id, title, sku, price_usd, stock, active)';

export default function ProductsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const [query, setQuery] = useState('');
  const [storeId, setStoreId] = useState('');
  const [open, setOpen] = useState<ProductRow | null>(null);
  const stores = useStoresIndex();
  const cats = useCategoriesIndex();

  const counts = useQuery({
    queryKey: ['admin-products', 'counts'],
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(STATUSES.map(async (s) => {
        const { count } = await db('products').select('id', { count: 'exact', head: true }).eq('moderation_status', s);
        out[s] = count ?? 0;
      }));
      return out;
    },
  });
  const list = useQuery({
    queryKey: ['admin-products', status, query, storeId],
    queryFn: () => {
      let q = db('products').select(SELECT).eq('moderation_status', status);
      if (query.trim()) q = q.ilike('title', `%${query.trim()}%`);
      if (storeId) q = q.eq('store_id', storeId);
      return run<ProductRow[]>(q.order('updated_at', { ascending: status === 'pending' }).limit(200));
    },
  });
  const cat = (id: string) => cats.list.find((c) => c.id === id);

  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Productos y moderación" description="Las categorías sensibles y las tiendas nuevas pasan por revisión antes de publicarse. Rechazar o suspender exige un motivo que la tienda verá." />
      <Tabs value={status} onChange={setStatus} items={STATUSES.map((s) => ({ value: s, label: MODERATION_LABEL[s]!, count: counts.data?.[s] }))} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <Input aria-label="Buscar productos" placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
        </div>
        <Select aria-label="Tienda" value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-auto min-w-[200px]">
          <option value="">Todas las tiendas</option>
          {stores.list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <Card padded={false}>
        {list.isPending ? <Loading /> : list.isError ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : !list.data.length ? (
          <Empty title={status === 'pending' ? 'Nada por moderar' : 'Sin productos en este estado'} />
        ) : (
          <Table head={['Producto', 'Tienda', 'Categoría', 'Precio', 'Disponibilidad', 'Estado', 'Actualizado']}>
            {list.data.map((p) => {
              const img = [...p.product_images].sort((a, b) => a.sort - b.sort)[0];
              const c = cat(p.category_id);
              return (
                <tr key={p.id} className="cursor-pointer hover:bg-sunken/50" onClick={() => setOpen(p)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Thumb src={catalogImage(img?.path)} alt={p.title} size={36} />
                      <div className="min-w-0">
                        <button className="block max-w-[340px] truncate text-left font-semibold hover:text-brand">{p.title}</button>
                        <span className="text-[12px] text-ink-3">{p.slug}{p.is_demo ? ' · demo' : ''}</span>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{stores.name(p.store_id)}</Td>
                  <Td className="whitespace-nowrap">{c?.name ?? '—'}{c && c.risk_level !== 'low' ? <Badge tone="danger" className="ml-2">Sensible</Badge> : null}</Td>
                  <Td className="tabular">{money(p.base_price_usd, 'USD')}</Td>
                  <Td className="whitespace-nowrap">{presentAvailability(p.availability as never).label}</Td>
                  <Td><Badge tone={moderationTone[p.moderation_status]}>{MODERATION_LABEL[p.moderation_status]}</Badge></Td>
                  <Td className="whitespace-nowrap text-ink-3">{ago(p.updated_at)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <ProductReview product={open} storeName={open ? stores.name(open.store_id) : ''} category={open ? cat(open.category_id) : undefined} onClose={() => setOpen(null)} />
    </>
  );
}
