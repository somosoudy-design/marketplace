'use client';
import { useStore } from '@/lib/store';
import { Select } from './ui';

export function StorePicker() {
  const { store, stores, setStoreId } = useStore();
  if (stores.length <= 1) return store ? <p className="break-words px-2 text-[14px] font-bold text-ink [overflow-wrap:anywhere]">{store.name}</p> : null;
  return (
    <Select aria-label="Tienda" title={store?.name} value={store?.id ?? ''} onChange={(e) => setStoreId(e.target.value)}>
      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </Select>
  );
}
