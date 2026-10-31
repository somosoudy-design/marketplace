'use client';
import {
  BadgeDollarSign, Boxes, ChartLine, ClipboardList, FileClock, FolderTree, Globe, HandCoins, LayoutDashboard, LifeBuoy, LogOut, Megaphone,
  Package, PackageCheck, Plane, Receipt, Settings, ShieldCheck, Sparkles, Star, Store, Truck, Users, Wallet, X, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cx } from './ui';
import { StorePicker } from './StorePicker';
import { brand } from '@/lib/brand';
import { BrandMark } from './BrandMark';

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
    { href: '/admin/opiniones', label: 'Opiniones', icon: Star },
    { href: '/admin/recomendaciones', label: 'Recomendaciones', icon: Sparkles },
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
    { href: '/vendedor/opiniones', label: 'Opiniones', icon: Star },
    { href: '/vendedor/tienda', label: 'Perfil de la tienda', icon: Store },
    { href: '/vendedor/envios', label: 'Tarifas de envío', icon: Truck },
  ] },
];

// The two areas have separate layouts; a client-side switch remounts Shell.
let focusMenuAfterAreaChange = false;

export function Shell({ area, children }: { area: 'admin' | 'seller'; children: ReactNode }) {
  const path = usePathname();
  const { email, signOut, isAdmin, isSeller } = useAuth();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  const sidebarHadFocus = useRef(false);
  const groups = area === 'admin' ? ADMIN : SELLER;
  const active = (href: string) => (href === '/admin' || href === '/vendedor' ? path === href : path === href || path.startsWith(href + '/'));

  const closeMenu = useCallback((returnFocus = true) => {
    restoreFocus.current = returnFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!focusMenuAfterAreaChange) return;
    focusMenuAfterAreaChange = false;
    if (window.matchMedia('(max-width: 1023px)').matches) menuButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      if (restoreFocus.current) {
        restoreFocus.current = false;
        menuButton.current?.focus();
      }
      return;
    }
    const panel = sidebar.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
          'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) closeButton.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    // CSS may hide the focused link before the breakpoint event fires. Remember the last focus
    // and clear it when the user intentionally points or focuses elsewhere.
    const rememberFocus = (event: FocusEvent) => {
      sidebarHadFocus.current = event.target instanceof Node && !!sidebar.current?.contains(event.target);
    };
    const rememberPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !sidebar.current?.contains(event.target)) sidebarHadFocus.current = false;
    };
    document.addEventListener('focusin', rememberFocus);
    document.addEventListener('pointerdown', rememberPointer);
    return () => {
      document.removeEventListener('focusin', rememberFocus);
      document.removeEventListener('pointerdown', rememberPointer);
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches && open) {
        closeMenu(false);
        const nav = sidebar.current?.querySelector('nav');
        (nav?.querySelector<HTMLElement>('a[aria-current="page"]') ?? nav?.querySelector<HTMLElement>('a[href]'))?.focus();
      } else if (!event.matches && !open && (sidebar.current?.contains(document.activeElement) || sidebarHadFocus.current)) {
        sidebarHadFocus.current = false;
        menuButton.current?.focus();
      }
    };
    desktop.addEventListener('change', onBreakpoint);
    return () => desktop.removeEventListener('change', onBreakpoint);
  }, [open, closeMenu]);

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
                  onClick={() => { if (open) closeMenu(); }}
                  aria-current={active(i.href) ? 'page' : undefined}
                  className={cx('flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] font-semibold transition-colors lg:min-h-0', active(i.href) ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-sunken hover:text-ink')}
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
      <aside ref={sidebar} id="panel-navigation" role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label={open ? 'Menú de navegación' : undefined} className={cx('fixed inset-y-0 left-0 z-40 flex w-[min(272px,calc(100vw_-_44px))] flex-col border-r border-line bg-surface px-3 py-5 transition-transform motion-reduce:transition-none lg:visible lg:sticky lg:top-0 lg:h-dvh lg:w-[264px] lg:translate-x-0', open ? 'translate-x-0' : 'invisible -translate-x-full')}>
        <div className="mb-6 flex items-center justify-between gap-1">
          <Link href="/" onClick={() => { if (open) closeMenu(); }} className="flex min-h-[44px] min-w-0 items-center gap-2.5 px-3">
            <BrandMark size={36} radius={12} />
            <span>
              <span className="block font-display text-lg leading-none font-semibold">{brand.name}</span>
              <span className="text-[12px] font-semibold text-ink-3">{area === 'admin' ? 'Administración' : 'Panel de vendedor'}</span>
            </span>
          </Link>
          <button ref={closeButton} type="button" aria-label="Cerrar menú" onClick={() => closeMenu()} className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] text-ink-2 hover:bg-sunken hover:text-ink lg:hidden">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {area === 'seller' ? <div className="mb-5 px-1 [&_select]:min-h-[44px] lg:[&_select]:min-h-0"><StorePicker /></div> : null}
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="mt-4 border-t border-line px-3 pt-4">
          {isAdmin && isSeller ? (
            <Link href={area === 'admin' ? '/vendedor' : '/admin'} onClick={(event) => {
              if (!open) return;
              if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) focusMenuAfterAreaChange = true;
              closeMenu();
            }} className="mb-2 flex min-h-[44px] items-center text-[13px] font-semibold text-brand lg:min-h-0">
              {area === 'admin' ? 'Ir al panel de vendedor' : 'Ir a administración'}
            </Link>
          ) : null}
          <p className="truncate text-[13px] text-ink-3" title={email ?? ''}>{email}</p>
          <button onClick={() => signOut()} className="mt-2 inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink lg:min-h-0">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {open ? <button type="button" aria-label="Cerrar menú" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-30 bg-[var(--overlay)] lg:hidden" onClick={() => closeMenu()} /> : null}
      <div className="min-w-0" inert={open}>
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <button ref={menuButton} type="button" aria-expanded={open} aria-controls="panel-navigation" onClick={() => setOpen(true)} className="min-h-[44px] min-w-[44px] rounded-[10px] border border-line-strong px-3 py-1.5 text-sm font-semibold">Menú</button>
          <span className="font-display text-lg font-semibold">{brand.name}</span>
        </div>
        <main className="mx-auto w-full max-w-[1240px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
