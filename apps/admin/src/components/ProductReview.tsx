'use client';
import { MODERATION_LABEL, ORIGIN_LABEL, presentAvailability, RISK_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useToast } from './toast';
import { Badge, Button, Dialog, Field, Notice, Table, Td, Textarea, Thumb } from './ui';
import { dateTime, money, moderationTone } from '@/lib/format';
import { catalogImage, db, kora, run } from '@/lib/kora';

export type ProductRow = {
  id: string; slug: string; title: string; subtitle: string | null; description: string | null; highlights: string[] | null;
  base_price_usd: string | null; compare_at_usd: string | null; availability: string; moderation_status: string; moderation_note: string | null;
  is_demo: boolean; source_url: string | null; source_provider: string | null; origin: string; updated_at: string; store_id: string; category_id: string;
  product_images: { path: string; sort: number }[]; product_variants: { id: string; title: string | null; sku: string | null; price_usd: string; stock: number | null; active: boolean }[];
};

export function ProductReview({ product: p, storeName, category, onClose }: {
  product: ProductRow | null; storeName: string; category?: { name: string; risk_level: string; requires_review: boolean }; onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [needsNote, setNeedsNote] = useState<null | 'rejected' | 'suspended'>(null);
  const history = useQuery({
    queryKey: ['moderation-events', p?.id],
    queryFn: () => run<{ id: number; from_status: string | null; to_status: string; note: string | null; automatic: boolean; created_at: string }[]>(
      db('moderation_events').select('id, from_status, to_status, note, automatic, created_at').eq('product_id', p!.id).order('created_at', { ascending: false })),
    enabled: !!p,
  });
  const moderate = useMutation({
    mutationFn: (status: 'published' | 'in_review' | 'rejected' | 'suspended') => kora().api.admin.moderate(p!.id, status, note.trim() || undefined),
    onSuccess: (_, status) => {
      toast.ok(`«${p!.title}» ahora está ${MODERATION_LABEL[status]?.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setNote(''); setNeedsNote(null);
      onClose();
    },
    onError: toast.error,
  });
  if (!p) return null;
  const images = [...p.product_images].sort((a, b) => a.sort - b.sort);
  const a = presentAvailability(p.availability as never);

  return (
    <Dialog
      open
      wide
      onClose={() => { setNeedsNote(null); setNote(''); onClose(); }}
      title={p.title}
      footer={
        needsNote ? (
          <>
            <Button variant="ghost" onClick={() => setNeedsNote(null)}>Volver</Button>
            <Button variant="danger" disabled={!note.trim()} loading={moderate.isPending} onClick={() => moderate.mutate(needsNote)}>
              {needsNote === 'rejected' ? 'Rechazar' : 'Suspender'}
            </Button>
          </>
        ) : (
          <>
            {p.moderation_status !== 'suspended' ? <Button variant="ghost" onClick={() => setNeedsNote('suspended')}>Suspender</Button> : null}
            {p.moderation_status !== 'rejected' ? <Button variant="ghost" onClick={() => setNeedsNote('rejected')}>Rechazar</Button> : null}
            {p.moderation_status !== 'in_review' ? <Button variant="secondary" loading={moderate.isPending && moderate.variables === 'in_review'} onClick={() => moderate.mutate('in_review')}>Marcar en revisión</Button> : null}
            {p.moderation_status !== 'published' ? <Button loading={moderate.isPending && moderate.variables === 'published'} onClick={() => moderate.mutate('published')}>Publicar</Button> : null}
          </>
        )
      }
    >
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-2">
          {images.length ? images.slice(0, 4).map((i) => <Thumb key={i.path} src={catalogImage(i.path)} alt={p.title} size={220} />) : <Thumb src={null} alt="" size={220} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone={moderationTone[p.moderation_status]}>{MODERATION_LABEL[p.moderation_status]}</Badge>
            <Badge tone="neutral">{a.label}</Badge>
            {p.is_demo ? <Badge tone="editorial">Demostración</Badge> : null}
            {category && category.risk_level !== 'low' ? <Badge tone="danger">Categoría {RISK_LABEL[category.risk_level]?.toLowerCase()}</Badge> : null}
          </div>
          {p.moderation_note ? <Notice tone="warning" title="Nota de moderación">{p.moderation_note}</Notice> : null}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div><dt className="text-[12px] font-semibold text-ink-3">Tienda</dt><dd>{storeName}</dd></div>
            <div><dt className="text-[12px] font-semibold text-ink-3">Categoría</dt><dd>{category?.name ?? '—'}{category?.requires_review ? ' · revisión obligatoria' : ''}</dd></div>
            <div><dt className="text-[12px] font-semibold text-ink-3">Precio de referencia</dt><dd className="tabular">{money(p.base_price_usd, 'USD')}{p.compare_at_usd ? ` · antes ${money(p.compare_at_usd, 'USD')}` : ''}</dd></div>
            <div><dt className="text-[12px] font-semibold text-ink-3">Origen</dt><dd>{ORIGIN_LABEL[p.origin] ?? p.origin}</dd></div>
            {p.source_url ? (
              <div className="col-span-2"><dt className="text-[12px] font-semibold text-ink-3">Fuente</dt>
                <dd><a className="inline-flex items-center gap-1 break-all font-semibold text-brand" href={p.source_url} target="_blank" rel="noreferrer noopener">{p.source_url}<ExternalLink size={13} /></a></dd>
              </div>
            ) : null}
          </dl>
          {p.subtitle ? <p className="font-semibold">{p.subtitle}</p> : null}
          {p.description ? <p className="whitespace-pre-line text-ink-2">{p.description}</p> : <p className="text-ink-3">Sin descripción.</p>}
          {p.highlights?.length ? <ul className="list-disc pl-5 text-ink-2">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul> : null}
          <div className="rounded-[14px] border border-line">
            <Table head={['Variante', 'SKU', 'Precio', 'Stock', '']}>
              {p.product_variants.map((v) => (
                <tr key={v.id}>
                  <Td>{v.title ?? 'Única'}</Td><Td className="font-mono text-[12px]">{v.sku ?? '—'}</Td>
                  <Td className="tabular">{money(v.price_usd, 'USD')}</Td><Td className="tabular">{v.stock ?? 'Sin límite'}</Td>
                  <Td>{v.active ? null : <Badge>Inactiva</Badge>}</Td>
                </tr>
              ))}
            </Table>
          </div>
          {needsNote ? (
            <Field label={needsNote === 'rejected' ? 'Motivo del rechazo (lo verá la tienda)' : 'Motivo de la suspensión (lo verá la tienda)'}>
              <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Las fotos no corresponden al producto. Sube imágenes propias." />
            </Field>
          ) : null}
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink-3">Historial</p>
            <ol className="flex flex-col gap-1.5">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="text-[13px] text-ink-2">
                  <span className="text-ink-3">{dateTime(h.created_at)}</span> · {h.from_status ? `${MODERATION_LABEL[h.from_status]} → ` : ''}<b>{MODERATION_LABEL[h.to_status]}</b>
                  {h.automatic ? ' (automático)' : ''}{h.note ? ` — ${h.note}` : ''}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
