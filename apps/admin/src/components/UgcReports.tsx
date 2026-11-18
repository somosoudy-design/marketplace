'use client';
import type { UgcDecision, UgcReport } from '@kora/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useUgc } from '@/lib/ugc';
import { ago } from '@/lib/format';
import { useToast } from './toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Loading, Notice, Select, Tabs, Textarea } from './ui';

const TARGETS: Record<UgcReport['target'], string> = {
  review: 'Opinión', reply: 'Respuesta de tienda', review_author: 'Autor de opinión', store_author: 'Tienda que responde',
};
const REASONS: Record<UgcReport['reason'], string> = {
  harassment: 'Amenazas o acoso', hate: 'Odio o discriminación', sexual: 'Contenido sexual', child_safety: 'Seguridad infantil',
  personal_data: 'Datos personales', fraud: 'Fraude o suplantación', spam: 'Spam o publicidad', other: 'Otro motivo',
};
const codeOf = (error: unknown) => {
  const e = error as { code?: string; cause?: { hint?: string } };
  return e?.cause?.hint ?? e?.code;
};

export function UgcReportsBoard() {
  const { userId } = useAuth();
  return <ReportsForActor key={userId ?? 'guest'} />;
}

function ReportsForActor() {
  const ugc = useUgc();
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [selected, setSelected] = useState<UgcReport | null>(null);
  const q = useQuery({
    queryKey: ['ugc-reports', ugc.actorId, tab],
    queryFn: () => ugc.run(api => api.ugc.reports(tab)),
    enabled: ugc.actorReady !== false && !!ugc.actorId && ugc.state.isSuccess,
  });
  if (ugc.actorReady === false) return <Loading />;
  return (
    <section aria-label="Denuncias de opiniones" data-testid="ugc-reports-board">
      <h2 className="mb-3 font-display text-xl font-semibold">Denuncias de opiniones</h2>
      <p className="mb-4 text-sm text-ink-3">Una denuncia requiere revisión. No oculta contenido ni cambia la reputación por sí sola.</p>
      <Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: 'Pendientes' }, { value: 'resolved', label: 'Resueltas' }]} />
      {ugc.state.isError ? <ErrorBox error={ugc.state.error} onRetry={() => ugc.state.refetch()} /> : null}
      {ugc.state.isSuccess && !ugc.enabled ? <div className="mb-4"><Notice tone="info">La consulta está preparada; las decisiones sobre denuncias aún no están disponibles.</Notice></div> : null}
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !q.data.length ? <Empty title={tab === 'open' ? 'No hay denuncias pendientes' : 'No hay denuncias resueltas'} /> : (
          <ul className="divide-y divide-line">
            {q.data.map(report => (
              <li key={report.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start" data-testid={`ugc-report-${report.id}`}>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{TARGETS[report.target]}</span><Badge>{REASONS[report.reason]}</Badge><span className="text-xs text-ink-3">{ago(report.created_at)}</span></div>
                  {report.excerpt ? <p className="whitespace-pre-wrap text-sm text-ink">{report.excerpt}</p> : <p className="text-sm text-ink-3">Sin extracto de texto.</p>}
                  {report.detail ? <p className="text-sm text-ink-2">Detalle de la denuncia: {report.detail}</p> : null}
                  {report.status === 'resolved' ? <Notice title="Decisión registrada">{report.decision === 'dismiss' ? 'Sin retirada de contenido.' : report.decision === 'hide_reply' ? 'Se retiró sólo la respuesta.' : 'Se retiró la opinión.'} {report.resolution_note}</Notice> : null}
                </div>
                {report.status === 'open' ? <Button variant="secondary" size="sm" disabled={!ugc.enabled} onClick={() => setSelected(report)} data-testid={`review-report-${report.id}`}>Revisar</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {q.data?.length === 100 ? <p className="mt-3 text-sm text-ink-3">Se muestran hasta 100 denuncias por tanda. Al resolver pendientes, actualiza para consultar las siguientes.</p> : null}
      {selected ? <ResolveReport key={`${ugc.actorId}:${selected.id}`} report={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

type Intent = { decision: UgcDecision; note: string };
function ResolveReport({ report, onClose }: { report: UgcReport; onClose: () => void }) {
  const ugc = useUgc();
  const qc = useQueryClient();
  const toast = useToast();
  const sending = useRef(false);
  const cancel = () => { if (!sending.current) onClose(); };
  const [decision, setDecision] = useState<'' | UgcDecision>('');
  const [note, setNote] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const reply = report.target === 'reply' || report.target === 'store_author';
  const contextArgs = { storeId: null, status: null, maxRating: null, pending: false, limit: 1, offset: 0, reviewId: report.review_id };
  const context = useQuery({
    queryKey: ['ugc-report-context', ugc.actorId, report.id, report.review_id],
    queryFn: () => ugc.run(api => api.ugc.staffPage(contextArgs)),
    enabled: ugc.actorReady !== false && !!ugc.actorId && !!report.review_id,
    staleTime: 0,
  });
  const current = context.data?.items[0];
  const currentText = current ? (reply ? current.reply_body : current.body) : null;
  const changed = !current || currentText !== report.excerpt;
  const alreadyHidden = current && (reply ? current.reply_status === 'hidden' : current.status === 'hidden');
  const canHide = context.isSuccess && !context.isFetching && !changed && !alreadyHidden;
  const save = useMutation({
    onSettled: () => { sending.current = false; },
    mutationFn: async (attempt: Intent) => {
      if (attempt.decision !== 'dismiss') {
        const fresh = await ugc.run(api => api.ugc.staffPage(contextArgs));
        const row = fresh.items[0];
        if (!row || (reply ? row.reply_body : row.body) !== report.excerpt) {
          throw Object.assign(new Error('El contenido cambió desde la denuncia. Revisa su estado actual en Opiniones antes de retirarlo.'), { code: 'ugc_review_changed' });
        }
      }
      return ugc.run(api => api.ugc.resolveReport(report.id, attempt.decision, attempt.note));
    },
    onSuccess: () => {
      if (!ugc.isCurrent()) return;
      toast.ok('Decisión registrada');
      onClose();
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['ugc-reports', ugc.actorId] }),
        qc.invalidateQueries({ queryKey: ['ugc-staff-reviews', ugc.actorId] }),
        qc.invalidateQueries({ queryKey: ['ugc-reviews-summary', ugc.actorId] }),
      ]);
    },
    onError: error => {
      if (!ugc.isCurrent()) return;
      if (['ugc_review_changed', 'invalid_input', 'not_found', 'auth_required', 'admin_required', 'forbidden'].includes(codeOf(error) ?? '')) {
        setIntent(null);
        void context.refetch();
      }
    },
  });
  const send = () => {
    if (!ugc.enabled || sending.current) return;
    const attempt = intent ?? (decision ? { decision, note: note.trim() } : null);
    if (!attempt?.note) return;
    sending.current = true; setIntent(attempt);
    save.mutate(attempt);
  };
  const retrySame = !!intent && save.isError;
  if (ugc.actorReady === false) return null;
  return (
    <Dialog open busy={save.isPending} onClose={cancel} title="Revisar denuncia"
      footer={<><Button variant="ghost" disabled={save.isPending} onClick={cancel}>Cancelar</Button><Button disabled={!ugc.enabled || (!intent && (!decision || !note.trim() || (decision !== 'dismiss' && !canHide)))} loading={save.isPending} onClick={send} data-testid="ugc-resolve-report">{retrySame ? 'Reintentar la misma decisión' : 'Registrar decisión'}</Button></>}
    >
      <div className="space-y-4">
        <div className="rounded-[14px] bg-sunken p-4 text-sm"><p className="font-semibold">{TARGETS[report.target]} · {REASONS[report.reason]}</p><p className="mt-2 text-ink-3">Contenido incluido en la denuncia</p><p className="whitespace-pre-wrap">{report.excerpt ?? 'Sin texto.'}</p>{report.detail ? <p className="mt-2">{report.detail}</p> : null}</div>
        {context.isPending && report.review_id ? <Loading /> : context.isError ? <ErrorBox error={context.error} onRetry={() => context.refetch()} /> : <div className="text-sm"><p className="font-semibold">Contenido actual</p><p className="mt-1 whitespace-pre-wrap text-ink-2">{current ? currentText ?? 'Sin texto.' : 'La opinión ya no está disponible.'}</p></div>}
        {changed ? <Notice tone="warning">El contenido actual no coincide con el extracto denunciado. Puedes cerrar la denuncia sin retirar contenido; revisa el contexto actual en Opiniones antes de moderarlo.</Notice> : alreadyHidden ? <Notice>El contenido ya está oculto. Puedes registrar el cierre de esta denuncia sin retirarlo otra vez.</Notice> : null}
        <Field label="Decisión"><Select disabled={save.isPending || !!intent} value={decision} onChange={event => setDecision(event.target.value as '' | UgcDecision)} data-testid="ugc-report-decision"><option value="">Elige una decisión</option><option value="dismiss">Cerrar sin retirar contenido</option><option value={reply ? 'hide_reply' : 'hide_review'} disabled={!canHide}>{reply ? 'Ocultar sólo la respuesta' : 'Ocultar la opinión'}</option></Select></Field>
        <Field label="Motivo de la decisión" hint={`${note.length}/300 · Queda en auditoría.`}><Textarea value={note} disabled={save.isPending || !!intent} onChange={event => setNote(event.target.value.slice(0, 300))} rows={3} data-testid="ugc-report-note" /></Field>
        <Notice tone="info">Una opinión negativa pero honesta no es motivo para retirarla. Ocultar una respuesta conserva la opinión y su calificación.</Notice>
        {save.error ? <><ErrorBox error={save.error} />{retrySame ? <Notice tone="warning">No se confirmó el resultado. Reintenta esta misma decisión; no la cambiaremos automáticamente.</Notice> : null}</> : null}
      </div>
    </Dialog>
  );
}
