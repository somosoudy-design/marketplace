'use client';
import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
export function SearchFilters({ children, active }: { children: ReactNode; active: number }) {
  const [open, setOpen] = useState(false);
  return (
    <aside className="search-sidebar" data-open={open}>
      <button
        className="filter-toggle"
        aria-expanded={open}
        aria-controls="catalog-filters"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={17} />
        <span>Filtrar y ordenar{active > 0 ? ` · ${active} activos` : ''}</span>
        <ChevronDown size={17} />
      </button>
      <div id="catalog-filters">{children}</div>
    </aside>
  );
}
