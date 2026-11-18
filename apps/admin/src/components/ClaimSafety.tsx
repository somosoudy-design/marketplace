'use client';
import type { ClaimUgcReport, UgcReason } from '@kora/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useUgc } from '@/lib/ugc';
import { ago } from '@/lib/format';
import { sameClaimEvidence, retainedClaimReportIntent } from '@/lib/claim-safety-model';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Select, Textarea } from './ui';
import { useToast } from './toast';
type PendingReport = { id: string; reason: UgcReason; detail: string };
const pendingReports = new Map<string, PendingReport>();

export const CLAIM_AUDIENCES = { participants: 'Cliente y tienda', buyer_admin: 'Sólo cliente y MAYAMI', store_admin: 'Sólo tienda y MAYAMI' } as const;
const REASONS: Record<UgcReason, string> = { harassment: 'Amenazas o acoso', hate: 'Odio o discriminación', sexual: 'Contenido sexual', child_safety: 'Seguridad de menores', personal_data: 'Datos personales', fraud: 'Fraude o suplantación', spam: 'Spam', other: 'Otro motivo' };
export function useClaimSafety(claimId: string) {
  const ugc = useUgc();
  const status = useQuery({ queryKey: ['claim-safety', ugc.actorId, claimId, ugc.ownerRevision], queryFn: () => ugc.read(api => api.claimUgc.status(claimId)), enabled: ugc.actorReady && !!ugc.actorId, retry: false, staleTime: 0, gcTime: 0 });
  return { ...ugc, status, statusReady: ugc.actorReady && status.isSuccess && !status.isFetching, available: ugc.actorReady && status.isSuccess && status.data.enabled && !status.isFetching };
}
export function ClaimSafetyActions({ claimId, messageId = null, counterpart = false }: { claimId: string; messageId?: number | null; counterpart?: boolean }) {
  const safety = useClaimSafety(claimId); const qc = useQueryClient(); const toast = useToast();
  const [report, setReport] = useState(false); const [confirm, setConfirm] = useState(false); const [blockIntent, setBlockIntent] = useState<boolean | null>(null); const busy = useRef(false);
  const block = useMutation({
    mutationFn: (value: boolean) => safety.run(api => api.claimUgc.setBlock(claimId, value)),
    onSettled: () => { busy.current = false; },
    onSuccess: () => { if (!safety.isCurrent()) return; setConfirm(false); void qc.invalidateQueries({ queryKey: ['claim-safety', safety.actorId] }); void qc.invalidateQueries({ queryKey: ['claim-messages', safety.actorId] }); void qc.invalidateQueries({ queryKey: ['claims', safety.actorId] }); toast.ok('Preferencia de contacto guardada'); },
  });
  if (!safety.actorReady) return null;
  return <>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" disabled={!safety.available} onClick={() => setReport(true)}>Denunciar {counterpart ? 'contacto' : 'mensaje'}</Button>
      {counterpart ? <Button size="sm" variant="secondary" disabled={!safety.available} onClick={() => { setBlockIntent(!safety.status.data?.own_block); setConfirm(true); }}>{safety.status.data?.own_block ? 'Retirar mi bloqueo' : 'Bloquear contacto'}</Button> : null}
    </div>
    {confirm ? <Dialog open busy={block.isPending} onClose={() => { if (!busy.current) setConfirm(false); }} title={safety.status.data?.own_block ? 'Retirar tu bloqueo' : 'Bloquear contacto directo'} footer={<><Button variant="ghost" disabled={block.isPending} onClick={() => setConfirm(false)}>Cancelar</Button><Button loading={block.isPending} onClick={() => { if (!busy.current && safety.available) { busy.current = true; if (blockIntent !== null) block.mutate(blockIntent); } }}>Confirmar</Button></>}>
      <Notice>{safety.status.data?.own_block ? 'Retirar tu bloqueo no anula otro que siga vigente. Los mensajes privados anteriores no se vuelven públicos.' : 'Se detendrá el contacto directo entre cliente y tienda en todos sus reclamos. Podrás seguir aportando información a MAYAMI y abrir nuevos reclamos. No cambia pedidos, pagos ni resoluciones.'}</Notice>{block.error ? <ErrorBox error={block.error} /> : null}
    </Dialog> : null}
    {report ? <ReportClaim key={`${safety.actorId}:${claimId}:${messageId}`} claimId={claimId} messageId={messageId} onClose={() => setReport(false)} /> : null}
  </>;
}
function ReportClaim({ claimId, messageId, onClose }: { claimId: string; messageId: number | null; onClose: () => void }) {
  const safety = useClaimSafety(claimId); const toast = useToast(); const busy = useRef(false);
  const intentKey = `${safety.actorId}:${claimId}:${messageId ?? 'contact'}`;
  const prior = pendingReports.get(intentKey);
  const [reason, setReason] = useState<UgcReason>(prior?.reason ?? 'harassment'); const [detail, setDetail] = useState(prior?.detail ?? '');
  const [intent, setIntent] = useState<PendingReport | null>(prior ?? null);
  const capacity = !!intent || [...pendingReports.keys()].filter(key => key.startsWith(`${safety.actorId}:`)).length < 20;
  const save = useMutation({ mutationFn: (attempt: NonNullable<typeof intent>) => safety.run(api => api.claimUgc.report(claimId, messageId, attempt.reason, attempt.detail || null, attempt.id)), onSettled: () => { busy.current = false; }, onSuccess: () => { if (safety.isCurrent()) { pendingReports.delete(intentKey); toast.ok('Denuncia recibida para revisión'); onClose(); } } });
  return <Dialog open busy={save.isPending} onClose={() => { if (!busy.current) onClose(); }} title="Denunciar abuso" footer={<><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cerrar</Button><Button disabled={!safety.available || !capacity} loading={save.isPending} onClick={() => { if (busy.current || !capacity) return; const attempt = retainedClaimReportIntent(intent, { id: crypto.randomUUID(), reason, detail: detail.trim() }) as NonNullable<typeof intent>; setIntent(attempt); pendingReports.set(intentKey, attempt); busy.current = true; save.mutate(attempt); }}>{intent ? 'Reintentar la misma denuncia' : 'Enviar denuncia'}</Button></>}>
    <div className="space-y-4"><Notice>La denuncia no cierra tu reclamo ni cambia sus plazos. No necesitas aceptar normas para denunciar.</Notice>{!capacity ? <Notice tone="warning">Tienes denuncias sin confirmar. Reabre y comprueba esas denuncias antes de iniciar otra; no descartaremos sus referencias.</Notice> : null}<Field label="Motivo"><Select value={reason} disabled={!!intent || save.isPending} onChange={e => setReason(e.target.value as UgcReason)}>{Object.entries(REASONS).map(([key, text]) => <option value={key} key={key}>{text}</option>)}</Select></Field><Field label="Detalle opcional"><Textarea value={detail} maxLength={1000} disabled={!!intent || save.isPending} onChange={e => setDetail(e.target.value)} /></Field>{save.error ? <><ErrorBox error={save.error} /><Notice tone="warning">No se confirmó el resultado. Reintentar conserva exactamente la misma denuncia.</Notice></> : null}</div>
  </Dialog>;
}
export function ClaimModeration({ claimId, messageId, hidden, onDone }: { claimId: string; messageId: number; hidden: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return <><Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{hidden ? 'Revisar restauración' : 'Moderar mensaje'}</Button>{open ? <EvidenceDecision claimId={claimId} messageId={messageId} hidden={hidden} onClose={() => setOpen(false)} onDone={onDone} /> : null}</>;
}
function EvidenceDecision({ claimId, messageId, hidden, report, onClose, onDone }: { claimId: string; messageId: number | null; hidden?: boolean; report?: ClaimUgcReport; onClose: () => void; onDone: () => void }) {
  const safety = useClaimSafety(claimId); const busy = useRef(false); const [note, setNote] = useState(''); const [decision, setDecision] = useState<'dismiss' | 'hide_message'>('dismiss'); const [decisionIntent, setDecisionIntent] = useState<{ decision: 'dismiss' | 'hide_message'; note: string } | null>(null);
  const evidence = useQuery({ queryKey: ['claim-evidence', safety.actorId, messageId, safety.ownerRevision], queryFn: () => safety.read(api => api.claimUgc.messageEvidence(messageId!)), enabled: safety.actorReady && messageId !== null, retry: false, staleTime: 0, gcTime: 0 });
  const save = useMutation({
    mutationFn: async (attempt: { decision: 'dismiss' | 'hide_message'; note: string }) => {
      if ((!report || attempt.decision === 'hide_message') && messageId !== null) {
        const fresh = await safety.run(api => api.claimUgc.messageEvidence(messageId));
        if (!sameClaimEvidence(evidence.data, fresh)) throw new Error('El contenido o su estado cambió. Actualiza y vuelve a revisarlo.');
      }
      if (report) return safety.run(api => api.claimUgc.resolveReport(report.id, attempt.decision, attempt.note));
      return safety.run(api => api.claimUgc.moderateMessage(messageId!, !hidden, attempt.note));
    }, onSettled: () => { busy.current = false; }, onSuccess: () => { if (safety.isCurrent()) { onDone(); onClose(); } },
  });
  const canWrite = safety.available && !!note.trim() && (report && decision === 'dismiss' || evidence.isSuccess && !evidence.isFetching);
  return <Dialog open busy={save.isPending} onClose={() => { if (!busy.current) onClose(); }} title={report ? 'Revisar denuncia de reclamo' : hidden ? 'Restaurar mensaje' : 'Retirar mensaje'} footer={<><Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancelar</Button><Button disabled={!canWrite} loading={save.isPending} onClick={() => { if (!busy.current && canWrite) { const attempt = decisionIntent ?? { decision, note: note.trim() }; setDecisionIntent(attempt); busy.current = true; save.mutate(attempt); } }}>Registrar decisión</Button></>}>
    <div className="space-y-4">{report ? <Notice>{REASONS[report.reason]}{report.detail ? `: ${report.detail}` : ''}</Notice> : null}
      {messageId !== null ? evidence.isPending ? <Loading /> : evidence.isError ? <ErrorBox error={evidence.error} onRetry={() => evidence.refetch()} /> : <section aria-label="Evidencia privada administrativa"><p className="mb-2 font-semibold">Evidencia privada, sólo administración</p><p className="whitespace-pre-wrap rounded-[14px] bg-sunken p-4 text-sm">{evidence.data.body}</p><p className="mt-2 text-xs text-ink-3">{CLAIM_AUDIENCES[evidence.data.audience]} · {evidence.data.hidden ? 'Retirado' : 'Visible a sus destinatarios'}</p></section> : <Notice>Denuncia del interlocutor, sin mensaje asociado. No se retirará contenido al resolverla.</Notice>}
      {report ? <Field label="Decisión"><Select disabled={save.isPending || !!decisionIntent} value={decision} onChange={e => setDecision(e.target.value as typeof decision)}><option value="dismiss">Cerrar sin retirar contenido</option><option value="hide_message" disabled={messageId === null || evidence.data?.hidden}>Retirar mensaje denunciado</option></Select></Field> : null}
      <Field label="Motivo de la decisión"><Textarea value={note} maxLength={300} disabled={save.isPending || !!decisionIntent} onChange={e => setNote(e.target.value)} /></Field><Notice>No cambia la resolución comercial. Una queja negativa pero legítima no es abuso. Restaurar devuelve el texto sólo a su audiencia original.</Notice>{save.error ? <ErrorBox error={save.error} onRetry={() => evidence.refetch()} /> : null}
    </div>
  </Dialog>;
}
export function ClaimReportsBoard() {
  const ugc = useUgc(); const [page, setPage] = useState(0); const [selected, setSelected] = useState<ClaimUgcReport | null>(null); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['claim-reports', ugc.actorId, page, ugc.ownerRevision], queryFn: () => ugc.read(api => api.claimUgc.reports(25, page * 25)), enabled: ugc.actorReady && !!ugc.actorId, staleTime: 0, gcTime: 0, retry: false });
  const done = () => { void qc.invalidateQueries({ queryKey: ['claim-reports', ugc.actorId] }); void qc.invalidateQueries({ queryKey: ['claim-messages', ugc.actorId] }); void qc.invalidateQueries({ queryKey: ['claim-evidence', ugc.actorId] }); };
  if (!ugc.actorReady) return null;
  return <section className="mt-8" aria-label="Denuncias de reclamos"><h2 className="mb-4 font-display text-xl font-semibold">Denuncias de reclamos</h2><Card>{q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : q.data.items.length === 0 ? <Empty title="No hay denuncias en esta página" /> : <ul className="divide-y divide-line">{q.data.items.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{REASONS[r.reason]} <Badge>{r.status === 'open' ? 'Pendiente' : 'Resuelta'}</Badge></p><p className="text-xs text-ink-3">{ago(r.created_at)}</p>{r.resolution_note ? <p className="text-sm">{r.resolution_note}</p> : null}</div>{r.status === 'open' ? <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>Revisar</Button> : null}</li>)}</ul>}</Card><nav className="mt-4 flex items-center justify-between gap-3" aria-label="Páginas de denuncias"><Button variant="secondary" disabled={page === 0 || q.isFetching} onClick={() => setPage(p => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="secondary" disabled={!q.data || (page + 1) * 25 >= q.data.total || q.isFetching} onClick={() => setPage(p => p + 1)}>Siguiente</Button></nav>{selected ? <EvidenceDecision key={`${ugc.actorId}:${selected.id}`} claimId={selected.claim_id} messageId={selected.message_id} report={selected} onClose={() => setSelected(null)} onDone={done} /> : null}</section>;
}
