'use client';
import { STORE_STATUS_LABEL } from '@kora/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Table, Td, Textarea, Thumb } from '@/components/ui';
import { date, storeTone } from '@/lib/format';
import { useProfiles } from '@/lib/hooks';
import { db, rpc, run, storeImage } from '@/lib/kora';

type Store = { id: string; slug: string; name: string; tagline: string | null; kind: string; status: string; logo_path: string | null; contact_email: string | null; is_demo: boolean; created_at: string; store_members: { user_id: string; role: string }[]; products: { count: number }[] };
type Rule = { id: string; store_id: string | null; category_id: string | null; rate_pct: string; active: boolean; note: string | null };

export default function StoresPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [team, setTeam] = useState<Store | null>(null);
  const q = useQuery({ queryKey: ['admin-stores'], queryFn: () => run<Store[]>(db('stores').select('*, store_members(user_id, role), products(count)').order('created_at', { ascending: false })) });
  const rules = useQuery({ queryKey: ['commission-rules'], queryFn: () => run<Rule[]>(db('commission_rules').select('*').eq('active', true)) });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => run(db('stores').update({ status }).eq('id', id)),
    onSuccess: () => { toast.ok('Estado de la tienda actualizado'); qc.invalidateQueries(); },
    onError: toast.error,
  });
  const commission = (id: string) => rules.data?.find((r) => r.store_id === id && !r.category_id)?.rate_pct;
  const defaultRate = rules.data?.find((r) => !r.store_id && !r.category_id)?.rate_pct;
  return (
    <>
      <PageHeader eyebrow="Plataforma" title="Tiendas y vendedores" description="Una tienda nueva queda pendiente: sus productos esperan moderación hasta que la actives. Suspenderla oculta su catálogo sin borrar pedidos ni saldos." actions={<Button icon={Plus} onClick={() => setCreating(true)}>Nueva tienda</Button>} />
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data.length ? <Empty title="No hay tiendas" /> : (
          <Table head={['Tienda', 'Tipo', 'Productos', 'Equipo', 'Comisión', 'Alta', 'Estado', '']}>
            {q.data.map((s) => (
              <tr key={s.id}>
                <Td><div className="flex items-center gap-3"><Thumb src={storeImage(s.logo_path)} alt={s.name} size={32} /><div><p className="font-semibold">{s.name}{s.is_demo ? <Badge tone="editorial" className="ml-2">Demo</Badge> : null}</p><p className="text-[12px] text-ink-3">{s.slug}</p></div></div></Td>
                <Td>{s.kind === 'platform' ? 'Propia' : 'Vendedor'}</Td>
                <Td className="tabular">{s.products?.[0]?.count ?? 0}</Td>
                <Td><button className="font-semibold text-brand" onClick={() => setTeam(s)}>{s.store_members.length} {s.store_members.length === 1 ? 'persona' : 'personas'}</button></Td>
                <Td className="tabular">{s.kind === 'platform' ? '—' : `${commission(s.id) ?? defaultRate ?? '—'}%`}{s.kind !== 'platform' && !commission(s.id) ? <span className="text-[12px] text-ink-3"> (general)</span> : null}</Td>
                <Td className="whitespace-nowrap text-ink-3">{date(s.created_at)}</Td>
                <Td><Badge tone={storeTone[s.status]}>{STORE_STATUS_LABEL[s.status]}</Badge></Td>
                <Td className="text-right">
                  <Select aria-label={`Estado de ${s.name}`} value={s.status} onChange={(e) => setStatus.mutate({ id: s.id, status: e.target.value })} className="h-8 w-auto text-[13px]">
                    <option value="pending">Pendiente</option><option value="active">Activa</option><option value="suspended">Suspendida</option>
                  </Select>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <CreateStore open={creating} onClose={() => setCreating(false)} />
      <TeamDialog store={team} onClose={() => setTeam(null)} />
    </>
  );
}

function CreateStore({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: '', slug: '', tagline: '', email: '', kind: 'seller', owner: '' });
  const m = useMutation({
    mutationFn: async () => {
      const slug = (f.slug || f.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const [s] = await run<{ id: string }[]>(db('stores').insert({ name: f.name.trim(), slug, tagline: f.tagline.trim() || null, contact_email: f.email.trim() || null, kind: f.kind, status: 'pending' }).select('id'));
      if (f.owner.trim()) await rpc('add_store_member', { p_store_id: s!.id, p_email: f.owner.trim(), p_role: 'owner' });
    },
    onSuccess: () => { toast.ok('Tienda creada en estado pendiente'); qc.invalidateQueries(); setF({ name: '', slug: '', tagline: '', email: '', kind: 'seller', owner: '' }); onClose(); },
    onError: toast.error,
  });
  return (
    <Dialog open={open} onClose={onClose} title="Nueva tienda" footer={<Button disabled={!f.name.trim()} loading={m.isPending} onClick={() => m.mutate()}>Crear</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Nombre"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Dirección web (slug)" hint="Se genera del nombre si lo dejas vacío"><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
        <Field label="Lema"><Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="seller">Vendedor externo</option><option value="platform">Propia de la plataforma</option></Select></Field>
          <Field label="Correo de contacto"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Field label="Correo del dueño (opcional)" hint="Debe tener una cuenta creada en la app"><Input type="email" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

function TeamDialog({ store, onClose }: { store: Store | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const name = useProfiles(store?.store_members.map((m) => m.user_id) ?? []);
  const add = useMutation({
    mutationFn: () => rpc('add_store_member', { p_store_id: store!.id, p_email: email.trim(), p_role: role }),
    onSuccess: () => { toast.ok('Persona agregada. Verá la tienda al volver a iniciar sesión.'); setEmail(''); qc.invalidateQueries({ queryKey: ['admin-stores'] }); onClose(); },
    onError: toast.error,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => run(db('store_members').delete().eq('store_id', store!.id).eq('user_id', userId)),
    onSuccess: () => { toast.ok('Acceso retirado'); qc.invalidateQueries({ queryKey: ['admin-stores'] }); onClose(); },
    onError: toast.error,
  });
  if (!store) return null;
  return (
    <Dialog open onClose={onClose} title={`Equipo de ${store.name}`}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-line rounded-[14px] border border-line">
          {store.store_members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span><b>{name(m.user_id)}</b> · {m.role === 'owner' ? 'Dueño' : 'Equipo'}</span>
              <Button size="sm" variant="ghost" loading={remove.isPending && remove.variables === m.user_id} onClick={() => remove.mutate(m.user_id)}>Quitar</Button>
            </li>
          ))}
          {!store.store_members.length ? <li className="px-4 py-3 text-sm text-ink-3">Sin personas asignadas.</li> : null}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Agregar por correo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@example.com" /></Field>
          <Field label="Rol"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="staff">Equipo</option><option value="owner">Dueño</option></Select></Field>
        </div>
        <Notice tone="info">La persona debe haber creado su cuenta en la app. El acceso se refleja en su próxima sesión.</Notice>
        <div className="flex justify-end"><Button disabled={!email.includes('@')} loading={add.isPending} onClick={() => add.mutate()}>Agregar</Button></div>
      </div>
    </Dialog>
  );
}
