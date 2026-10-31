import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import type { Availability, SearchSort } from '@kora/api';
import { publicApi } from '@/lib/server';
import { ProductGrid } from '@/components/product-card';
import { Failure, Empty } from '@/components/states';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buscar productos' };
const sorts = {
  relevance: 'Relevancia',
  newest: 'Más recientes',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
  popular: 'Más populares',
};
const availabilities = {
  available: 'Disponible',
  on_order: 'Por encargo',
  in_transit: 'En camino',
  reservable: 'Reservable',
};
const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');
const price = (value: string) =>
  value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : undefined;
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const s = await searchParams;
  const q = single(s.q);
  const category = single(s.category);
  const store = single(s.store);
  const collection = single(s.collection);
  const sort = single(s.sort) in sorts ? (single(s.sort) as SearchSort) : 'relevance';
  const availability = single(s.availability) in availabilities ? (single(s.availability) as Availability) : undefined;
  const page = Math.max(1, Math.min(1000, Number.parseInt(single(s.page), 10) || 1));
  let products, categories;
  try {
    [products, categories] = await Promise.all([
      publicApi().catalog.search({
        query: q,
        category: category || null,
        store: store || null,
        collection: collection || null,
        sort,
        availability: availability ? [availability] : null,
        minPrice: price(single(s.min)),
        maxPrice: price(single(s.max)),
        limit: 24,
        offset: (page - 1) * 24,
      }),
      publicApi().catalog.categories(),
    ]);
  } catch {
    return <Failure href="/buscar" message="No pudimos cargar los productos." />;
  }
  const title = q
    ? `Resultados para “${q}”`
    : categories.find((c) => c.slug === category)?.name ||
      (collection ? 'Colección' : store ? 'Productos de la tienda' : 'Explora el catálogo');
  const pagination = (n: number) => {
    const params = new URLSearchParams(Object.entries(s).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
    params.set('page', String(n));
    return `/buscar?${params}`;
  };
  return (
    <div className="wrap search-page">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <span>Buscar</span>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ENCUENTRA LO TUYO</span>
          <h1>{title}</h1>
        </div>
        <span className="muted">
          {products.length} productos{page > 1 ? ` · Página ${page}` : ''}
        </span>
      </div>
      <div className="search-layout">
        <aside className="search-sidebar">
          <form action="/buscar" className="filter-form">
            <h2>
              <SlidersHorizontal size={18} /> Filtrar y ordenar
            </h2>
            <label>
              Buscar
              <input type="search" name="q" defaultValue={q} placeholder="Nombre, marca…" />
            </label>
            {store && <input type="hidden" name="store" value={store} />}
            {collection && <input type="hidden" name="collection" value={collection} />}
            <label>
              Categoría
              <select name="category" defaultValue={category}>
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar por
              <select name="sort" defaultValue={sort}>
                {Object.entries(sorts).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Disponibilidad
              <select name="availability" defaultValue={availability ?? ''}>
                <option value="">Cualquier disponibilidad</option>
                {Object.entries(availabilities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Precio en USD</legend>
              <div className="price-inputs">
                <label>
                  <span className="sr-only">Precio mínimo</span>
                  <input
                    type="number"
                    name="min"
                    min="0"
                    step="0.01"
                    defaultValue={single(s.min)}
                    placeholder="Desde"
                  />
                </label>
                <span>—</span>
                <label>
                  <span className="sr-only">Precio máximo</span>
                  <input
                    type="number"
                    name="max"
                    min="0"
                    step="0.01"
                    defaultValue={single(s.max)}
                    placeholder="Hasta"
                  />
                </label>
              </div>
            </fieldset>
            <button className="button" type="submit">
              Aplicar filtros
            </button>
            {(category || q || availability || single(s.min) || single(s.max) || store || collection) && (
              <Link className="text-link" href="/buscar">
                <X size={15} />
                Limpiar filtros
              </Link>
            )}
          </form>
        </aside>
        <section aria-label="Resultados" className="search-results">
          {products.length ? (
            <>
              <ProductGrid products={products} />
              <nav className="pagination" aria-label="Páginas de resultados">
                {page > 1 && (
                  <Link className="button secondary" href={pagination(page - 1)}>
                    Anterior
                  </Link>
                )}
                <span>Página {page}</span>
                {products.length === 24 && (
                  <Link className="button secondary" href={pagination(page + 1)}>
                    Siguiente <ArrowRight size={17} />
                  </Link>
                )}
              </nav>
            </>
          ) : (
            <Empty
              title="No encontramos productos"
              text="Prueba otra búsqueda o elimina algunos filtros."
              href="/buscar"
              action="Ver todo el catálogo"
            />
          )}
        </section>
      </div>
    </div>
  );
}
