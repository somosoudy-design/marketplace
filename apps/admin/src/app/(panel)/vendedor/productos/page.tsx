'use client';
import { MODERATION_LABEL, presentAvailability } from '@kora/core';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StockTable } from '@/components/StockTable';
import { Badge, Card, Empty, ErrorBox, Input, LinkButton, Loading, PageHeader, Table, Tabs, Td, Thumb } from '@/components/ui';
import { ago, money, moderationTone } from '@/lib/format';
import { catalogImage, db, run } from '@/lib/kora';
import { useStore } from '@/lib/store';

type Row = {
  id: string; title: string; availability: string; moderation_status: string; moderation_note: string | null; base_price_usd: string; updated_at: string;
  product_images: { path: string; sort: number }[]; product_variants: { stock: number | null; active: boolean }[];
};

export default function SellerProducts() {
  const { store } = useStore();
  const router = useRouter();
  const [tab, setTab] = useState<'products' | 'stock'>('products');
  const [query, setQuery] = useState('');
  const q = useQuery({
    queryKey: ['seller-products', store!.id, query],
    queryFn: () => {
      let r = db('products').select('id, title, availability, moderation_status, moderation_note, base_price_usd, updated_at, product_images(path, sort), product_variants(stock, active)').eq('store_id', store!.id);
      if (query.trim()) r = r.ilike('title', `%${query.trim()}%`);
      return run<Row[]>(r.order('updated_at', { ascending: false }).limit(300));
    },
    enabled: tab === 'products',
  });
  return (
    <>
      <PageHeader
        eyebrow={store!.name}
        title="Productos"
        description="Los productos de categorías generales se publican al guardar si tu tienda está activa. Los de categorías sensibles pasan por revisión."
        actions={<LinkButton href="/vendedor/productos/nuevo" icon={Plus}>Nuevo producto</LinkButton>}
      />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'products', label: 'Catálogo' }, { value: 'stock', label: 'Inventario' }]} />
      {tab === 'stock' ? <StockTable storeId={store!.id} /> : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
            <Input aria-label="Buscar productos" placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </div>
          <Card padded={false}>
            {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? (
              <Empty title={query ? 'Sin resultados' : 'Aún no tienes productos'} body={query ? undefined : 'Crea tu primer producto con fotos propias, variantes e inventario.'} action={query ? undefined : <LinkButton href="/vendedor/productos/nuevo" icon={Plus}>Nuevo producto</LinkButton>} />
            ) : (
              <Table head={['Producto', 'Precio', 'Disponibilidad', 'Inventario', 'Estado', 'Actualizado']}>
                {q.data.map((p) => {
                  const img = [...p.product_images].sort((a, b) => a.sort - b.sort)[0];
                  const tracked = p.product_variants.filter((v) => v.active && v.stock !== null);
                  return (
                    <tr key={p.id} className="cursor-pointer hover:bg-sunken/50" onClick={() => router.push(`/vendedor/productos/editar?id=${p.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Thumb src={catalogImage(img?.path)} alt={p.title} size={36} />
                          <Link href={`/vendedor/productos/editar?id=${p.id}`} className="max-w-[360px] truncate font-semibold hover:text-brand" onClick={(e) => e.stopPropagation()}>{p.title}</Link>
                        </div>
                      </Td>
                      <Td className="tabular">{money(p.base_price_usd, 'USD')}</Td>
                      <Td className="whitespace-nowrap">{presentAvailability(p.availability as never).label}</Td>
                      <Td className="tabular">{tracked.length ? tracked.reduce((a, v) => a + (v.stock ?? 0), 0) : <span className="text-ink-3">Sin control</span>}</Td>
                      <Td>
                        <Badge tone={moderationTone[p.moderation_status]}>{MODERATION_LABEL[p.moderation_status]}</Badge>
                        {p.moderation_note && ['rejected', 'suspended'].includes(p.moderation_status) ? <span className="mt-1 block max-w-[240px] truncate text-[12px] text-danger">{p.moderation_note}</span> : null}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-3">{ago(p.updated_at)}</Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
