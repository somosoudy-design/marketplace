'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heart } from 'lucide-react';
import { browseSection, type BrowseSection } from '@/lib/navigation-context';
import { brand } from '@/lib/format';

export function BrowseLinks({ pathname, section, hidden }: { pathname: string; section: BrowseSection | null; hidden: boolean }) {
  const searching = pathname === '/buscar' || pathname.startsWith('/tienda/');
  const current = (key: BrowseSection) => searching && section === key ? 'page' as const : undefined;
  return <>
    <nav hidden={hidden || !searching} className="mobile-explore-links" aria-label="Descubrir">
      <Link prefetch={false} href="/favoritos" aria-current={pathname === '/favoritos' ? 'page' : undefined}><Heart size={15} aria-hidden="true" /> Favoritos</Link>
      <Link prefetch={false} href="/buscar?sort=newest" aria-current={current('newest')}>Novedades</Link>
      <Link prefetch={false} href="/buscar?availability=on_order" aria-current={current('on_order')}>Por encargo</Link>
    </nav>
    <div hidden={hidden} className="browse-row">
      <nav className="browse-nav wrap" aria-label="Explorar">
        <Link prefetch={false} aria-current={pathname === '/' ? 'page' : undefined} href="/">Inicio</Link>
        <Link prefetch={false} aria-current={current('catalog')} href="/buscar">Todo el catálogo</Link>
        <Link prefetch={false} aria-current={current('newest')} href="/buscar?sort=newest">Novedades</Link>
        <Link prefetch={false} aria-current={current('on_order')} href="/buscar?availability=on_order">Por encargo</Link>
        <span className="nav-note">{brand.tagline}</span>
      </nav>
    </div>
  </>;
}

function CurrentBrowseLinks({ pathname, hidden }: { pathname: string; hidden: boolean }) {
  const params = useSearchParams();
  return <BrowseLinks pathname={pathname} hidden={hidden} section={browseSection(params)} />;
}

export function BrowseNavigation({ pathname, hidden }: { pathname: string; hidden: boolean }) {
  return <Suspense fallback={<BrowseLinks pathname={pathname} hidden={hidden} section={null} />}>
    <CurrentBrowseLinks pathname={pathname} hidden={hidden} />
  </Suspense>;
}
