'use client';
import { useEffect, useState, type ReactNode } from 'react';
export function SearchSortControl({ value, children, action = '/buscar' }: { value: string; children: ReactNode; action?: string }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const restore = () => setPending(false);
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  return <form action={action} className="search-sort" aria-busy={pending} onSubmit={() => setPending(true)}>
    {children}
    <label htmlFor="catalog-sort"><span id="catalog-sort-label">Ordenar por</span>
      <select id="catalog-sort" aria-labelledby="catalog-sort-label" name="sort" defaultValue={value} onChange={event => event.currentTarget.form?.requestSubmit()}>
        <option value="relevance">Relevancia</option><option value="newest">Más recientes</option>
        <option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option><option value="popular">Más populares</option>
      </select>
    </label>
    <span className="sort-feedback" role="status">{pending ? 'Actualizando…' : ''}</span>
    <noscript><button type="submit" className="button secondary">Ordenar</button></noscript>
  </form>;
}
