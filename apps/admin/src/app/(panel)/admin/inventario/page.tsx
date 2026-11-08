'use client';
import { useState } from 'react';
import { StockTable } from '@/components/StockTable';
import { PageHeader, Select } from '@/components/ui';
import { useStoresIndex } from '@/lib/hooks';

export default function InventoryPage() {
  const stores = useStoresIndex();
  const [storeId, setStoreId] = useState('');
  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Inventario" description="Al llegar a cero, el producto pasa a agotado automáticamente y quienes pidieron aviso reciben la notificación cuando vuelva." actions={
        <Select aria-label="Tienda" value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-auto"><option value="">Todas las tiendas</option>{stores.list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      } />
      <StockTable admin storeId={storeId || undefined} />
    </>
  );
}
