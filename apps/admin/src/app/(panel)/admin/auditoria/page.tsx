'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, ErrorBox, Input, Loading, PageHeader, Select, Table, Td } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, run } from '@/lib/kora';

type Row = { id: number; actor_id: string | null; actor_role: string | null; action: string; entity: string; entity_id: string | null; data: unknown; created_at: string };
const ENTITIES = ['', 'payment', 'order', 'product', 'store', 'user', 'payout', 'cargo_batch', 'rate_policies', 'payment_methods', 'app_settings', 'claim'];

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const q = useQuery({
    queryKey: ['audit', entity, action],
    queryFn: () => {
      let r = db('audit_log').select('*').order('id', { ascending: false }).limit(300);
      if (entity) r = r.eq('entity', entity);
      if (action.trim()) r = r.ilike('action', `%${action.trim()}%`);
      return run<Row[]>(r);
    },
  });
  const name = useProfiles((q.data ?? []).map((r) => r.actor_id));
  return (
    <>
      <PageHeader eyebrow="Plataforma" title="Auditoría" description="Registro inmutable de las acciones sensibles: verificación de pagos, reembolsos, tasas, moderación, liquidaciones, permisos y cambios de configuración." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Entidad" value={entity} onChange={(e) => setEntity(e.target.value)} className="w-auto">{ENTITIES.map((e) => <option key={e} value={e}>{e || 'Todas las entidades'}</option>)}</Select>
        <Input aria-label="Acción" placeholder="Acción (ej. review, refund)" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
      </div>
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data.length ? <Empty title="Sin registros" /> : (
          <Table head={['Fecha', 'Quién', 'Acción', 'Entidad', 'Detalle']}>
            {q.data.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-ink-3">{dateTime(r.created_at)}</Td>
                <Td>{r.actor_id ? name(r.actor_id) : r.actor_role ?? 'sistema'}</Td>
                <Td className="font-semibold">{r.action}</Td>
                <Td className="whitespace-nowrap text-ink-2">{r.entity}{r.entity_id ? <span className="block font-mono text-[11px] text-ink-3">{r.entity_id.slice(0, 13)}</span> : null}</Td>
                <Td><code className="block max-w-[520px] truncate text-[12px] text-ink-2" title={JSON.stringify(r.data)}>{r.data ? JSON.stringify(r.data) : ''}</code></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
