'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from './toast';
import { Badge, Button, Card, Empty, ErrorBox, Input, Loading, Table, Tabs, Td } from './ui';
import { money } from '@/lib/format';
import { useStoresIndex } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type V = { id: string; sku: string | null; title: string | null; price_usd: string; stock: number | null; active: boolean; products: { id: string; title: string; store_id: string; availability: string; moderation_status: string } };

export function StockTable({ storeId, admin }: { storeId?: string; admin?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const stores = useStoresIndex();
  const [tab, setTab] = useState<'low' | 'all'>('low');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ['stock', storeId, tab],
    queryFn: () => {
      let r = db('product_variants').select('id, sku, title, price_usd, stock, active, products!inner(id, title, store_id, availability, moderation_status)').not('stock', 'is', null);
      if (storeId) r = r.eq('products.store_id', storeId);
      if (tab === 'low') r = r.lte('stock', 3);
      return run<V[]>(r.order('stock').limit(500));
    },
  });
  const save = useMutation({
    mutationFn: async (v: V) => {
      const n = Number(draft[v.id]);
      if (!Number.isInteger(n) || n < 0) throw new Error('El inventario debe ser un número entero mayor o igual a 0.');
      await run(db('product_variants').update({ stock: n }).eq('id', v.id));
    },
    onSuccess: (_, v) => { toast.ok('Inventario actualizado'); setDraft(({ [v.id]: _drop, ...rest }) => rest); qc.invalidateQueries({ queryKey: ['stock'] }); },
    onError: toast.error,
  });
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'low', label: 'Bajo o agotado' }, { value: 'all', label: 'Todo el inventario' }]} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data.length ? <Empty title={tab === 'low' ? 'Nada con poco inventario' : 'Sin variantes con inventario controlado'} /> : (
          <Table head={['Producto', ...(admin ? ['Tienda'] : []), 'Variante', 'Precio', 'Inventario', '']}>
            {q.data.map((v) => (
              <tr key={v.id}>
                <Td className="font-semibold">{v.products.title}</Td>
                {admin ? <Td>{stores.name(v.products.store_id)}</Td> : null}
                <Td className="text-ink-2">{v.title ?? 'Única'}{v.sku ? <span className="block font-mono text-[12px] text-ink-3">{v.sku}</span> : null}</Td>
                <Td className="tabular">{money(v.price_usd, 'USD')}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Input aria-label={`Inventario de ${v.products.title}`} type="number" min={0} className="h-9 w-24" value={draft[v.id] ?? String(v.stock ?? 0)} onChange={(e) => setDraft((d) => ({ ...d, [v.id]: e.target.value }))} />
                    {v.stock === 0 ? <Badge tone="danger">Agotado</Badge> : (v.stock ?? 0) <= 3 ? <Badge tone="warning">Bajo</Badge> : null}
                  </div>
                </Td>
                <Td className="text-right">{draft[v.id] != null && draft[v.id] !== String(v.stock) ? <Button size="sm" loading={save.isPending && save.variables?.id === v.id} onClick={() => save.mutate(v)}>Guardar</Button> : null}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

