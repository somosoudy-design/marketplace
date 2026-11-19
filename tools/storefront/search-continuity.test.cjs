const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = createRequire(root + '/apps/storefront/package.json');
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
function load(file, ports) {
  const m = { exports: {} };
  const source = fs.readFileSync(root + '/apps/storefront/src/' + file, 'utf8');
  new vm.Script(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText).runInNewContext({ exports: m.exports, URLSearchParams, URL, setTimeout: fn => { pendingRestore = fn; return 1; }, clearTimeout: () => { pendingRestore = null; }, window: typeof browserWindow === 'undefined' ? undefined : browserWindow, require: n => {
    if (n === 'react/jsx-runtime') return req(n);
    if (n in ports) return ports[n];
    throw Error('Unexpected import ' + n);
  }});
  return m.exports;
}
let pathname = '/buscar', query = '';
let restoreEffect, pendingRestore;
const fieldRef = { current: { value: '' } };
const eventListeners = new Map();
const browserWindow = { location: { href: 'http://localhost/buscar?q=audio' }, addEventListener: (name, fn) => eventListeners.set(name, fn), removeEventListener: (name, fn) => { if (eventListeners.get(name) === fn) eventListeners.delete(name); } };
const { HeaderSearchInput } = load('components/header-search-input.tsx', {
  react: { useRef: () => fieldRef, useEffect: fn => { restoreEffect = fn; } },
  'next/navigation': { usePathname: () => pathname, useSearchParams: () => new URLSearchParams(query) },
});
for (const [route, params, expected] of [['/tienda/mayami', 'q=audio', 'audio'], ['/buscar', 'q=aud%C3%ADfonos', 'audífonos'], ['/buscar', 'q=tablet+roja', 'tablet roja'], ['/buscar', '', ''], ['/', 'q=otra', ''], ['/carrito', 'q=otra', '']]) {
  test(`header reflects only catalog query: ${route} ${params}`, () => {
    pathname = route; query = params;
    const element = HeaderSearchInput();
    assert.equal(element.props.defaultValue, expected);
    assert.equal(element.props.name, 'q');
    assert.equal(element.props.type, 'search');
    assert.equal(element.key, `${route}:${expected}`);
  });
}
const Link = ({ children, href, prefetch: _prefetch, ...props }) => React.createElement('a', { href, ...props }, children);
const { Empty } = load('components/states.tsx', {
  'next/navigation': {}, 'next/link': { default: Link },
  'lucide-react': Object.fromEntries(['SearchX', 'RefreshCw', 'Heart', 'ShoppingBag', 'Store'].map(name => [name, () => null])),
});
const searchCalls = [];
let searchRows = [], categoryRows = [];
const actualFilters = load('components/search-filters.tsx', { react: React, 'next/link': { default: Link }, 'lucide-react': { SlidersHorizontal: () => null, X: () => null } });
const actualSort = load('components/search-sort.tsx', { react: React });
const taxonomy = load('lib/catalog-taxonomy.ts', {});
const Search = load('app/buscar/catalog-results.tsx', {
  '@kora/core': require('../../packages/core/src/store-link.ts'),
  './search.css': {}, 'next/link': { default: Link },
  'lucide-react': { ArrowRight: () => null, ChevronDown: () => null, SlidersHorizontal: () => null, X: () => null },
  '@/lib/server': { publicApi: () => ({ catalog: { search: async args => { searchCalls.push(args); return searchRows; }, categories: async () => categoryRows, store: async slug => ({ id: slug, slug, name: slug === 'milyedent' ? 'MilyeDent' : 'Tienda conocida', status: 'active', logo_path: null }) } }), publicCatalogMetadata: async ids => Object.fromEntries(ids.map(id => [id, {}])) },
  '@/components/product-card': { ProductGrid: () => null },
  '@/components/states': { Empty, Failure: () => null },
  '@/components/search-filters': actualFilters,
  '@/components/search-sort': actualSort,
  '@/lib/catalog-taxonomy': taxonomy,
  '@/lib/store-presentation': require('../../apps/storefront/src/lib/store-presentation.ts'),
  '@/components/store-profile': { StoreProfile: ({ store }) => React.createElement('h1', null, store.name) },
}).default;
async function markup(params) { return renderToStaticMarkup(await Search({ query: params })); }
test('empty first page offers catalog reset', async () => {
  const html = await markup({ q: 'nada' });
  assert.match(html, /No encontramos productos/);
  assert.match(html, /Editar búsqueda[\s\S]+type="submit"[\s\S]+Ver todo el catálogo/);
  assert.match(html, /href="\/buscar"[^>]*>Ver todo el catálogo/);
  assert.doesNotMatch(html, /Volver a la página anterior/);
});
test('empty later page returns previous page preserving all filters', async () => {
  const params = { q: 'audio & video', page: '3', category: 'audio', store: 'mayami', collection: 'nueva', sort: 'price_asc', availability: 'on_order', min: '15', max: '150' };
  const html = await markup(params);
  assert.match(html, /No hay más productos en esta página/);
  const href = html.match(/href="([^"]+)"[^>]*>Volver a la página anterior/)[1].replaceAll('&amp;', '&');
  const recovered = Object.fromEntries(new URL(href, 'http://localhost').searchParams);
  assert.deepEqual(recovered, { ...params, page: '2' });
});
test('invalid or negative pages use first-page recovery', async () => {
  for (const page of ['0', '-4', 'bad']) assert.doesNotMatch(await markup({ page }), /Volver a la página anterior/);
});
test('page two recovery never yields page zero', async () => {
  assert.match(await markup({ page: '2' }), /href="\/buscar\?page=1"[^>]*>Volver a la página anterior/);
});

test('history restoration reads destination URL and removes listeners on unmount', () => {
  pathname = '/buscar'; query = 'q=audio'; HeaderSearchInput();
  const cleanup = restoreEffect();
  fieldRef.current.value = 'tablet roja';
  browserWindow.location.href = 'http://localhost/buscar?q=audio&page=2&sort=price_asc';
  eventListeners.get('pageshow')({ persisted: true });
  pendingRestore();
  assert.equal(fieldRef.current.value, 'audio');
  browserWindow.location.href = 'http://localhost/buscar?q=tablet+roja';
  eventListeners.get('popstate')({});
  fieldRef.current.value = 'browser-restored-draft';
  pendingRestore();
  assert.equal(fieldRef.current.value, 'tablet roja');
  browserWindow.location.href = 'http://localhost/carrito';
  eventListeners.get('pageshow')({ persisted: true });
  pendingRestore();
  assert.equal(fieldRef.current.value, '');
  cleanup(); assert.equal(eventListeners.size, 0);
});


test('clearing filters keeps the search, store and collection context', async () => {
  const html = await markup({ q: 'audio & video', store: 'mayami', collection: 'nueva', category: 'audio', availability: 'on_order', min: '15', max: '150', sort: 'price_asc', page: '3' });
  const href = html.match(/href="([^"]+)">Limpiar filtros/)[1].replaceAll('&amp;', '&');
  assert.deepEqual(Object.fromEntries(new URL(href, 'http://localhost').searchParams),
    { q: 'audio & video', store: 'mayami', collection: 'nueva', category: 'audio' });
});

test('removing one active filter preserves the other filters and clears the page', async () => {
  const html = await markup({ q: 'tablet', store: 'mayami', collection: 'nueva', category: 'audio', availability: 'on_order', min: '15', max: '150', sort: 'price_asc', page: '3' });
  const href = html.match(/href="([^"]+)" aria-label="Quitar filtro audio"/)[1].replaceAll('&amp;', '&');
  assert.deepEqual(Object.fromEntries(new URL(href, 'http://localhost').searchParams),
    { q: 'tablet', store: 'mayami', collection: 'nueva', availability: 'on_order', min: '15', max: '150', sort: 'price_asc' });
});

test('an inverted price range cannot query products', async () => {
  searchCalls.length = 0;
  const html = await markup({ min: '150', max: '15' });
  assert.equal(searchCalls.length, 0);
  assert.match(html, /El precio máximo debe ser igual o mayor al mínimo/);
  assert.match(html, /Revisa el rango de precios/);
  assert.doesNotMatch(html, /No encontramos productos/);
});

test('equal and decimal ranges reach the existing API contract', async () => {
  for (const [min, max] of [['25', '25'], ['0', '15.50']]) {
    searchCalls.length = 0;
    await markup({ q: 'tablet', min, max, page: '2', sort: 'price_desc', store: 'mayami', collection: 'nueva' });
    const args = searchCalls[0];
    assert.equal(args.minPrice, Number(min));
    assert.equal(args.maxPrice, Number(max));
    assert.equal(args.offset, 24);
    assert.equal(args.limit, 25);
    assert.equal(args.sort, 'price_desc');
    assert.equal(args.store, 'mayami');
    assert.equal(args.collection, 'nueva');
  }
});

test('omitted and one-sided prices remain valid open ranges', async () => {
  for (const [params, minimum, maximum] of [
    [{}, undefined, undefined],
    [{ min: '150' }, 150, undefined],
    [{ max: '150' }, undefined, 150],
    [{ min: ' ', max: ' ' }, undefined, undefined],
  ]) {
    searchCalls.length = 0;
    const html = await markup(params);
    assert.equal(searchCalls.length, 1);
    assert.equal(searchCalls[0].minPrice, minimum);
    assert.equal(searchCalls[0].maxPrice, maximum);
    assert.doesNotMatch(html, /Revisa el rango de precios|USD –/);
    if (minimum === undefined && maximum === undefined) assert.doesNotMatch(html, /aria-label="Filtros activos"/);
  }
});


test('known store identity and empty store are distinct from unmatched search', async () => {
  const html = await markup({ store: 'milyedent' });
  assert.match(html, /<h1>MilyeDent<\/h1>/);
  assert.match(html, /MilyeDent aún no tiene productos publicados/);
  assert.doesNotMatch(html, /No encontramos productos|Tienda · milyedent|Editar búsqueda|filter-toggle|catalog-sort/);
  const filtered = await markup({ store: 'milyedent', q: 'nada' });
  assert.match(filtered, /No encontramos productos/);
  assert.match(filtered, /name="store" value="milyedent"/);
});
test('newest and on-order routes have contextual headings and breadcrumbs', async () => {
  assert.match(await markup({ sort: 'newest' }), /<h1>Novedades<\/h1>/);
  assert.match(await markup({ availability: 'on_order' }), /<h1>Por encargo<\/h1>/);
  assert.match(await markup({ sort: 'newest', q: 'audio' }), /Resultados para “audio”/);
});
test('lookahead avoids a next-page action for an exact final page', async () => {
  try {
    searchRows = Array.from({ length: 24 }, (_, id) => ({ id: String(id) }));
    let html = await markup({});
    assert.doesNotMatch(html, /Páginas de resultados|Siguiente/);
    searchRows.push({ id: '24' });
    html = await markup({});
    assert.match(html, /24 productos en esta página/);
    assert.match(html, /href="\/buscar\?page=2"/);
    assert.equal(searchCalls.at(-1).limit, 25);
  } finally { searchRows = []; }
});
test('category hierarchy retains children, grandchildren and orphaned records', () => {
  const categories = [
    { id: 'b', parent_id: 'a', name: 'Cargadores', sort: 0 },
    { id: 'a', parent_id: null, name: 'Tecnología', sort: 4 },
    { id: 'c', parent_id: 'b', name: 'USB-C', sort: 0 },
    { id: 'orphan', parent_id: 'missing', name: 'Accesorios', sort: 8 },
    { id: 'cycle1', parent_id: 'cycle2', name: 'Ciclo uno', sort: 9 },
    { id: 'cycle2', parent_id: 'cycle1', name: 'Ciclo dos', sort: 10 },
  ];
  const result = taxonomy.catalogCategories(categories);
  assert.deepEqual(Array.from(result.slice(0, 3), row => [row.category.id, row.depth]), [['a', 0], ['b', 1], ['c', 2]]);
  assert.equal(new Set(result.map(row => row.category.id)).size, categories.length);
});
test('a single modal form retains applied context and offers explicit cancellation', async () => {
  const html = await markup({ q: 'audio', category: 'audio', availability: 'available' });
  assert.match(html, /<dialog[^>]+aria-labelledby="catalog-filter-title"/);
  assert.match(html, /Cerrar filtros sin aplicar/);
  assert.match(html, /Cancelar/);
  assert.equal((html.match(/name="availability"/g) || []).length, 3); // Filter, applied sort and query recovery share the criterion.
  assert.match(html, /Filtros aplicados/);
});

test('departments keep their subcategories together and expand the selected family', async () => {
  categoryRows = [
    { id: 'apple', slug: 'cargadores', name: 'Cargadores', sort: 1, parent_id: 'tech' },
    { id: 'sound', slug: 'audio', name: 'Audio', sort: 2, parent_id: null },
    { id: 'tech', slug: 'tecnologia', name: 'Tecnología', sort: 1, parent_id: null },
  ];
  try {
    const html = await markup({ category: 'cargadores' });
    assert.match(html, /<details open=""><summary aria-label="Subcategorías de Tecnología"/);
    assert.match(html, /name="category" checked="" value="cargadores"/);
    assert.ok(html.indexOf('Subcategorías de Tecnología') < html.indexOf('value="audio"'));
  } finally { categoryRows = []; }
});
