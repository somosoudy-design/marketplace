'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { HeaderSearchInput } from './header-search-input';
import { BrowseNavigation } from './browse-navigation';
import { usePathname } from 'next/navigation';
import { Search, Heart, ShoppingBag, UserRound, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { brand } from '@/lib/format';
import { captureBuyerApi } from '@/lib/actor-api';
import { useAccount } from '@/lib/providers';
import { NotificationLink } from './notifications';
import { MobileNavigation } from './mobile-navigation';
import { BrandMark } from './brand-mark';
import { useGuestCartState } from '@/lib/guest-hooks';
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focused = pathname === '/checkout' || pathname.startsWith('/pagar/');
  const product = pathname.startsWith('/p/');
  const accessForm = pathname === '/registro' || pathname === '/recuperar';
  const mobileNavigation = !product && !focused && !['/auth','/registro','/recuperar','/eliminar-cuenta'].some(route => pathname === route || pathname.startsWith(route + '/'));
  const { session, ready, cartSyncing } = useAccount();
  const guest = useGuestCartState();
  const cart = useQuery({
    queryKey: ['cart', session?.user.id],
    queryFn: async () => { const bound=await captureBuyerApi(session!.user.id);const summary=await bound.api.cart.summaryReviewed();await bound.assertCurrent();return summary; },
    enabled: !!session && !cartSyncing,
  });
  const cartUnits =
    session ? cart.data?.groups.reduce((n, g) => n + g.lines.reduce((count, line) => count + line.quantity, 0), 0) ?? 0
      : ready ? guest.data.reduce((count, line) => count + line.quantity, 0) : 0;
  return (
    <div className={`app-shell${mobileNavigation ? ' app-shell-mobile' : ''}${product ? ' app-shell-product' : ''}`}>
      <a className="skip" href="#contenido">
        Ir al contenido
      </a>
      <header className={`header${focused ? ' header-focused' : ''}${accessForm ? ' header-access' : ''}`}>
        <div className="header-inner">
          <Link prefetch={false} href="/" className="wordmark" aria-label={`${brand.name}, inicio`}>
            <BrandMark inverse compact={mobileNavigation} />
          </Link>
          <form hidden={focused} action="/buscar" role="search" className="searchbox">
            <Search size={21} aria-hidden="true" />
            <Suspense fallback={<input type="search" name="q" aria-label="Buscar productos" placeholder="Buscar productos" />}><HeaderSearchInput /></Suspense>
            <button type="submit" aria-label="Buscar">
              <ArrowUpRight size={20} aria-hidden="true" />
              <Search className="compact-search-icon" size={20} aria-hidden="true" />
            </button>
          </form>
          <nav className="account-nav" aria-label="Tu cuenta">
            <Link prefetch={false} href="/favoritos" aria-label="Favoritos" className="header-favorites">
              <Heart size={21} />
              <span>Favoritos</span>
            </Link>
            <NotificationLink />
            <Link prefetch={false} href="/cuenta" className="header-account" aria-label={session ? 'Mi cuenta' : 'Ingresar'}>
              <UserRound size={21} />
              <span>{session ? 'Mi cuenta' : 'Ingresar'}</span>
            </Link>
            <Link
              prefetch={false}
              href="/carrito"
              className="header-cart"
              aria-label={`Carrito${(session ? !!cart.data : ready && guest.ready && !guest.error) ? `, ${cartUnits} ${cartUnits === 1 ? 'unidad' : 'unidades'}` : ''}`}
            >
              <ShoppingBag size={21} />
              <span>Carrito</span>
              {!!cartUnits && <b className="count">{cartUnits}</b>}
            </Link>
          </nav>
        </div>
        <BrowseNavigation pathname={pathname} hidden={focused} />
      </header>
      <main id="contenido" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer wrap">
        <div className="footer-brand">
          <Link prefetch={false} className="wordmark" href="/" aria-label={`${brand.name}, inicio`}>
            <BrandMark />
          </Link>
          <p>{brand.tagline}</p>
        </div>
        <div className="footer-links">
          <nav aria-label="Información legal"><h2>Legal</h2>
            <Link prefetch={false} href="/terminos">Términos</Link>
            <Link prefetch={false} href="/privacidad">Privacidad</Link>
          </nav>
          <nav aria-label="Atención al cliente"><h2>Ayuda</h2>
            <Link prefetch={false} href="/devoluciones">Devoluciones</Link>
            <Link prefetch={false} href="/contacto">Contacto</Link>
          </nav>
        </div>
        <Link prefetch={false} className="footer-catalog" href="/buscar">
          Explorar el catálogo <ArrowUpRight size={16} />
        </Link>
      </footer>
      {mobileNavigation && <MobileNavigation pathname={pathname} cartUnits={cartUnits} cartKnown={session ? !!cart.data && !cartSyncing : ready && guest.ready && !guest.error} />}
    </div>
  );
}
