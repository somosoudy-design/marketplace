'use client';
import { RISK_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Td, Toggle } from '@/components/ui';
import { db, run } from '@/lib/kora';

type Cat = { id: string; parent_id: string | null; slug: string; name: string; icon: string | null; tone: string | null; sort: number; risk_level: string; requires_review: boolean; active: boolean };
const TONES = ['sand', 'sage', 'blush', 'mist', 'clay', 'lilac', 'night'];

export default function CategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  const q = useQuery({ queryKey: ['admin-categories'], queryFn: () => run<Cat[]>(db('categories').select('*').order('sort')) });
  const patch = useMutation({
    mutationFn: ({ id, ...v }: Partial<Cat> & { id: string }) => run(db('categories').update(v).eq('id', id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories-index'] }); },
    onError: toast.error,
  });
  const parents = (q.data ?? []).filter((c) => !c.parent_id);
  return (
    <>
      <PageHeader eyebrow="Catálogo" title="Categorías" description="Marca como restringida o regulada cualquier categoría que requiera permisos sanitarios o controles especiales: sus productos siempre pasan por revisión antes de publicarse." actions={<Button icon={Plus} onClick={() => setEdit({ active: true, risk_level: 'low', requires_review: false, sort: (q.data?.length ?? 0) + 1, tone: 'sand' })}>Nueva categoría</Button>} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : (
          <Table head={['Categoría', 'Orden', 'Riesgo', 'Revisión obligatoria', 'Visible', '']}>
            {q.data.map((c) => (
              <tr key={c.id}>
                <Td><p className={`font-semibold ${c.parent_id ? 'pl-5' : ''}`}>{c.parent_id ? '↳ ' : ''}{c.name}</p><p className={`text-[12px] text-ink-3 ${c.parent_id ? 'pl-5' : ''}`}>{c.slug} · icono {c.icon ?? '—'} · tono {c.tone ?? '—'}</p></Td>
                <Td className="tabular">{c.sort}</Td>
                <Td><Badge tone={c.risk_level === 'low' ? 'neutral' : 'danger'}>{RISK_LABEL[c.risk_level]}</Badge></Td>
                <Td><Toggle label={`Revisión obligatoria en ${c.name}`} checked={c.requires_review} onChange={(v) => patch.mutate({ id: c.id, requires_review: v })} /></Td>
                <Td><Toggle label={`Mostrar ${c.name}`} checked={c.active} onChange={(v) => patch.mutate({ id: c.id, active: v })} /></Td>
                <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => setEdit(c)}>Editar</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {edit ? <EditDialog cat={edit} parents={parents} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function EditDialog({ cat, parents, onClose }: { cat: Partial<Cat>; parents: Cat[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(cat);
  const save = useMutation({
    mutationFn: () => {
      const slug = (f.slug || f.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const v = { name: f.name?.trim(), slug, parent_id: f.parent_id || null, icon: f.icon || null, tone: f.tone || null, sort: Number(f.sort ?? 0), risk_level: f.risk_level, requires_review: !!f.requires_review, active: !!f.active };
      return run(f.id ? db('categories').update(v).eq('id', f.id) : db('categories').insert(v));
    },
    onSuccess: () => { toast.ok('Categoría guardada'); qc.invalidateQueries({ queryKey: ['admin-categories'] }); qc.invalidateQueries({ queryKey: ['categories-index'] }); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open onClose={onClose} title={f.id ? `Editar ${cat.name}` : 'Nueva categoría'} footer={<Button disabled={!f.name?.trim()} loading={save.isPending} onClick={() => save.mutate()}>Guardar</Button>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre" className="col-span-2"><Input autoFocus value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Slug"><Input value={f.slug ?? ''} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="auto" /></Field>
        <Field label="Dentro de"><Select value={f.parent_id ?? ''} onChange={(e) => setF({ ...f, parent_id: e.target.value || null })}><option value="">Categoría principal</option>{parents.filter((p) => p.id !== f.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Icono" hint="Nombre de icono Lucide, ej. headphones"><Input value={f.icon ?? ''} onChange={(e) => setF({ ...f, icon: e.target.value })} /></Field>
        <Field label="Tono de fondo"><Select value={f.tone ?? 'sand'} onChange={(e) => setF({ ...f, tone: e.target.value })}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Orden"><Input type="number" value={f.sort ?? 0} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <Field label="Nivel de riesgo"><Select value={f.risk_level ?? 'low'} onChange={(e) => setF({ ...f, risk_level: e.target.value })}><option value="low">Normal</option><option value="restricted">Restringida</option><option value="regulated">Regulada</option></Select></Field>
        {f.risk_level && f.risk_level !== 'low' ? <div className="col-span-2"><Notice tone="warning">Los productos de esta categoría se publicarán solo después de una revisión manual, sin importar la tienda.</Notice></div> : null}
      </div>
    </Dialog>
  );
}
