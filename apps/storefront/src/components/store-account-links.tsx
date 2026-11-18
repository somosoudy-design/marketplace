'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Settings, ShieldCheck, Store as StoreIcon } from 'lucide-react';
import Link from 'next/link';
import { publicStorePath } from '@kora/core';
import { captureBuyerApi } from '@/lib/actor-api';
import { useAccount } from '@/lib/providers';
import { storeDisplayName } from '@/lib/store-presentation';

const panel = 'https://panel.mayami.app';
const editor = (id: string, member: boolean) =>
  panel + (member ? '/vendedor/tienda' : '/admin/tiendas/perfil') + '?id=' + encodeURIComponent(id);

function useStoreAccess() {
  const { session } = useAccount();
  const actor = session?.user.id;
  return useQuery({
    queryKey: ['account-store-access', actor],
    enabled: !!actor,
    staleTime: 0,
    queryFn: async () => {
      if (!actor) throw new Error('Inicia sesión.');
      const captured = await captureBuyerApi(actor);
      const [members, roles] = await Promise.all([captured.api.account.stores(actor), captured.api.account.roles(actor)]);
      await captured.assertCurrent();
      return {
        stores: members.flatMap(member => member.stores ? [member.stores] : [])
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        admin: roles.some(({ role }) => role === 'superadmin' || role === 'admin'),
      };
    },
  });
}

export function ManageStoreLink({ id }: { id: string }) {
  const access = useStoreAccess();
  if (access.isError || !access.data) return null;
  const member = access.data.stores.some(store => store.id === id);
  if (!member && !access.data.admin) return null;
  return <a href={editor(id, member)} className="store-manage"><Settings size={16} aria-hidden="true" />Administrar tienda</a>;
}

export function StoreAccountLinks() {
  const access = useStoreAccess();
  if (access.isPending) return <p role="status">Consultando tus tiendas…</p>;
  if (access.isError) return <p role="status">No pudimos consultar tus tiendas. <button className="text-link" onClick={() => void access.refetch()}>Reintentar</button></p>;
  const { stores, admin } = access.data;
  return <section className="account-stores" aria-labelledby="my-stores-heading">
    <h2 id="my-stores-heading">{stores.length > 1 ? 'Mis tiendas' : 'Mi tienda'}</h2>
    {stores.length === 0 && <p>Tu cuenta aún no tiene una tienda asignada. <Link prefetch={false} href="/contacto">Contactar con MAYAMI</Link></p>}
    {stores.map(store => <div key={store.id} className="account-store-row">
      <StoreIcon size={20} aria-hidden="true" />
      <div><strong>{storeDisplayName(store)}</strong>
        {store.status === 'active' && <Link href={publicStorePath(store)} prefetch={false}>Ver tienda</Link>}
      </div>
      <a href={editor(store.id, true)}>Administrar tienda <ArrowUpRight size={15} aria-hidden="true" /></a>
    </div>)}
    {admin && <a className="account-platform" href={panel + '/admin'}><ShieldCheck size={20} aria-hidden="true" />Administración de MAYAMI <ArrowUpRight size={16} aria-hidden="true" /></a>}
  </section>;
}
