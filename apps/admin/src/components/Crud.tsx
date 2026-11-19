'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useToast } from './toast';
import { Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Select, Table, Td, Textarea, Toggle, cx } from './ui';
import { db, run } from '@/lib/kora';

/**
 * Small table + dialog editor for configuration tables (carriers, zones, rates, payment methods…).
 * Writes go straight to the table: RLS decides who may change what.
 */
export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'int' | 'decimal' | 'select' | 'checks' | 'toggle' | 'json';
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  /** empty input is stored as null */
  nullable?: boolean;
  wide?: boolean;
  /** only shown when creating */
  createOnly?: boolean;
};
export type ColDef<T> = { label: string; render: (row: T) => ReactNode; className?: string };
type Row = Record<string, unknown>;
type Form = Record<string, string | string[] | boolean>;

const DECIMAL = /^\d{1,8}([.,]\d{1,2})?$/;

function toForm(fields: FieldDef[], row: Record<string, unknown>): Form {
  const f: Form = {};
  for (const d of fields) {
    const v = row[d.key];
    if (d.type === 'checks') f[d.key] = Array.isArray(v) ? v.map(String) : [];
    else if (d.type === 'toggle') f[d.key] = v === true;
    else if (d.type === 'json') f[d.key] = v == null ? '' : JSON.stringify(v, null, 2);
    else f[d.key] = v == null ? '' : String(v);
  }
  return f;
}

function fromForm(fields: FieldDef[], f: Form, creating: boolean): { values: Record<string, unknown>; error: string | null } {
  const values: Record<string, unknown> = {};
  for (const d of fields) {
    if (d.createOnly && !creating) continue;
    const raw = f[d.key];
    if (d.type === 'checks') {
      const arr = raw as string[];
      if (d.required && !arr.length) return { values, error: `Elige al menos una opción en «${d.label}».` };
      values[d.key] = arr;
      continue;
    }
    if (d.type === 'toggle') { values[d.key] = raw === true; continue; }
    const s = String(raw ?? '').trim();
    if (!s) {
      if (d.required) return { values, error: `Completa «${d.label}».` };
      values[d.key] = d.nullable || d.type !== 'text' ? null : '';
      continue;
    }
    if (d.type === 'int') {
      if (!/^\d{1,6}$/.test(s)) return { values, error: `«${d.label}» debe ser un número entero.` };
      values[d.key] = Number(s);
    } else if (d.type === 'decimal') {
      if (!DECIMAL.test(s)) return { values, error: `«${d.label}» debe ser un monto con hasta 2 decimales.` };
      values[d.key] = s.replace(',', '.');
    } else if (d.type === 'json') {
      try { values[d.key] = JSON.parse(s); } catch { return { values, error: `«${d.label}» no es un JSON válido.` }; }
    } else values[d.key] = s;
  }
  return { values, error: null };
}

export function CrudTable<T extends Row>({
  title, table, idKey = 'id', select, order = 'id', filter, columns, fields, defaults, toggleKey, validate, createLabel = 'Agregar', emptyTitle = 'Sin registros', footer, canCreate = true, editTitle, sortRows, fixed, scope,
}: {
  title?: ReactNode;
  table: string;
  /** primary key column (payment_methods use "code", app_settings "key") */
  idKey?: string;
  editTitle?: (row: T) => string;
  /** client-side ordering when the natural order needs joined names */
  sortRows?: (a: T, b: T) => number;
  /** values written on every insert and update (e.g. the seller's store id) */
  fixed?: Record<string, unknown>;
  /** cache key part for filtered lists (e.g. the store id) */
  scope?: string;
  select: string;
  order?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- receives db(table), whose table name is dynamic
  filter?: (q: any) => any;
  columns: ColDef<T>[];
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  toggleKey?: string;
  validate?: (values: Record<string, unknown>) => string | null;
  createLabel?: string;
  emptyTitle?: string;
  footer?: ReactNode;
  canCreate?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<{ row: T | null; form: Form } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const key = ['crud', table, select, order, scope ?? ''];
  const list = useQuery({
    queryKey: key,
    queryFn: () => {
      let q = db(table).select(select);
      if (filter) q = filter(q);
      return run<T[]>(q.order(order));
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const creating = !editing!.row;
      const { values, error } = fromForm(fields, editing!.form, creating);
      const err = error ?? validate?.(values) ?? null;
      if (err) { setFormError(err); throw null; }
      if (creating) await run(db(table).insert({ ...defaults, ...values, ...fixed }));
      else await run(db(table).update({ ...values, ...fixed }).eq(idKey, editing!.row![idKey]));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crud', table] }); setEditing(null); toast.ok('Guardado.'); },
    onError: (e) => { if (e) toast.error(e); },
  });
  const toggle = useMutation({
    mutationFn: (row: T) => run(db(table).update({ [toggleKey!]: !row[toggleKey!], ...fixed }).eq(idKey, row[idKey])),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crud', table] }),
    onError: toast.error,
  });
  const open = (row: T | null) => { setFormError(null); setEditing({ row, form: toForm(fields, row ?? defaults) }); };
  const setField = (k: string, v: string | string[] | boolean) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));
  const shownFields = fields.filter((f) => !f.createOnly || !editing?.row);

  return (
    <>
      <Card title={title} padded={false} actions={canCreate ? <Button size="sm" icon={Plus} onClick={() => open(null)}>{createLabel}</Button> : undefined}>
        {list.isPending ? <Loading /> : list.isError ? <ErrorBox error={list.error} onRetry={() => list.refetch()} /> : !list.data.length ? (
          <Empty title={emptyTitle} />
        ) : (
          <Table head={[...columns.map((c) => c.label), ...(toggleKey ? ['Activo'] : []), '']}>
            {(sortRows ? [...list.data].sort(sortRows) : list.data).map((row) => (
              <tr key={String(row[idKey])} className={cx(toggleKey && !row[toggleKey] && 'opacity-60')}>
                {columns.map((c, i) => <Td key={i} className={c.className}>{c.render(row)}</Td>)}
                {toggleKey ? <Td><Toggle checked={row[toggleKey] === true} label="Activo" onChange={() => toggle.mutate(row)} /></Td> : null}
                <Td className="text-right"><Button size="sm" variant="ghost" icon={Pencil} aria-label="Editar" onClick={() => open(row)} /></Td>
              </tr>
            ))}
          </Table>
        )}
        {footer ? <div className="border-t border-line px-5 py-3 text-[13px] text-ink-3">{footer}</div> : null}
      </Card>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.row ? (editTitle?.(editing.row) ?? 'Editar') : createLabel}
        wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button loading={save.isPending} onClick={() => { setFormError(null); save.mutate(); }}>Guardar</Button></>}
      >
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {shownFields.map((d) => {
              const v = editing.form[d.key];
              const span = d.wide || d.type === 'textarea' || d.type === 'checks' || d.type === 'json' ? 'sm:col-span-2' : undefined;
              if (d.type === 'toggle') return <div key={d.key} className={cx('flex items-center justify-between gap-3 rounded-[14px] border border-line px-3.5 py-2.5', span)}><span className="text-sm font-semibold text-ink-2">{d.label}</span><Toggle checked={v === true} label={d.label} onChange={(x) => setField(d.key, x)} /></div>;
              if (d.type === 'checks') {
                const arr = v as string[];
                return (
                  <fieldset key={d.key} className={span}>
                    <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">{d.label}</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {d.options!.map((o) => (
                        <label key={o.value} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" className="accent-[var(--color-brand)]" checked={arr.includes(o.value)} onChange={(e) => setField(d.key, e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
                          {o.label}
                        </label>
                      ))}
                    </div>
                    {d.hint ? <p className="mt-1 text-[12.5px] text-ink-3">{d.hint}</p> : null}
                  </fieldset>
                );
              }
              return (
                <Field key={d.key} label={d.label} hint={d.hint} className={span}>
                  {d.type === 'select' ? (
                    <Select value={String(v)} onChange={(e) => setField(d.key, e.target.value)}>
                      {!d.required ? <option value="">—</option> : null}
                      {d.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : d.type === 'textarea' || d.type === 'json' ? (
                    <Textarea rows={d.type === 'json' ? 8 : 3} className={d.type === 'json' ? 'font-mono text-[13px]' : undefined} value={String(v)} onChange={(e) => setField(d.key, e.target.value)} />
                  ) : (
                    <Input value={String(v)} inputMode={d.type === 'int' ? 'numeric' : d.type === 'decimal' ? 'decimal' : undefined} className={d.type === 'int' || d.type === 'decimal' ? 'tabular' : undefined} onChange={(e) => setField(d.key, e.target.value)} />
                  )}
                </Field>
              );
            })}
            {formError ? <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{formError}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
