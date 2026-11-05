'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Heart, ShoppingBag, UserRound, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { brand } from '@/lib/format';
import { browser } from '@/lib/browser';
import { useAccount } from '@/lib/providers';
import { NotificationLink } from './notifications';
import { BrandMark } from './brand-mark';
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focused = pathname === '/checkout' || pathname.startsWith('/pagar/');
  const { session } = useAccount();
  const cart = useQuery({
    queryKey: ['cart', session?.user.id],
    queryFn: () => browser().api.cart.summary(),
    enabled: !!session,
  });
  const cartUnits = cart.data?.groups.reduce((n, g) => n + g.lines.reduce((count, line) => count + line.quantity, 0), 0) ?? 0;
  return (
    <>
      <a className="skip" href="#contenido">
        Ir al contenido
      </a>
      <header className={`header ${focused ? 'header-focused' : ''}`}>
        <div className="header-inner">
          <Link href="/" className="wordmark" aria-label={`${brand.name}, inicio`}>
            <BrandMark />
          </Link>
          <form hidden={focused} action="/buscar" role="search" className="searchbox">
            <Search size={21} />
            <input type="search" name="q" aria-label="Buscar productos" placeholder="¿Qué estás buscando?" />
            <button type="submit" aria-label="Buscar">
              <ArrowUpRight size={20} />
            </button>
          </form>
          <nav className="account-nav" aria-label="Tu cuenta">
            <Link href="/favoritos" aria-label="Favoritos" className="header-favorites">
              <Heart size={21} />
              <span>Favoritos</span>
            </Link>
            <NotificationLink />
            <Link href="/cuenta" aria-label={session ? 'Mi cuenta' : 'Ingresar'}>
              <UserRound size={21} />
              <span>{session ? 'Mi cuenta' : 'Ingresar'}</span>
            </Link>
            <Link href="/carrito" aria-label={`Carrito${cart.data ? `, ${cartUnits} ${cartUnits === 1 ? 'unidad' : 'unidades'}` : ''}`}>
              <ShoppingBag size={21} />
              <span>Carrito</span>
              {!!cartUnits && <b className="count">{cartUnits}</b>}
            </Link>
          </nav>
        </div>
        <nav hidden={focused} className="browse-nav wrap" aria-label="Explorar">
          <Link aria-current={pathname === '/' ? 'page' : undefined} href="/">
            Inicio
          </Link>
          <Link aria-current={pathname === '/buscar' ? 'page' : undefined} href="/buscar">
            Todo el catálogo
          </Link>
          <Link href="/buscar?sort=newest">Novedades</Link>
          <Link href="/buscar?availability=on_order">Por encargo</Link>
          <span className="nav-note">{brand.tagline}</span>
        </nav>
      </header>
      <main id="contenido" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer wrap">
        <Link className="wordmark" href="/" aria-label={`${brand.name}, inicio`}>
          <BrandMark />
        </Link>
        <p>{brand.tagline}</p>
        <Link href="/buscar">
          Explorar el catálogo <ArrowUpRight size={16} />
        </Link>
      </footer>
    </>
  );
}
