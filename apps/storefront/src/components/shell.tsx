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
import { BrandMark } from './brand-mark';
import { useGuestCartState } from '@/lib/guest-hooks';
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focused = pathname === '/checkout' || pathname.startsWith('/pagar/');
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
    <>
      <a className="skip" href="#contenido">
        Ir al contenido
      </a>
      <header className={`header ${focused ? 'header-focused' : ''}`}>
        <div className="header-inner">
          <Link prefetch={false} href="/" className="wordmark" aria-label={`${brand.name}, inicio`}>
            <BrandMark inverse />
          </Link>
          <form hidden={focused} action="/buscar" role="search" className="searchbox">
            <Search size={21} />
            <Suspense fallback={<input type="search" name="q" aria-label="Buscar productos" placeholder="Buscar productos" />}>
              <HeaderSearchInput />
            </Suspense>
            <button type="submit" aria-label="Buscar">
              <ArrowUpRight size={20} />
            </button>
          </form>
          <nav className="account-nav" aria-label="Tu cuenta">
            <Link prefetch={false} href="/favoritos" aria-label="Favoritos" className="header-favorites">
              <Heart size={21} />
              <span>Favoritos</span>
            </Link>
            <NotificationLink />
            <Link prefetch={false} href="/cuenta" aria-label={session ? 'Mi cuenta' : 'Ingresar'}>
              <UserRound size={21} />
              <span>{session ? 'Mi cuenta' : 'Ingresar'}</span>
            </Link>
            <Link
              prefetch={false}
              href="/carrito"
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
        <Link prefetch={false} className="wordmark" href="/" aria-label={`${brand.name}, inicio`}>
          <BrandMark />
        </Link>
        <p>{brand.tagline}</p>
        <nav className="legal-links" aria-label="Información de Mayami">
          <Link prefetch={false} href="/terminos">
            Términos
          </Link>
          <Link prefetch={false} href="/privacidad">
            Privacidad
          </Link>
          <Link prefetch={false} href="/eliminar-cuenta">
            Eliminar cuenta
          </Link>
          <Link prefetch={false} href="/devoluciones">
            Devoluciones
          </Link>
          <Link prefetch={false} href="/contacto">
            Contacto
          </Link>
        </nav>
        <Link prefetch={false} href="/buscar">
          Explorar el catálogo <ArrowUpRight size={16} />
        </Link>
      </footer>
    </>
  );
}
