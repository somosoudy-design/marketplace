'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/toast';
import { Badge, Button, Card, Dialog, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Table, Tabs, Td, Textarea } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { closureLabel, closureMessage, closureResult, type ClosureResult } from '@/lib/account-closure';
import { ago, dateTime } from '@/lib/format';
import { db, koraForActor, rpc, run } from '@/lib/kora';

type U = { id: string; email: string; full_name: string | null; phone: string | null; created_at: string; last_sign_in_at: string | null; blocked: boolean; roles: string[]; stores: { id: string; name: string; role: string }[]; deletion_status: string | null };
type Req = { id: string; user_id: string; reason: string | null; status: string; cleanup_state?: string | null; requested_at: string; processed_at: string | null; notes: string | null };

export default function UsersPage() {
  const [tab, setTab] = useState<'users' | 'deletions'>('users');
  return (
    <>
      <PageHeader eyebrow="Plataforma" title="Usuarios" description="Busca cuentas, gestiona permisos de administración y atiende solicitudes de eliminación de datos." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'users', label: 'Cuentas' }, { value: 'deletions', label: 'Solicitudes de eliminación' }]} />
      {tab === 'users' ? <Users /> : <Deletions />}
    </>
  );
}

function Users() {
  const { isSuperadmin, userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const q = useQuery({ queryKey: ['admin-users', query], queryFn: () => rpc<U[]>('admin_users', { p_query: query || null, p_limit: 100 }) });
  const role = useMutation({
    mutationFn: ({ id, grant }: { id: string; grant: boolean }) => rpc('set_user_role', { p_user_id: id, p_role: 'admin', p_grant: grant }),
    onSuccess: (_, v) => { toast.ok(v.grant ? 'Ahora es administrador. Lo verá en su próxima sesión.' : 'Permiso retirado'); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: toast.error,
  });
  return (
    <>
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <Input aria-label="Buscar usuarios" placeholder="Correo, nombre o ID" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
      </div>
      {!isSuperadmin ? <div className="mb-4"><Notice tone="info">Solo la superadministración puede otorgar o retirar permisos.</Notice></div> : null}
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data.length ? <Empty title="Sin resultados" /> : (
          <Table head={['Cuenta', 'Permisos', 'Tiendas', 'Alta', 'Último acceso', '']}>
            {q.data.map((u) => (
              <tr key={u.id}>
                <Td><p className="font-semibold">{u.full_name ?? 'Sin nombre'}{u.blocked ? <Badge tone="danger" className="ml-2">Bloqueada</Badge> : null}</p><p className="text-[12px] text-ink-3">{u.email}</p></Td>
                <Td>{u.roles.length ? u.roles.map((r) => <Badge key={r} tone={r === 'superadmin' ? 'editorial' : 'brand'} className="mr-1">{r === 'superadmin' ? 'Superadmin' : 'Admin'}</Badge>) : <span className="text-ink-3">Cliente</span>}</Td>
                <Td className="text-ink-2">{u.stores.map((s) => s.name).join(', ') || '—'}</Td>
                <Td className="whitespace-nowrap text-ink-3">{dateTime(u.created_at)}</Td>
                <Td className="whitespace-nowrap text-ink-3">{ago(u.last_sign_in_at)}</Td>
                <Td className="text-right">
                  {isSuperadmin && u.id !== userId && !u.roles.includes('superadmin') ? (
                    <Button size="sm" variant={u.roles.includes('admin') ? 'ghost' : 'secondary'} loading={role.isPending && role.variables?.id === u.id} onClick={() => role.mutate({ id: u.id, grant: !u.roles.includes('admin') })}>
                      {u.roles.includes('admin') ? 'Quitar admin' : 'Hacer admin'}
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function Deletions() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<{ req: Req; approve: boolean; actorId: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<ClosureResult | null>(null);
  const q = useQuery({ queryKey: ['deletion-requests', userId], queryFn: () => run<Req[]>(db('account_deletion_requests').select('*').order('requested_at', { ascending: false }).limit(200)), enabled: !!userId });
  const capability = useQuery({ queryKey: ['account-closure-capability', userId], queryFn: () => rpc<boolean>('account_closure_capabilities'), enabled: !!userId, retry: false });
  const users = useQuery({ queryKey: ['admin-users', 'deletions', q.data?.length], queryFn: () => rpc<U[]>('admin_users', { p_query: null, p_limit: 200 }), enabled: !!q.data?.length });
  const email = (id: string) => users.data?.find((u) => u.id === id)?.email ?? id.slice(0, 8);
  const process = useMutation({
    mutationFn: async (v: { req: Req; approve: boolean; actorId: string; notes: string }): Promise<ClosureResult | null> => {
      const bound = await koraForActor(v.actorId);
      await bound.assertCurrent();
      if (!v.approve) {
        await run(bound.client.rpc('process_account_deletion', { p_request_id: v.req.id, p_approve: false, p_notes: v.notes.trim() }));
        await bound.assertCurrent();
        return null;
      }
      if (capability.data !== true) throw new Error('El cierre verificable todavía no está disponible. La solicitud permanece pendiente.');
      const { data, error } = await bound.client.functions.invoke('account-close', { body: { requestId: v.req.id, notes: v.notes.trim() || null } });
      await bound.assertCurrent();
      if (error) throw new Error('No se pudo procesar el cierre. Revisa los permisos y las operaciones pendientes; actualiza la solicitud antes de reintentar.');
      return closureResult(data, v.req.id);
    },
    onSuccess: (result) => {
      if (!result) toast.ok('Solicitud rechazada');
      else if (result.state === 'completed') toast.ok(closureMessage(result.state));
      else setOutcome(result);
      qc.invalidateQueries(); setOpen(null); setNotes('');
    },
    onError: toast.error,
  });
  return (
    <>
      {capability.isError || capability.data === false ? <div className="mb-4"><Notice tone="info">El cierre verificable todavía no está disponible. Puedes revisar las solicitudes; la eliminación permanece deshabilitada.</Notice></div> : null}
      {outcome ? <div className="mb-4"><Notice tone="info">{closureMessage(outcome.state)}</Notice></div> : null}
      <Card padded={false}>
        {q.isPending ? <Loading /> : q.isError ? <ErrorBox error={q.error} /> : !q.data?.length ? <Empty title="No hay solicitudes" /> : (
          <Table head={['Cuenta', 'Motivo', 'Solicitada', 'Estado', '']}>
            {q.data.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold">{email(r.user_id)}</Td>
                <Td className="text-ink-2">{r.reason ?? '—'}</Td>
                <Td className="whitespace-nowrap text-ink-3">{dateTime(r.requested_at)}</Td>
                <Td><Badge tone={r.status === 'completed' && r.cleanup_state === 'completed' ? 'success' : r.status === 'rejected' ? 'neutral' : 'warning'}>{closureLabel(r.status, r.cleanup_state)}</Badge></Td>
                <Td className="whitespace-nowrap text-right">
                  {['requested', 'in_review'].includes(r.status) && userId ? (<>{!r.cleanup_state ? <Button size="sm" variant="ghost" onClick={() => setOpen({ req: r, approve: false, actorId: userId })}>Rechazar</Button> : null}<Button size="sm" variant="danger" disabled={capability.data !== true} onClick={() => setOpen({ req: r, approve: true, actorId: userId })}>{r.cleanup_state ? 'Reintentar cierre' : 'Procesar cierre'}</Button></>) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {open ? (
        <Dialog open onClose={() => { if (!process.isPending) setOpen(null); }} title={open.approve ? 'Procesar cierre de cuenta' : 'Rechazar solicitud'} footer={<Button variant={open.approve ? 'danger' : 'primary'} disabled={!open.approve && !notes.trim()} loading={process.isPending} onClick={() => process.mutate({ ...open, notes })}>{open.approve ? 'Procesar cierre' : 'Rechazar'}</Button>}>
          <div className="flex flex-col gap-4">
            {open.approve ? <Notice tone="danger" title="No se puede deshacer">Tras aprobar, se bloquea el acceso y se procesan las credenciales, los datos de uso y los archivos personales. Los registros pendientes de clasificación se conservan. El cierre sólo figura como verificado cuando todas las comprobaciones terminan; un fallo o una retención mantienen la solicitud abierta.</Notice> : null}
            <Field label={open.approve ? 'Nota interna (opcional)' : 'Motivo (lo verá el usuario)'}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
