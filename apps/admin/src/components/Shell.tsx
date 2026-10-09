'use client';
import {
  BadgeDollarSign, Boxes, ChartLine, ClipboardList, FileClock, FolderTree, Globe, HandCoins, LayoutDashboard, LifeBuoy, LogOut, Megaphone,
  Package, PackageCheck, Plane, Receipt, Settings, ShieldCheck, Store, Truck, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cx } from './ui';
import { StorePicker } from './StorePicker';

type Item = { href: string; label: string; icon: LucideIcon };
const ADMIN: { title: string; items: Item[] }[] = [
  { title: 'Operación', items: [
    { href: '/admin', label: 'Resumen', icon: LayoutDashboard },
    { href: '/admin/pagos', label: 'Verificar pagos', icon: BadgeDollarSign },
    { href: '/admin/pedidos', label: 'Pedidos', icon: Receipt },
    { href: '/admin/envios', label: 'Lotes y envíos', icon: Plane },
    { href: '/admin/reclamos', label: 'Reclamos', icon: LifeBuoy },
    { href: '/admin/cuotas', label: 'Cuotas', icon: FileClock },
  ] },
  { title: 'Catálogo', items: [
    { href: '/admin/productos', label: 'Productos y moderación', icon: Package },
    { href: '/admin/inventario', label: 'Inventario', icon: Boxes },
    { href: '/admin/categorias', label: 'Categorías', icon: FolderTree },
    { href: '/admin/importar', label: 'Importar por URL', icon: Globe },
    { href: '/admin/contenido', label: 'Contenido editorial', icon: Megaphone },
  ] },
  { title: 'Finanzas', items: [
    { href: '/admin/tasas', label: 'Tasas de cambio', icon: ChartLine },
    { href: '/admin/liquidaciones', label: 'Liquidaciones', icon: HandCoins },
  ] },
  { title: 'Plataforma', items: [
    { href: '/admin/tiendas', label: 'Tiendas y vendedores', icon: Store },
    { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { href: '/admin/tarifas', label: 'Transportistas y tarifas', icon: Truck },
    { href: '/admin/configuracion', label: 'Configuración comercial', icon: Settings },
    { href: '/admin/auditoria', label: 'Auditoría', icon: ShieldCheck },
  ] },
];
const SELLER: { title: string; items: Item[] }[] = [
  { title: 'Mi tienda', items: [
    { href: '/vendedor', label: 'Resumen', icon: LayoutDashboard },
    { href: '/vendedor/pedidos', label: 'Pedidos y envíos', icon: PackageCheck },
    { href: '/vendedor/productos', label: 'Productos', icon: Package },
    { href: '/vendedor/ventas', label: 'Ventas y comisiones', icon: ClipboardList },
    { href: '/vendedor/balance', label: 'Balance', icon: Wallet },
    { href: '/vendedor/reclamos', label: 'Reclamos', icon: LifeBuoy },
    { href: '/vendedor/tienda', label: 'Perfil de la tienda', icon: Store },
    { href: '/vendedor/envios', label: 'Tarifas de envío', icon: Truck },
  ] },
];

export function Shell({ area, children }: { area: 'admin' | 'seller'; children: ReactNode }) {
  const path = usePathname();
  const { email, signOut, isAdmin, isSeller } = useAuth();
  const [open, setOpen] = useState(false);
  const groups = area === 'admin' ? ADMIN : SELLER;
  const active = (href: string) => (href === '/admin' || href === '/vendedor' ? path === href : path === href || path.startsWith(href + '/'));

  const nav = (
    <nav className="flex flex-col gap-5" aria-label="Secciones">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">{g.title}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  onClick={() => setOpen(false)}
                  aria-current={active(i.href) ? 'page' : undefined}
                  className={cx('flex items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-semibold transition-colors', active(i.href) ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-sunken hover:text-ink')}
                >
                  <i.icon size={18} strokeWidth={2} />
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-surface px-3 py-5 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-3">
          <span className="grid size-9 place-items-center rounded-[12px] bg-brand font-display text-lg font-semibold text-on-brand">K</span>
          <span>
            <span className="block font-display text-lg leading-none font-semibold">Kora</span>
            <span className="text-[12px] font-semibold text-ink-3">{area === 'admin' ? 'Administración' : 'Panel de vendedor'}</span>
          </span>
        </Link>
        {area === 'seller' ? <div className="mb-5 px-1"><StorePicker /></div> : null}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 border-t border-line px-3 pt-4">
          {isAdmin && isSeller ? (
            <Link href={area === 'admin' ? '/vendedor' : '/admin'} className="mb-2 block text-[13px] font-semibold text-brand">
              {area === 'admin' ? 'Ir al panel de vendedor' : 'Ir a administración'}
            </Link>
          ) : null}
          <p className="truncate text-[13px] text-ink-3" title={email ?? ''}>{email}</p>
          <button onClick={() => signOut()} className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {open ? <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-[var(--overlay)] lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-[10px] border border-line-strong px-3 py-1.5 text-sm font-semibold">Menú</button>
          <span className="font-display text-lg font-semibold">Kora</span>
        </div>
        <main className="mx-auto w-full max-w-[1240px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
