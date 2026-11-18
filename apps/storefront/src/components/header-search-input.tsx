'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Native GET forms can restore edited values from history independently of React. */
export function HeaderSearchInput() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = (pathname === '/buscar' || pathname.startsWith('/tienda/')) ? params.get('q') ?? '' : '';
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const restoreSubmittedQuery = () => {
      if (!input.current) return;
      const url = new URL(window.location.href);
      input.current.value = (url.pathname === '/buscar' || url.pathname.startsWith('/tienda/')) ? url.searchParams.get('q') ?? '' : '';
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const afterHistoryRestoration = () => {
      clearTimeout(timer);
      timer = setTimeout(restoreSubmittedQuery, 0);
    };
    // Browser form restoration can run after popstate, so synchronize on the
    // next task rather than letting that restoration overwrite our value.
    // BFCache restores the old document without remounting; popstate also covers
    // same-document history. Read the destination URL, never a stale closure.
    // Also reconcile when hydration resumes after a document was restored.
    restoreSubmittedQuery();
    window.addEventListener('pageshow', afterHistoryRestoration);
    window.addEventListener('popstate', afterHistoryRestoration);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pageshow', afterHistoryRestoration);
      window.removeEventListener('popstate', afterHistoryRestoration);
    };
  }, [pathname, query]);
  return <input ref={input} key={`${pathname}:${query}`} type="search" name="q" aria-label="Buscar productos" placeholder="Buscar productos" defaultValue={query} />;
}
