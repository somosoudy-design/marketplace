import './search.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import type { SearchSort } from '@kora/api';
import { catalogCategoryGroups } from '@/lib/catalog-taxonomy';
import { StoreProfile } from '@/components/store-profile';
import { storeDisplayName } from '@/lib/store-presentation';
import { publicApi, publicCatalogMetadata } from '@/lib/server';
import { ProductGrid } from '@/components/product-card';
import { Failure, Empty } from '@/components/states';
import { SearchFilters } from '@/components/search-filters';
import { SearchSortControl } from '@/components/search-sort';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  return { title: params.q ? 'Resultados de búsqueda' : params.store ? 'Productos de la tienda' : params.category ? 'Explorar categoría' : params.availability === 'on_order' ? 'Por encargo' : params.sort === 'newest' ? 'Novedades' : 'Catálogo' };
}
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
  reservable: 'Preventa',
};
const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');
const price = (value: string) =>
  (value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) ? Number(value) : undefined;
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
  const showStoreAbout = Boolean(store) && single(s.vista) === 'tienda';
  const sort = Object.hasOwn(sorts, single(s.sort)) ? (single(s.sort) as SearchSort) : 'relevance';
  const availability = Object.hasOwn(availabilities, single(s.availability))
    ? (single(s.availability) as keyof typeof availabilities)
    : undefined;
  const minimum = price(single(s.min));
  const maximum = price(single(s.max));
  const invalidRange = minimum != null && maximum != null && minimum > maximum;
  const page = Math.max(1, Math.min(1000, Number.parseInt(single(s.page), 10) || 1));
  let products, categories, storeDetails;
  try {
    const api = publicApi();
    [products, categories, storeDetails] = await Promise.all([
      invalidRange || showStoreAbout ? Promise.resolve([]) : api.catalog.search({
        query: q,
        category: category || null,
        store: store || null,
        collection: collection || null,
        sort,
        availability: availability ? [availability] : null,
        minPrice: minimum,
        maxPrice: maximum,
        limit: 25,
        offset: (page - 1) * 24,
      }),
      showStoreAbout ? Promise.resolve([]) : api.catalog.categories(),
      store ? api.catalog.store(store) : Promise.resolve(null),
    ]);
  } catch {
    return <Failure href="/buscar" message="No pudimos cargar los productos." />;
  }
  if (store && (!storeDetails || storeDetails.status !== 'active')) return <Empty kind="store" title="Esta tienda no está disponible" text="Puedes seguir explorando otras ofertas de MAYAMI." href="/" action="Ir al inicio" />;
  const storeParams = new URLSearchParams(Object.entries(s).flatMap(([key, value]) =>
    key !== 'vista' && typeof value === 'string' ? [[key, value]] : []));
  const catalogHref = `/buscar?${storeParams}`;
  if (showStoreAbout && storeDetails) return (
    <div className="wrap search-page">
      <StoreProfile store={storeDetails} catalogHref={catalogHref} aboutHref={`${catalogHref}&vista=tienda`} showAbout />
    </div>
  );
  const hasMore = products.length > 24;
  products = products.slice(0, 24);
  let metadata;
  try { metadata = await publicCatalogMetadata(products.map(p => p.id)); } catch { return <Failure href="/buscar" message="No pudimos cargar las opciones del catálogo." />; }
  const visibleProducts = products.filter(product => metadata[product.id]);
  const count = visibleProducts.length;
  const selectedCategory = categories.find(c => c.slug === category);
  const sectionTitle = selectedCategory?.name || (collection ? 'Colección' : availability === 'on_order' ? 'Por encargo' : sort === 'newest' ? 'Novedades' : 'Catálogo');
  const storeName = storeDetails && storeDisplayName(storeDetails);
  const title = q ? `Resultados para “${q}”` : storeName ? `Productos de ${storeName}` : sectionTitle;
  const contextTitle = storeName || sectionTitle;
  const ResultsTitle = storeDetails ? 'h2' : 'h1';
  const groups = catalogCategoryGroups(categories);
  const pagination = (n: number) => {
    const params = new URLSearchParams(Object.entries(s).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])));
    params.set('page', String(n));
    return `/buscar?${params}`;
  };
  const filteredUrl = (remove: string[]) => {
    const params = new URLSearchParams(Object.entries(s).flatMap(([key, value]) =>
      typeof value === 'string' && !remove.includes(key) && key !== 'page' ? [[key, value]] : []));
    return params.size ? `/buscar?${params}` : '/buscar';
  };
  const clearUrl = filteredUrl(['availability', 'min', 'max', 'sort']);
  const canClear = !!availability || minimum != null || maximum != null || sort !== 'relevance';
  const storeEmpty = !!storeDetails && !q && !category && !availability && minimum == null && maximum == null && products.length === 0 && page === 1;
  const activeFilters = [
    ...(category ? [{ label: categories.find(c => c.slug === category)?.name || category, remove: ['category'] }] : []),
    ...(availability ? [{ label: availabilities[availability], remove: ['availability'] }] : []),
    ...(minimum != null || maximum != null ? [{
      label: minimum != null && maximum != null ? `USD ${minimum}–${maximum}` : minimum != null ? `Desde USD ${minimum}` : `Hasta USD ${maximum}`,
      remove: ['min', 'max'],
    }] : []),
  ];
  return (
    <div className="wrap search-page" data-catalog-root={!q && !category && !collection && !store && !availability && sort === 'relevance' || undefined}>
      {storeDetails ? <StoreProfile store={storeDetails} catalogHref={catalogHref} aboutHref={`${catalogHref}&vista=tienda`} showAbout={false} /> : <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <Link prefetch={false} href="/">
          Inicio
        </Link>
        <span>/</span>
        <span aria-current="page">{q ? 'Búsqueda' : contextTitle}</span>
      </nav>}
      <div id={storeDetails ? "productos" : undefined} className="search-layout" data-store-empty={storeEmpty || undefined}>
        <header className="search-heading">
          <div>
            <ResultsTitle>{title}</ResultsTitle>
            {!storeDetails && <p className="results-count" role="status">
              {count} {count === 1 ? 'producto' : 'productos'}{hasMore || page > 1 ? ' en esta página' : ''}{page > 1 ? ` · Página ${page}` : ''}
              {q && contextTitle !== 'Catálogo' && <span> · {contextTitle}</span>}
            </p>}
          </div>
        </header>
        {!storeEmpty && <SearchFilters key={`filters-${JSON.stringify(s)}`} active={activeFilters.length} clearHref={canClear ? clearUrl : undefined} applied={[category, availability ?? '', single(s.min), single(s.max)]}>
            {q && <input type="hidden" name="q" value={q} />}
            {store && <input type="hidden" name="store" value={store} />}
            {collection && <input type="hidden" name="collection" value={collection} />}
            <input type="hidden" name="sort" value={sort} />
            <fieldset className="filter-categories">
              <legend>Categoría</legend>
              <div className="filter-category-list">
                <label><input type="radio" name="category" value="" defaultChecked={!category} />Todas las categorías</label>
                {groups.map(({ parent, children }) => (
                  <div className="category-family" key={parent.id}>
                    <label>
                      <input type="radio" name="category" value={parent.slug} defaultChecked={category === parent.slug} />
                      {parent.name}
                    </label>
                    {children.length > 0 && <details open={children.some(item => item.category.slug === category) || undefined}>
                      <summary aria-label={`Subcategorías de ${parent.name}`}><ChevronDown size={17} aria-hidden="true" /></summary>
                      <div className="category-children">
                        {children.map(({ category: child, depth }) => <label key={child.id} style={depth > 1 ? { paddingInlineStart: (Math.min(depth, 3) - 1) * 10 } : undefined}>
                          <input type="radio" name="category" value={child.slug} defaultChecked={category === child.slug} />
                          {child.name}
                        </label>)}
                      </div>
                    </details>}
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="filter-section" htmlFor="catalog-availability">
              <span id="catalog-availability-label">Disponibilidad</span>
              <select id="catalog-availability" aria-labelledby="catalog-availability-label" name="availability" defaultValue={availability ?? ''}>
                <option value="">Todas</option>
                {Object.entries(availabilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <fieldset className="filter-section">
              <legend>Precio en USD</legend>
              <div className="price-inputs">
                <label>
                  Desde
                  <input type="number" name="min" min="0" step="0.01" defaultValue={single(s.min)} placeholder="Mínimo" />
                </label>
                <label>
                  Hasta
                  <input type="number" name="max" min="0" step="0.01" defaultValue={single(s.max)} placeholder="Máximo" />
                </label>
              </div>
              {invalidRange && <p className="error" role="alert">El precio máximo debe ser igual o mayor al mínimo.</p>}
            </fieldset>
        </SearchFilters>}
        {!storeEmpty && <SearchSortControl value={sort} key={`sort-${JSON.stringify(s)}`}>
          {Object.entries({ q, store, collection, category, availability, min: single(s.min), max: single(s.max) })
            .filter(([, value]) => value).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        </SearchSortControl>}
        <section aria-label="Resultados" className="search-results">
          {activeFilters.length > 0 && <nav className="active-filters" aria-label="Filtros activos">
            {activeFilters.map(filter => <Link key={filter.label} prefetch={false} href={filteredUrl(filter.remove)} aria-label={`Quitar filtro ${filter.label}`}>
              {filter.label}<X size={14} aria-hidden="true" />
            </Link>)}
          </nav>}
          {invalidRange ? <p className="notice" role="alert">Revisa el rango de precios para ver los productos.</p> : products.length ? (
            <>
              {count ? <ProductGrid products={visibleProducts} metadata={metadata} /> : (
                <Empty title="No hay productos en esta página" text="Vuelve al catálogo para seguir buscando." />
              )}
              {(page > 1 || hasMore) && <nav className="pagination" aria-label="Páginas de resultados">
                {page > 1 && (
                  <Link prefetch={false} className="button secondary" href={pagination(page - 1)}>
                    Anterior
                  </Link>
                )}
                <span>Página {page}</span>
                {hasMore && (
                  <Link prefetch={false} className="button secondary" href={pagination(page + 1)}>
                    Siguiente <ArrowRight size={17} />
                  </Link>
                )}
              </nav>}
            </>
          ) : (
            <div className="search-empty">
              <Empty kind={storeEmpty ? 'store' : 'search'}
                title={page > 1 ? 'No hay más productos en esta página' : storeEmpty ? `${storeName} aún no tiene productos publicados` : 'No encontramos productos'}
                text={page > 1 ? 'Vuelve a los resultados anteriores sin cambiar tu búsqueda.' : storeEmpty ? 'Puedes volver más adelante o explorar las otras tiendas de MAYAMI.' : canClear ? 'Prueba a quitar disponibilidad o precio conservando tu búsqueda y sección.' : 'Prueba otras palabras o explora otra categoría.'}
                href={page > 1 ? pagination(page - 1) : storeEmpty ? '/' : canClear ? clearUrl : filteredUrl(['q', 'category'])}
                action={page > 1 ? 'Volver a la página anterior' : storeEmpty ? 'Explorar MAYAMI' : canClear ? 'Limpiar filtros' : store ? 'Ver productos de la tienda' : collection ? 'Ver colección' : 'Ver todo el catálogo'}
              >
                {!storeEmpty && page === 1 && <form action="/buscar" className="empty-search">
                  {Object.entries({ store, category, collection, availability, min: single(s.min), max: single(s.max), sort })
                    .filter(([, value]) => value).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
                  <label htmlFor="empty-search-query">Editar búsqueda</label>
                  <div><input id="empty-search-query" type="search" name="q" defaultValue={q} placeholder="Busca otro producto" /><button type="submit" className="button">Buscar</button></div>
                </form>}
              </Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
