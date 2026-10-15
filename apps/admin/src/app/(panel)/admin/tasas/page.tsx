'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Tabs, Td, Textarea, Toggle } from '@/components/ui';
import { ago, dateTime, money, RATE_SOURCE_LABEL } from '@/lib/format';
import { apiPost, db, kora, rpc, run } from '@/lib/kora';
import { inForce, pct, useGap } from '@/lib/pricing';

const PAIRS = ['USD/VES', 'USDT/VES', 'USD/USDT'] as const;
type Pair = (typeof PAIRS)[number];
type Status = { available: boolean; pair: string; rate?: number; base?: number; source?: string; observed_at?: string; is_manual?: boolean; is_fallback?: boolean; reason?: string; stale_since?: string };
type Policy = { pair: string; primary_source: string; fallback_sources: string[]; margin_pct: string; max_age_minutes: number; rounding_decimals: number; manual_rate: string | null; manual_valid_until: string | null; manual_note: string | null; enabled: boolean; updated_at: string };
type Source = { code: string; name: string; pair: string; kind: string; adapter: string; enabled: boolean; docs_url: string | null; notes: string | null };

export default function RatesPage() {
  const [pair, setPair] = useState<Pair>('USD/VES');
  const [manual, setManual] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['rate-status', pair], queryFn: () => rpc<Status>('rate_status', { p_pair: pair }), refetchInterval: 60_000 });
  const policy = useQuery({ queryKey: ['rate-policy', pair], queryFn: () => run<Policy>(db('rate_policies').select('*').eq('pair', pair).single()) });
  const sources = useQuery({ queryKey: ['rate-sources'], queryFn: () => run<Source[]>(db('exchange_rate_sources').select('*').order('code')) });
  const history = useQuery({
    queryKey: ['rate-history', pair],
    queryFn: () => run<{ id: number; source_code: string; rate: string; observed_at: string; fetched_at: string }[]>(db('exchange_rates').select('id, source_code, rate, observed_at, fetched_at').eq('pair', pair).order('observed_at', { ascending: false }).limit(40)),
  });
  const sync = useMutation({
    mutationFn: () => apiPost<{ results: { source: string; ok: boolean; rate?: number; error?: string }[] }>('/api/rates/sync'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-status'] }).then(() => qc.invalidateQueries({ queryKey: ['rate-history'] })),
    onError: toast.error,
  });
  const toggleSource = useMutation({
    mutationFn: (s: Source) => run(db('exchange_rate_sources').update({ enabled: !s.enabled }).eq('code', s.code)),
    onSuccess: () => qc.invalidateQueries(),
    onError: toast.error,
  });

  const st = status.data;
  return (
    <>
      <PageHeader
        eyebrow="Finanzas"
        title="Tasas de cambio"
        description="Los precios se guardan en USD. La tasa solo se aplica al cotizar un pago y queda registrada en él; las deudas futuras nunca se congelan en bolívares."
        actions={<><Button variant="secondary" icon={RefreshCw} loading={sync.isPending} onClick={() => sync.mutate()}>Consultar fuentes ahora</Button><Button onClick={() => setManual(true)}>Fijar tasa manual</Button></>}
      />
      <GapCard />
      <Tabs value={pair} onChange={setPair} items={PAIRS.map((p) => ({ value: p, label: p }))} />
      {sync.data ? (
        <div className="mb-5 flex flex-col gap-2">
          {sync.data.results.map((r) => (
            <Notice key={r.source} tone={r.ok ? 'success' : 'danger'} title={RATE_SOURCE_LABEL[r.source] ?? r.source}>
              {r.ok ? `Leída: ${r.rate}` : `No disponible: ${r.error}`}
            </Notice>
          ))}
        </div>
      ) : null}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title={`Tasa en uso · ${pair}`}>
          {status.isPending ? <Loading rows={2} /> : status.isError ? <ErrorBox error={status.error} /> : st?.available ? (
            <div className="flex flex-col gap-2">
              <p className="tabular font-display text-5xl font-semibold">{pair.endsWith('VES') ? money(st.rate, 'VES') : st.rate}</p>
              <p className="text-sm text-ink-2">
                {RATE_SOURCE_LABEL[st.source ?? ''] ?? st.source} · observada {ago(st.observed_at)} ({dateTime(st.observed_at)})
              </p>
              <div className="flex flex-wrap gap-2">
                {st.is_manual ? <Badge tone="warning">Manual</Badge> : null}
                {st.is_fallback ? <Badge tone="warning">Fuente de respaldo</Badge> : <Badge tone="success">Fuente principal</Badge>}
                {st.source === 'demo' ? <Badge tone="danger">Demostración: no usar en producción</Badge> : null}
                {st.base != null && Number(st.base) !== Number(st.rate) ? <Badge>Base {st.base} + margen</Badge> : null}
              </div>
            </div>
          ) : (
            <Notice tone="danger" title="Sin tasa válida">
              Ninguna fuente tiene un valor más reciente que el máximo permitido. Los pagos en esta moneda quedan bloqueados hasta que una fuente responda o fijes una tasa manual. Nunca se usa en silencio una tasa vencida.
            </Notice>
          )}
        </Card>
        {policy.data ? <PolicyCard policy={policy.data} sources={sources.data ?? []} /> : <Card title="Política"><Loading rows={3} /></Card>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Historial" padded={false}>
          {history.data?.length ? (
            <Table head={['Observada', 'Fuente', 'Tasa']}>
              {history.data.map((h) => (
                <tr key={h.id}><Td className="whitespace-nowrap text-ink-2">{dateTime(h.observed_at)}</Td><Td>{RATE_SOURCE_LABEL[h.source_code] ?? h.source_code}</Td><Td className="tabular font-semibold">{Number(h.rate).toLocaleString('es-VE', { maximumFractionDigits: 8 })}</Td></tr>
              ))}
            </Table>
          ) : <p className="p-5 text-sm text-ink-3">Sin observaciones.</p>}
        </Card>
        <Card title="Fuentes" padded={false}>
          <Table head={['Fuente', 'Par', 'Tipo', 'Activa']}>
            {(sources.data ?? []).map((s) => (
              <tr key={s.code}>
                <Td><p className="font-semibold">{s.name}</p>{s.notes ? <p className="text-[12px] text-ink-3">{s.notes}</p> : null}</Td>
                <Td>{s.pair === '*' ? 'Todos' : s.pair}</Td>
                <Td>{s.kind === 'official' ? <Badge tone="brand">Oficial</Badge> : s.kind === 'market_reference' ? <Badge>Referencial</Badge> : <Badge tone="warning">Manual</Badge>}</Td>
                <Td><Toggle label={`Activar ${s.name}`} checked={s.enabled} onChange={() => toggleSource.mutate(s)} /></Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <ManualDialog open={manual} onClose={() => setManual(false)} pair={pair} current={policy.data} />
    </>
  );
}

function PolicyCard({ policy: p, sources }: { policy: Policy; sources: Source[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ primary: p.primary_source, fallbacks: p.fallback_sources.join(', '), margin: String(p.margin_pct), maxAge: String(p.max_age_minutes), rounding: String(p.rounding_decimals) });
  const usable = sources.filter((s) => s.pair === p.pair || s.pair === '*');
  const save = useMutation({
    mutationFn: () => {
      const fallbacks = f.fallbacks.split(',').map((x) => x.trim()).filter(Boolean);
      const unknown = fallbacks.filter((x) => !usable.some((s) => s.code === x));
      if (unknown.length) throw new Error(`Fuentes desconocidas: ${unknown.join(', ')}`);
      const margin = Number(f.margin.replace(',', '.'));
      if (!(margin >= 0 && margin <= 20)) throw new Error('El margen debe estar entre 0% y 20%.');
      return run(db('rate_policies').update({ primary_source: f.primary, fallback_sources: fallbacks, margin_pct: margin, max_age_minutes: Number(f.maxAge), rounding_decimals: Number(f.rounding) }).eq('pair', p.pair));
    },
    onSuccess: () => { toast.ok('Política actualizada'); qc.invalidateQueries(); },
    onError: toast.error,
  });
  return (
    <Card title="Política" actions={<Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>Guardar</Button>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fuente principal">
          <Select value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value })}>
            {usable.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Respaldo (en orden)" hint="Códigos separados por coma"><Input value={f.fallbacks} onChange={(e) => setF({ ...f, fallbacks: e.target.value })} /></Field>
        <Field label="Margen (%)" hint="Se suma a la tasa base al cotizar"><Input inputMode="decimal" value={f.margin} onChange={(e) => setF({ ...f, margin: e.target.value })} /></Field>
        <Field label="Antigüedad máxima (min)" hint="Más vieja que esto no se usa"><Input type="number" min={5} value={f.maxAge} onChange={(e) => setF({ ...f, maxAge: e.target.value })} /></Field>
        <Field label="Decimales"><Input type="number" min={0} max={8} value={f.rounding} onChange={(e) => setF({ ...f, rounding: e.target.value })} /></Field>
        {p.manual_rate ? <Field label="Tasa manual vigente"><p className="text-sm">{p.manual_rate} hasta {dateTime(p.manual_valid_until)} · {p.manual_note}</p></Field> : null}
      </div>
    </Card>
  );
}

function ManualDialog({ open, onClose, pair, current }: { open: boolean; onClose: () => void; pair: Pair; current?: Policy }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rate, setRate] = useState('');
  const [minutes, setMinutes] = useState('240');
  const [note, setNote] = useState('');
  const set = useMutation({
    mutationFn: (clear: boolean) => kora().api.admin.setManualRate(pair, clear ? (null as never) : Number(rate.replace(',', '.')), Number(minutes), clear ? 'Tasa manual retirada' : note.trim()),
    onSuccess: (_, clear) => { toast.ok(clear ? 'Tasa manual retirada' : `Tasa manual ${pair} fijada`); qc.invalidateQueries(); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onClose={onClose} title={`Tasa manual · ${pair}`} footer={<>
      {current?.manual_rate ? <Button variant="ghost" loading={set.isPending && set.variables === true} onClick={() => set.mutate(true)}>Retirar tasa manual</Button> : null}
      <Button disabled={!rate || !note.trim()} loading={set.isPending && set.variables === false} onClick={() => set.mutate(false)}>Fijar tasa</Button>
    </>}>
      <div className="flex flex-col gap-4">
        <Notice tone="warning">La tasa manual tiene prioridad sobre las fuentes automáticas mientras esté vigente y queda en auditoría con tu nombre y la nota.</Notice>
        <Field label="Tasa"><Input autoFocus inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej.: 102,35" /></Field>
        <Field label="Vigencia (minutos)"><Input type="number" min={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
        <Field label="Motivo"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="BCV no publicó hoy; tasa tomada de la publicación oficial del día anterior." /></Field>
      </div>
    </Dialog>
  );
}

/**
 * The day's gap (docs/PRECIOS.md): BCV and Binance P2P as they were taken, what Zelle/USDT pay against the BCV
 * price, and the button to take it now from the rates in force (it also reprices the products that follow their cost).
 */
function GapCard() {
  const gap = useGap();
  const qc = useQueryClient();
  const toast = useToast();
  const take = useMutation({
    mutationFn: () => kora().api.admin.takePricingSnapshot('Tomada desde el panel'),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['pricing-snapshots'] });
      toast.ok(`Brecha del día ${pct(r.gap_pct)}.${r.repriced ? ` ${r.repriced === 1 ? '1 precio actualizado' : `${r.repriced} precios actualizados`} según su costo.` : ''}`);
    },
    onError: toast.error,
  });
  const c = gap.current;
  const last = gap.data?.[0];
  return (
    <Card
      className="mb-5"
      title="Brecha del día"
      actions={<Button size="sm" variant="secondary" loading={take.isPending} onClick={() => take.mutate()} data-testid="gap-take">Actualizar brecha ahora</Button>}
    >
      {gap.isPending ? <Loading rows={2} /> : gap.isError ? <ErrorBox error={gap.error} onRetry={() => gap.refetch()} /> : c ? (
        <div className="grid gap-4 sm:grid-cols-4" data-testid="gap-current">
          <div><p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Brecha</p><p className="tabular text-[26px] font-extrabold">{pct(c.gap_pct)}</p></div>
          <div><p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Dólar BCV</p><p className="tabular text-[17px] font-bold">{money(c.bcv_rate, 'VES')}</p><p className="text-[12px] text-ink-3">{RATE_SOURCE_LABEL[c.bcv_source] ?? c.bcv_source}</p></div>
          <div><p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">USDT (P2P)</p><p className="tabular text-[17px] font-bold">{money(c.usdt_ves_rate, 'VES')}</p><p className="text-[12px] text-ink-3">{RATE_SOURCE_LABEL[c.usdt_source] ?? c.usdt_source}</p></div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-ink-3">Zelle y USDT pagan</p>
            <p className="tabular text-[17px] font-bold text-success">{pct((1 - Number(c.bcv_rate) / Number(c.usdt_ves_rate)) * 100)} menos</p>
            <p className="text-[12px] text-ink-3">Tomada {ago(c.taken_at)} · vale hasta {dateTime(c.valid_until)}</p>
          </div>
        </div>
      ) : (
        <Notice tone="warning" title="Sin brecha vigente">
          {last && !inForce(last) ? `La última (${pct(last.gap_pct)}) venció ${ago(last.valid_until)}. ` : ''}
          Mientras no haya una, Zelle y USDT cobran el precio principal y los precios que siguen al costo no cambian. Se toma sola cada hora
          si hace falta; si falla, revisa que las tasas BCV y P2P estén al día.
        </Notice>
      )}
    </Card>
  );
}
