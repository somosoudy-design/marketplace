'use client';
import { CLAIM_REASON_LABEL, CLAIM_STATUS_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from './toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Table, Tabs, Td, Textarea } from './ui';
import { ago, claimTone, dateTime } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, kora, run } from '@/lib/kora';

type Claim = { id: string; number: string; order_id: string; fulfillment_id: string; store_id: string; buyer_id: string; reason: string; description: string; status: string; resolution: string | null; created_at: string; updated_at: string; orders: { number: string } | null };
type Msg = { id: number; author_id: string | null; author_role: string; body: string; created_at: string };
const OPEN = ['open', 'seller_responded', 'escalated'];

export function ClaimsBoard({ role, storeId, storeName }: { role: 'admin' | 'seller'; storeId?: string; storeName?: (id: string) => string }) {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [open, setOpen] = useState<Claim | null>(null);
  const q = useQuery({
    queryKey: ['claims', role, storeId, tab],
    queryFn: () => {
      let r = db('claims').select('*, orders(number)').in('status', tab === 'open' ? OPEN : ['resolved', 'rejected']).order('created_at', { ascending: true }).limit(200);
      if (storeId) r = r.eq('store_id', storeId);
      return run<Claim[]>(r);
    },
  });
  const name = useProfiles(role === 'admin' ? (q.data ?? []).map((c) => c.buyer_id) : []);
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: 'Abiertos' }, { value: 'closed', label: 'Cerrados' }]} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? <Empty title={tab === 'open' ? 'No hay reclamos abiertos' : 'Sin reclamos cerrados'} /> : (
          <Table head={['Reclamo', 'Pedido', ...(storeName ? ['Tienda'] : []), ...(role === 'admin' ? ['Cliente'] : []), 'Motivo', 'Estado', 'Abierto', '']}>
            {q.data.map((c) => (
              <tr key={c.id} className="hover:bg-sunken/50">
                <Td className="whitespace-nowrap font-semibold">{c.number}</Td>
                <Td className="whitespace-nowrap">{c.orders?.number}</Td>
                {storeName ? <Td>{storeName(c.store_id)}</Td> : null}
                {role === 'admin' ? <Td>{name(c.buyer_id)}</Td> : null}
                <Td>{CLAIM_REASON_LABEL[c.reason] ?? c.reason}</Td>
                <Td><Badge tone={claimTone[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</Badge></Td>
                <Td className="whitespace-nowrap text-ink-3">{ago(c.created_at)}</Td>
                <Td className="text-right"><Button size="sm" variant={c.status === 'escalated' || (role === 'seller' && c.status === 'open') ? 'primary' : 'secondary'} onClick={() => setOpen(c)}>Abrir</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <ClaimDialog claim={open} role={role} onClose={() => setOpen(null)} />
    </>
  );
}

function ClaimDialog({ claim: c, role, onClose }: { claim: Claim | null; role: 'admin' | 'seller'; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [resolution, setResolution] = useState('');
  const [closing, setClosing] = useState<null | 'resolved' | 'rejected'>(null);
  const msgs = useQuery({ queryKey: ['claim-messages', c?.id], queryFn: () => run<Msg[]>(db('claim_messages').select('*').eq('claim_id', c!.id).order('created_at')), enabled: !!c, refetchInterval: 20_000 });
  const post = useMutation({
    mutationFn: () => kora().api.claims.post(c!.id, body.trim()),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['claim-messages', c!.id] }); qc.invalidateQueries({ queryKey: ['claims'] }); },
    onError: toast.error,
  });
  const resolve = useMutation({
    mutationFn: () => kora().api.admin.resolveClaim(c!.id, closing!, resolution.trim()),
    onSuccess: () => { toast.ok('Reclamo cerrado'); qc.invalidateQueries({ queryKey: ['claims'] }); setClosing(null); setResolution(''); onClose(); },
    onError: toast.error,
  });
  if (!c) return null;
  const isOpen = OPEN.includes(c.status);
  return (
    <Dialog open wide onClose={onClose} title={`Reclamo ${c.number} · ${c.orders?.number ?? ''}`}
      footer={role === 'admin' && isOpen ? (closing ? (
        <><Button variant="ghost" onClick={() => setClosing(null)}>Volver</Button><Button variant={closing === 'rejected' ? 'danger' : 'primary'} disabled={!resolution.trim()} loading={resolve.isPending} onClick={() => resolve.mutate()}>{closing === 'resolved' ? 'Cerrar como resuelto' : 'Cerrar sin lugar'}</Button></>
      ) : (
        <><Button variant="ghost" onClick={() => setClosing('rejected')}>Cerrar sin lugar</Button><Button onClick={() => setClosing('resolved')}>Resolver</Button></>
      )) : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={claimTone[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</Badge><Badge>{CLAIM_REASON_LABEL[c.reason]}</Badge><span className="text-[13px] text-ink-3">{dateTime(c.created_at)}</span></div>
        <p className="whitespace-pre-line rounded-[14px] bg-sunken p-4 text-sm">{c.description}</p>
        {c.resolution ? <Notice tone="success" title="Resolución">{c.resolution}</Notice> : null}
        <ol className="flex flex-col gap-2">
          {(msgs.data ?? []).map((m) => (
            <li key={m.id} className={`max-w-[80%] rounded-[14px] px-4 py-2.5 text-sm ${m.author_role === 'buyer' ? 'self-start bg-sunken' : 'self-end bg-brand-soft'}`}>
              <p className="text-[12px] font-bold text-ink-3">{m.author_role === 'buyer' ? 'Cliente' : m.author_role === 'seller' ? 'Tienda' : 'Kora'} · {ago(m.created_at)}</p>
              <p className="whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ol>
        {isOpen && !closing ? (
          <div className="flex flex-col gap-2">
            <Textarea aria-label="Mensaje" value={body} onChange={(e) => setBody(e.target.value)} placeholder={role === 'seller' ? 'Explica al cliente cómo lo resolverás.' : 'Mensaje para el cliente y la tienda.'} />
            <div className="flex justify-end"><Button size="sm" disabled={!body.trim()} loading={post.isPending} onClick={() => post.mutate()}>Enviar mensaje</Button></div>
          </div>
        ) : null}
        {closing ? (
          <Field label="Resolución (la verán el cliente y la tienda)">
            <Textarea autoFocus value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder={closing === 'resolved' ? 'Reembolsamos 1 unidad; el monto se devuelve por Pago Móvil.' : 'Las fotos muestran el producto en buen estado.'} />
          </Field>
        ) : null}
        {role === 'admin' && closing === 'resolved' ? <Notice tone="info">Si corresponde un reembolso, regístralo desde el detalle del pedido para que el saldo y el libro contable lo reflejen.</Notice> : null}
      </div>
    </Dialog>
  );
}
