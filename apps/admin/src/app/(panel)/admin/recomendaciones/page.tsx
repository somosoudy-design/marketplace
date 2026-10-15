'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Stat, Table, Tabs, Td } from '@/components/ui';
import { date } from '@/lib/format';
import { db, kora, run } from '@/lib/kora';

const PERIODS = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
] as const;
type Period = (typeof PERIODS)[number]['value'];

const SLOT_NAMES: Record<string, string> = {
  home_for_you: 'Inicio · Para ti',
  home_featured: 'Inicio · Destacados',
  home_popular: 'Inicio · Lo más elegido',
  home_recent: 'Inicio · Vistos recientemente',
  cart_empty: 'Carrito vacío · Sugerencias',
  related: 'Ficha de producto · Relacionados',
};

/** Below this many impressions a CTR difference between two spaces is mostly noise. */
const SMALL_SAMPLE = 1000;

type Key = 'affinity' | 'popularity' | 'freshness' | 'available' | 'editorial' | 'seen_penalty' | 'max_per_category' | 'max_per_store';
const PARAMS: { key: Key; label: string; hint: string; cap?: boolean }[] = [
  { key: 'affinity', label: 'Afinidad con sus intereses', hint: 'Categorías que la persona vio, guardó o compró en los últimos 90 días.' },
  { key: 'popularity', label: 'Popularidad', hint: 'Ventas y visitas recientes en todo el catálogo.' },
  { key: 'freshness', label: 'Novedad', hint: 'Productos publicados en los últimos 45 días.' },
  { key: 'available', label: 'Entrega inmediata', hint: 'Productos con inventario listo para enviar.' },
  { key: 'editorial', label: 'Selección editorial', hint: 'Productos que están en una colección activa.' },
  { key: 'seen_penalty', label: 'Penalización por ya visto', hint: 'Resta a lo que la persona abrió varias veces en los últimos 3 días.' },
  { key: 'max_per_category', label: 'Máximo por categoría', hint: 'Productos de una misma categoría en una lista.', cap: true },
  { key: 'max_per_store', label: 'Máximo por tienda', hint: 'Productos de una misma tienda en una lista.', cap: true },
];
// the values the platform ships with (default_config migration)
const DEFAULTS: Record<Key, number> = { affinity: 3, popularity: 1.5, freshness: 0.8, available: 0.6, editorial: 0.7, seen_penalty: 0.5, max_per_category: 4, max_per_store: 5 };

const int = (n: number) => n.toLocaleString('es-VE');
const pct = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('es-VE', { maximumFractionDigits: 1 })} %`);
/** Decimal comma, as everything else in the panel; both 1,5 and 1.5 are accepted when typing. */
const show = (n: number) => String(n).replace('.', ',');
const ratio = (a: number, b: number) => (b > 0 ? Math.round((1000 * a) / b) / 10 : null);

export default function RecommendationsPage() {
  const [period, setPeriod] = useState<Period>('14');
  const q = useQuery({ queryKey: ['rec-metrics', period], queryFn: () => kora().api.admin.recommendationMetrics(Number(period)) });
  const collections = useQuery({
    queryKey: ['collection-names'],
    queryFn: () => run<{ slug: string; title: string }[]>(db('collections').select('slug, title')),
    staleTime: 5 * 60_000,
  });
  const slotName = (slot: string) => {
    if (SLOT_NAMES[slot]) return SLOT_NAMES[slot];
    if (slot.startsWith('collection:')) {
      const slug = slot.slice('collection:'.length);
      return `Colección · ${collections.data?.find((c) => c.slug === slug)?.title ?? slug}`;
    }
    return slot;
  };

  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Recomendaciones"
        description="Cómo rinde cada espacio de recomendación de la app y con qué pesos se ordena «Para ti». Se mide solo a compradores con sesión iniciada que no desactivaron la personalización."
      />
      <Tabs value={period} onChange={setPeriod} items={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />

      {q.isPending ? <Loading rows={5} /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (() => {
        const m = q.data;
        const totals = m.slots.reduce(
          (t, s) => ({ impressions: t.impressions + s.impressions, clicks: t.clicks + s.clicks, cart: t.cart + s.added_to_cart, bought: t.bought + s.purchased }),
          { impressions: 0, clicks: 0, cart: 0, bought: 0 },
        );
        const demoShare = m.events ? m.demo_events / m.events : 0;
        const maxCtr = Math.max(...m.slots.map((s) => s.ctr_pct ?? 0), 1);
        return (
          <div className="mb-8 flex flex-col gap-5" data-testid="rec-metrics">
            {!m.events ? null : demoShare >= 0.5 ? (
              <Notice tone="warning" title={`El ${Math.round(demoShare * 100)} % de estas mediciones viene de cuentas de demostración`}>
                Sirven para comprobar que la medición funciona, no para decidir pesos. Espera tráfico real antes de sacar conclusiones.
              </Notice>
            ) : totals.impressions < SMALL_SAMPLE ? (
              <Notice tone="info" title="Muestra pequeña">
                Con menos de {int(SMALL_SAMPLE)} impresiones en el período, las diferencias de CTR entre espacios todavía no son confiables.
              </Notice>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Stat label="Impresiones" value={int(totals.impressions)} hint={`Desde el ${date(m.from)}`} />
              <Stat label="Clics" value={int(totals.clicks)} />
              <Stat label="CTR" value={pct(ratio(totals.clicks, totals.impressions))} tone="brand" hint="Clics por cada 100 impresiones" />
              <Stat label="Agregados al carrito" value={int(totals.cart)} hint="Hasta 7 días después del clic" />
              <Stat label="Comprados" value={int(totals.bought)} hint={totals.clicks ? `${pct(ratio(totals.bought, totals.clicks))} de los clics` : 'Hasta 7 días después del clic'} />
            </div>

            <Card title="Por espacio" padded={false}>
              {!m.slots.length ? (
                <Empty title="Aún no hay mediciones en este período" body="Aparecen cuando compradores con sesión iniciada ven y tocan productos recomendados en la app." />
              ) : (
                <Table head={['Espacio', 'Impresiones', 'Clics', 'CTR', 'Al carrito', 'Comprados', 'Personas']}>
                  {m.slots.map((s) => (
                    <tr key={s.slot} data-testid={`rec-slot-${s.slot}`}>
                      <Td className="font-semibold">{slotName(s.slot)}</Td>
                      <Td className="tabular">{int(s.impressions)}</Td>
                      <Td className="tabular">{int(s.clicks)}</Td>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="tabular w-14 shrink-0">{pct(s.ctr_pct)}</span>
                          <span aria-hidden className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-sunken sm:block">
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round((100 * (s.ctr_pct ?? 0)) / maxCtr)}%` }} />
                          </span>
                        </div>
                      </Td>
                      <Td className="tabular">{int(s.added_to_cart)}</Td>
                      <Td className="tabular">{int(s.purchased)}</Td>
                      <Td className="tabular text-ink-2">{int(s.users)}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            {m.top_clicked.length ? (
              <Card title="Productos más tocados desde recomendaciones">
                <ol className="flex flex-col gap-2.5" data-testid="rec-top">
                  {m.top_clicked.map((p, i) => (
                    <li key={p.id} className="flex items-baseline gap-3 text-[15px]">
                      <span className="tabular w-5 shrink-0 text-right text-[13px] font-bold text-ink-3">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span className="tabular shrink-0 text-ink-2">{p.clicks === 1 ? '1 clic' : `${int(p.clicks)} clics`}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            ) : null}
          </div>
        );
      })()}

      <RankingEditor />
    </>
  );
}

function RankingEditor() {
  const qc = useQueryClient();
  const toast = useToast();
  const saved = useQuery({
    queryKey: ['setting', 'ranking'],
    queryFn: async () => (await run<{ value: Partial<Record<Key, number>> }>(db('app_settings').select('value').eq('key', 'ranking').single())).value,
  });
  const [draft, setDraft] = useState<Record<Key, string> | null>(null);
  const current: Record<Key, string> | null = saved.data
    ? (Object.fromEntries(PARAMS.map((p) => [p.key, show(saved.data[p.key] ?? DEFAULTS[p.key])])) as Record<Key, string>)
    : null;
  const values = draft ?? current;

  // mirrors the database guard, so the button only enables for a value the server will accept
  const errorOf = (p: (typeof PARAMS)[number], raw: string): string | null => {
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(n)) return 'Escribe un número.';
    if (p.cap) return Number.isInteger(n) && n >= 1 && n <= 40 ? null : 'Un entero entre 1 y 40.';
    return n >= 0 && n <= 10 ? null : 'Entre 0 y 10.';
  };
  const errors: Partial<Record<Key, string | null>> = values ? Object.fromEntries(PARAMS.map((p) => [p.key, errorOf(p, values[p.key])])) : {};
  const valid = Object.values(errors).every((e) => !e);
  const dirty = !!values && !!current && PARAMS.some((p) => Number(values[p.key].replace(',', '.')) !== Number(current[p.key].replace(',', '.')));
  const isDefault = !!values && PARAMS.every((p) => Number(values[p.key].replace(',', '.')) === DEFAULTS[p.key]);

  const save = useMutation({
    mutationFn: async () => {
      const value = Object.fromEntries(PARAMS.map((p) => [p.key, Number(values![p.key].replace(',', '.'))]));
      await run(db('app_settings').update({ value }).eq('key', 'ranking'));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['setting', 'ranking'] });
      qc.invalidateQueries({ queryKey: ['rec-metrics'] });
      setDraft(null);
      toast.ok('Pesos guardados. Las próximas recomendaciones ya los usan.');
    },
    onError: toast.error,
  });

  return (
    <Card
      title="Pesos del ranking «Para ti»"
      actions={
        <Button size="sm" variant="ghost" disabled={isDefault} onClick={() => setDraft(Object.fromEntries(PARAMS.map((p) => [p.key, show(DEFAULTS[p.key])])) as Record<Key, string>)}>
          Valores de fábrica
        </Button>
      }
    >
      {saved.isPending ? <Loading rows={3} /> : saved.isError ? <ErrorBox error={saved.error} onRetry={() => saved.refetch()} /> : (
        <form
          className="flex flex-col gap-5"
          data-testid="ranking-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && dirty) save.mutate();
          }}
        >
          <p className="max-w-2xl text-[14px] text-ink-2">
            Cada producto recibe una puntuación: la suma de cada señal por su peso, menos la penalización por ya visto. Un peso 0 apaga esa señal.
            Los límites evitan que una sola tienda o categoría llene la lista.
          </p>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {PARAMS.map((p) => (
              <Field key={p.key} label={p.label} hint={p.hint} error={errors[p.key]}>
                <Input
                  inputMode="decimal"
                  value={values?.[p.key] ?? ''}
                  onChange={(e) => setDraft({ ...(values as Record<Key, string>), [p.key]: e.target.value })}
                  className="tabular"
                  data-testid={`ranking-${p.key}`}
                />
              </Field>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button type="submit" disabled={!dirty || !valid} loading={save.isPending} data-testid="ranking-save">Guardar pesos</Button>
            {dirty ? <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Descartar cambios</Button> : null}
            <p className="text-[13px] text-ink-3">Se aplica de inmediato a todos los compradores y queda en la auditoría.</p>
          </div>
        </form>
      )}
    </Card>
  );
}
