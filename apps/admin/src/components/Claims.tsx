'use client';
import { CLAIM_REASON_LABEL, CLAIM_STATUS_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ClaimAudience } from '@kora/api';
import { UgcActorChangedError } from '@kora/api';
import { useUgc } from '@/lib/ugc';
import { useAuth } from '@/lib/auth';
import { claimRecipientsReady } from '@/lib/claim-safety-model';
import { ClaimSafetyActions, ClaimModeration, ClaimReportsBoard, CLAIM_AUDIENCES, useClaimSafety } from './ClaimSafety';
import { useToast } from './toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Table, Tabs, Td, Textarea, Select } from './ui';
import { ago, claimTone, dateTime } from '@/lib/format';
import { koraForActor, run } from '@/lib/kora';
import { brand } from '@/lib/brand';

type Claim = { id: string; number: string; order_id: string; fulfillment_id: string; store_id: string; buyer_id: string; reason: string; description: string; status: 'open' | 'seller_responded' | 'escalated' | 'resolved' | 'rejected'; resolution: string | null; created_at: string; updated_at: string; orders: { number: string } | null };
type Msg = { id: number; author_id: string | null; author_role: string; body: string; created_at: string; audience: ClaimAudience; hidden: boolean; content_version: number };
const OPEN: Array<'open' | 'seller_responded' | 'escalated' | 'resolved' | 'rejected'> = ['open', 'seller_responded', 'escalated'];

type BoardProps = { role: 'admin' | 'seller'; storeId?: string; storeName?: (id: string) => string };
export function ClaimsBoard(props: BoardProps) {
  const { userId } = useAuth();
  return <ClaimsForActor key={`${userId}:${props.role}:${props.storeId ?? ''}`} {...props} />;
}
function ClaimsForActor({ role, storeId, storeName }: BoardProps) {
  const ugc = useUgc();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [open, setOpen] = useState<Claim | null>(null);
  const q = useQuery({
    queryKey: ['claims', ugc.actorId, role, storeId, tab, ugc.ownerRevision],
    enabled: ugc.actorReady && !!ugc.actorId, gcTime: 0,
    queryFn: async () => {
      const bound = await koraForActor(ugc.actorId!);
      await bound.assertCurrent();
      let r = bound.client.from('claims').select('*, orders(number)').in('status', tab === 'open' ? OPEN : ['resolved', 'rejected']).order('created_at', { ascending: true }).limit(200);
      if (storeId) r = r.eq('store_id', storeId);
      const result = await run<Claim[]>(r);
      await bound.assertCurrent();
      if (!ugc.isOwnerCurrent()) throw new UgcActorChangedError();
      return result;
    },
  });
  const buyerIds = [...new Set((q.data ?? []).map(c => c.buyer_id))].sort();
  const names = useQuery({
    queryKey: ['claim-buyer-names', ugc.actorId, buyerIds.join(','), ugc.ownerRevision],
    enabled: role === 'admin' && ugc.actorReady && !!ugc.actorId && buyerIds.length > 0,
    gcTime: 0,
    queryFn: async () => {
      const bound = await koraForActor(ugc.actorId!); await bound.assertCurrent();
      const rows = await run<Array<{ id: string; full_name: string | null }>>(bound.client.from('profiles').select('id,full_name').in('id', buyerIds));
      await bound.assertCurrent(); if (!ugc.isOwnerCurrent()) throw new UgcActorChangedError();
      return Object.fromEntries(rows.map(row => [row.id, row.full_name ?? 'Cliente']));
    },
  });
  const name = (id: string) => names.data?.[id] ?? 'Cliente';
  if (!ugc.actorReady) return <Loading />;
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
      {open && ugc.actorReady ? <ClaimDialog key={`${ugc.actorId}:${open.id}`} claim={open} role={role} onClose={() => setOpen(null)} /> : null}
      {role === 'admin' ? <ClaimReportsBoard key={ugc.actorId} /> : null}
    </>
  );
}

function ClaimDialog({ claim: c, role, onClose }: { claim: Claim; role: 'admin' | 'seller'; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast(); const safety = useClaimSafety(c.id); const writing = useRef(false);
  const [body, setBody] = useState(''); const [resolution, setResolution] = useState('');
  const [closing, setClosing] = useState<null | 'resolved' | 'rejected'>(null);
  const [audience, setAudience] = useState<'' | ClaimAudience>(''); const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);
  const msgs = useQuery({ queryKey: ['claim-messages', safety.actorId, c.id, safety.ownerRevision], queryFn: async () => await safety.read(api => api.claims.messages(c.id)) as unknown as Msg[], enabled: safety.actorReady && !!safety.actorId, refetchInterval: 20_000, gcTime: 0 });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['claim-messages', safety.actorId, c.id] }); void qc.invalidateQueries({ queryKey: ['claims', safety.actorId] }); void qc.invalidateQueries({ queryKey: ['claim-evidence', safety.actorId] }); };
  const admin = safety.status.data?.actor_role === 'admin';
  const policy = safety.state.data; const accepted = !!policy && 'accepted' in policy && policy.accepted;
  const consent = !!policy && (accepted || acceptedVersion === policy.version);
  const post = useMutation({
    mutationFn: async (attempt: { body: string; audience: '' | ClaimAudience; admin: boolean; controlsEnabled: boolean }) => {
      const current = await safety.run(api => api.claimUgc.status(c.id));
      if (current.enabled !== attempt.controlsEnabled || (current.actor_role === 'admin') !== attempt.admin) throw new Error('Los controles cambiaron. Revisa el envío actualizado antes de continuar.');
      const fresh = await safety.run(api => api.ugc.status());
      if (!fresh.accepted) { if (acceptedVersion !== fresh.version) throw new Error('Lee y acepta las normas vigentes antes de enviar.'); await safety.run(api => api.ugc.accept(fresh.version)); }
      if (attempt.admin && attempt.controlsEnabled) { if (!attempt.audience) throw new Error('Elige los destinatarios del mensaje.'); return safety.run(api => api.claimUgc.adminMessage(c.id, attempt.body, attempt.audience as ClaimAudience)); }
      if (attempt.admin && attempt.audience !== 'participants') throw new Error('Los destinatarios privados todavía no están habilitados.');
      return safety.run(api => api.claims.post(c.id, attempt.body));
    }, onSettled: () => { writing.current = false; },
    onSuccess: () => { if (!safety.isCurrent()) return; setBody(''); setAudience(''); refresh(); },
    onError: () => { if (safety.isCurrent()) { refresh(); void safety.state.refetch(); void safety.status.refetch(); } },
  });
  const resolve = useMutation({
    mutationFn: (attempt: { closing: 'resolved' | 'rejected'; resolution: string }) => safety.run(api => api.admin.resolveClaim(c.id, attempt.closing, attempt.resolution)),
    onSettled: () => { writing.current = false; },
    onSuccess: () => { if (!safety.isCurrent()) return; toast.ok('Reclamo cerrado'); refresh(); onClose(); },
  });
  if (!safety.actorReady) return null;
  const isOpen = OPEN.includes(c.status); const pending = post.isPending || resolve.isPending;
  const send = () => { if (writing.current || !safety.statusReady || !consent || !body.trim() || !claimRecipientsReady(admin, audience)) return; writing.current = true; post.mutate({ body: body.trim(), audience, admin, controlsEnabled: safety.status.data?.enabled === true }); };
  return (
    <Dialog open wide busy={pending} onClose={() => { if (!writing.current) onClose(); }} title={`Reclamo ${c.number} · ${c.orders?.number ?? ''}`}
      footer={admin && isOpen ? (closing ? (
        <><Button variant="ghost" onClick={() => setClosing(null)}>Volver</Button><Button variant={closing === 'rejected' ? 'danger' : 'primary'} disabled={!resolution.trim() || pending} loading={resolve.isPending} onClick={() => { if (!writing.current && closing) { writing.current = true; resolve.mutate({ closing, resolution: resolution.trim() }); } }}>{closing === 'resolved' ? 'Cerrar como resuelto' : 'Cerrar sin lugar'}</Button></>
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
              <p className="text-[12px] font-bold text-ink-3">{m.author_role === 'buyer' ? 'Cliente' : m.author_role === 'seller' ? 'Tienda' : brand.name} · {ago(m.created_at)}</p>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-1 text-xs text-ink-3">{CLAIM_AUDIENCES[m.audience ?? 'participants']}{m.hidden ? ' · Retirado por moderación' : ''}</p>
              {safety.available ? admin ? <ClaimModeration claimId={c.id} messageId={m.id} hidden={m.hidden === true} onDone={refresh} /> : m.author_role !== 'seller' ? <ClaimSafetyActions claimId={c.id} messageId={m.id} /> : null : null}
            </li>
          ))}
        </ol>
        {msgs.isError ? <ErrorBox error={msgs.error} onRetry={() => msgs.refetch()} /> : null}
        {safety.status.isError ? <ErrorBox error={safety.status.error} onRetry={() => safety.status.refetch()} /> : null}
        {safety.status.data?.blocked ? <Notice tone="warning">Contacto directo bloqueado. Los nuevos mensajes de cada parte sólo los recibe MAYAMI. El historial y la posibilidad de reclamar se conservan.</Notice> : null}
        {!admin && safety.available ? <ClaimSafetyActions claimId={c.id} counterpart /> : null}
        {isOpen && !closing ? (
          <div className="flex flex-col gap-3">
            {admin ? <Field label="Destinatarios del mensaje"><Select value={audience} disabled={pending} onChange={e => setAudience(e.target.value as typeof audience)}><option value="">Elige los destinatarios</option>{Object.entries(CLAIM_AUDIENCES).filter(([value]) => safety.available || value === 'participants').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field> : null}
            <Textarea aria-label="Mensaje" value={body} maxLength={2000} disabled={pending} onChange={e => setBody(e.target.value)} placeholder={safety.status.data?.blocked && !admin ? 'Información para MAYAMI…' : role === 'seller' ? 'Explica cómo lo resolverás.' : 'Escribe un mensaje…'} />
            {safety.state.isPending ? <Loading /> : safety.state.isError ? <ErrorBox error={safety.state.error} onRetry={() => safety.state.refetch()} /> : policy ? <section aria-label="Normas para mensajes" className="rounded-[14px] border border-line p-4 text-sm"><p className="font-semibold">{policy.policy.title}</p><div className="my-3 space-y-2">{policy.policy.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>{accepted ? <p>Normas vigentes aceptadas.</p> : <label className="flex items-start gap-2"><input type="checkbox" checked={acceptedVersion === policy.version} disabled={pending} onChange={e => setAcceptedVersion(e.target.checked ? policy.version : null)} />He leído y acepto estas normas para enviar mensajes.</label>}</section> : null}
            <div className="flex justify-end"><Button size="sm" disabled={!body.trim() || !consent || !safety.statusReady || !claimRecipientsReady(admin, audience)} loading={post.isPending} onClick={send}>Enviar mensaje</Button></div>
            {post.error ? <><ErrorBox error={post.error} /><Notice tone="warning">No se confirmó el envío. Comprueba la conversación actualizada antes de volver a enviarlo.</Notice></> : null}
          </div>
        ) : null}
        {closing ? (
          <Field label="Resolución (la verán el cliente y la tienda)">
            <Textarea autoFocus value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder={closing === 'resolved' ? 'Reembolsamos 1 unidad; el monto se devuelve por Pago Móvil.' : 'Las fotos muestran el producto en buen estado.'} />
          </Field>
        ) : null}
        {resolve.error ? <ErrorBox error={resolve.error} /> : null}
        {admin && closing === 'resolved' ? <Notice tone="info">Si corresponde un reembolso, regístralo desde el detalle del pedido para que el saldo y el libro contable lo reflejen.</Notice> : null}
      </div>
    </Dialog>
  );
}
