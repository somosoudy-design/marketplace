const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { createRequire } = require('node:module');
const root = require('node:path').resolve(__dirname, '../..'),
  req = createRequire(root + '/apps/storefront/package.json'),
  ts = req('typescript'),
  React = req('react'),
  { renderToStaticMarkup } = req('react-dom/server');
const source = fs.readFileSync(root + '/apps/storefront/src/components/product-card.tsx', 'utf8');
// Compile real pure TS modules; only rendering/network boundaries are replaced below.
function real(relative, bindings = {}) {
  const out = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(root + '/' + relative, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports: out, require: (name) => {
      if (name in bindings) return bindings[name];
      const dependency = require('node:path').resolve(require('node:path').dirname(root + '/' + relative), name) + '.ts';
      if (name.startsWith('.') && fs.existsSync(dependency)) return real(require('node:path').relative(root, dependency));
      return createRequire(root + '/' + relative)(name);
    } },
  );
  return out;
}
const core = Object.assign(
  {},
  ...['store-link', 'product-selection', 'availability', 'eta', 'catalog-presentation', 'option-swatch', 'commerce-presentation'].map((name) =>
    real('packages/core/src/' + name + '.ts'),
  ),
);
const selection = real('apps/storefront/src/lib/catalog-selection.ts');
const ports = {
  'react/jsx-runtime': req('react/jsx-runtime'),
  react: React,
  'next/link': { default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) },
  '@tanstack/react-query': { useQueryClient: () => ({}), useMutation: () => ({ reset() {} }) },
  'lucide-react': { ShoppingBag: () => null, ArrowRight: () => null, Check: () => null, Store: () => null, CircleHelp: () => null, Package: () => null, Undo2: () => null, Minus: () => null, Plus: () => null },
  '@kora/core': core,
  './photo': { ProductPhoto: () => null },
  './color-dot': { ColorDot: () => null },
  './favorite': { Favorite: () => null },
  './product-card': { ProductGrid: () => null },
  '@/lib/providers': { useAccount: () => ({ session: null, ready: true }) },
  '@/lib/format': { money: (x) => '$' + x },
  '@/lib/photos': { catalogText: (x) => x, catalogSample: () => false, photo: () => null },
  '@/lib/store-presentation': require('../../apps/storefront/src/lib/store-presentation.ts'),
  './catalog-price': { CatalogPrice: ({ usd }) => React.createElement('strong', null, usd == null ? 'Precio no disponible' : '$' + usd) },
  './store-badge': { StoreIdentity: () => null },
  '@/lib/catalog-selection': selection,
  '@/lib/cart-intents': {},
  '@/lib/guest-storage': {},
  '@/lib/guest-hooks': { useGuestCartState: () => ({ ready: true }) },
  '@/lib/guest-errors': {},
};
ports['./offer'] = real('apps/storefront/src/components/offer.tsx', ports);
ports['./quantity-control'] = real('apps/storefront/src/components/quantity-control.tsx', ports);
const m = { exports: {} };
new vm.Script(
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText,
).runInNewContext({
  exports: m.exports,
  require: (n) => {
    if (n in ports) return ports[n];
    throw Error(n);
  },
});

function render(availability, stock = 3, active = true) {
 return renderToStaticMarkup(React.createElement(m.exports.ProductCard, {
 product: {id:'p', slug:'prueba', title:'Producto', availability, max_per_order:5},
 metadata: {variants:[{variant_id:'v',active,title:'Única', options:{},stock,price_usd:25,images:[]}],general_images:[]}
 }));
}
for (const [state,label] of Object.entries({available:'Disponible',on_order:'Por encargo',reservable:'Preventa',in_transit:'En camino',sold_out:'Agotado',unavailable:'No disponible'})) {
 test('visible badge '+state,()=>{
 const html=render(state);
 assert.match(html,new RegExp('data-testid="product-availability">'+label));
 assert.equal((html.match(/data-testid="product-availability"/g)||[]).length,1);
 assert.doesNotMatch(html,/entrega inmediata|5.10 días/);
 });
}
for(const state of ['available','on_order','reservable']) test('zero stock precedence '+state,()=>{
 assert.match(render(state,0),/data-testid="product-availability">Agotado/);
});

test('a card with only inactive variants exposes unavailable instead of a buyable modality', () => {
 const html = render('available', 3, false);
 assert.match(html, /data-testid="product-availability">No disponible/);
 assert.match(html, /Precio no disponible/);
});
test('commercial unavailability takes precedence over empty stock', () => {
 assert.match(render('unavailable', 0), /data-testid="product-availability">No disponible/);
});
