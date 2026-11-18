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
const coreCache = new Map();
function load(relative, ports = {}) {
  const filepath = path.join(root, relative);
  const out = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filepath, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { module: out, exports: out.exports, require: name => {
    if (name in ports) return ports[name];
    if (name.startsWith('.')) {
      const dependency = path.relative(root, path.resolve(path.dirname(filepath), name)) + '.ts';
      if (!coreCache.has(dependency)) coreCache.set(dependency, load(dependency));
      return coreCache.get(dependency);
    }
    return createRequire(filepath)(name);
  }});
  return out.exports;
}
const core = Object.assign({}, ...['money', 'availability', 'product-selection', 'eta', 'catalog-presentation', 'option-swatch', 'commerce-presentation', 'payment-presentation'].map(name => load('packages/core/src/' + name + '.ts')));
const selection = load('apps/storefront/src/lib/catalog-selection.ts');
const Link = ({ children, prefetch, ...props }) => React.createElement('a', props, children);
const icons = new Proxy({}, { get: () => () => null });
const basePorts = { 'react/jsx-runtime': req('react/jsx-runtime'), react: React, '@kora/core': core, 'next/link': { default: Link }, 'lucide-react': icons };
const offers = load('apps/storefront/src/components/offer.tsx', basePorts);
const quantities = load('apps/storefront/src/components/quantity-control.tsx', basePorts);
const detailPorts = {
 ...basePorts,
 'next/navigation': { useSearchParams: () => null, useRouter: () => ({ push() {} }) },
 '@tanstack/react-query': { useQueryClient: () => ({}), useMutation: () => ({ reset() {}, isPending: false }) },
 './photo': { ProductPhoto: () => null }, './color-dot': { ColorDot: () => null }, './favorite': { Favorite: () => null },
 './product-share': { ProductShare: props => React.createElement('span', {'data-shared-variant':props.variantId}) },
 './product-reviews': { ProductReviews: () => null }, './product-questions': { ProductQuestions: () => null }, './product-questions.css': {},
 './quantity-control': quantities, './offer': offers, './product-card': { ProductGrid: () => null },
 '@/lib/providers': { useAccount: () => ({ session: null, ready: true }) },
 '@/lib/format': { money: core.formatOfferPrice }, '@/lib/photos': { catalogText: x => x, catalogSample: () => false, photo: () => null },
  '@/lib/product-link': require('../../apps/storefront/src/lib/product-link.ts'),
 '@/lib/catalog-selection': selection, '@/lib/cart-intents': {}, '@/lib/guest-storage': {}, '@/lib/guest-errors': {},
 '@/lib/guest-hooks': { useGuestCartState: () => ({ ready: true }) },
};
const { ProductDetail } = load('apps/storefront/src/components/product-detail.tsx', detailPorts);
const { ProductCard } = load('apps/storefront/src/components/product-card.tsx', detailPorts);
function productProps({availability = 'on_order', stock = null, active = true, variantId} = {}) {
 return { product: { id:'product', slug:'prueba', title:'Producto real', store_id:'shop', store_name:'Mayami', store:{name:'Mayami',slug:'kora'}, category_slug:'audio', category_name:'Audio', availability, max_per_order:10, lead_min_days:5, lead_max_days:10, related:[], description:'Qué incluye la caja\n• Trípode con pinza\nProducto nuevo. Entrega estimada: 15 a 23 días.' }, metadata: { condition:null,variants:[{variant_id:'variant',sku:'SKU',title:'Única',options:{},active,stock,price_usd:38.6,images:[]}],general_images:[] },relatedMetadata:{},initialVariantId:variantId };
}
const render = element => renderToStaticMarkup(element);
test('seller link exposes commercial name and preserves the existing slug', () => {
 const html=render(React.createElement(offers.SellerLink,{name:'Mayami',slug:'kora'}));
 assert.match(html, /href="\/tienda\/kora"/); assert.match(html, /Mayami/); assert.doesNotMatch(html,/Vendido por kora/);
});
test('published content preserves attribution and escapes seller HTML', () => {
 const html=render(React.createElement(offers.ProductContent,{seller:'Mayami',description:'Qué incluye la caja\n• Trípode con pinza\n<script>bad()</script>\nEntrega estimada: 15 a 23 días.'}));
 assert.match(html,/Información publicada por Mayami/); assert.match(html,/Trípode con pinza/); assert.match(html,/15 a 23 días/); assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/); assert.doesNotMatch(html,/<script>/);
});
test('dispatch component is absent for unavailable or incomplete estimates', () => {
 assert.equal(render(React.createElement(offers.DeliveryStage,{availability:'unavailable',minimum:5,maximum:10})), '');
 assert.equal(render(React.createElement(offers.DeliveryStage,{availability:'on_order',minimum:5})), '');
});
test('detail preserves USD, modality, seller source and technical variant identity', () => {
 const html=render(React.createElement(ProductDetail,productProps()));
 assert.match(html,/\$38,60 USD/); assert.match(html,/Por encargo/); assert.match(html,/Listo para despacho en 5–10 días/); assert.match(html,/Entrega estimada: 15 a 23 días/);
 assert.doesNotMatch(html,/data-shared-variant=/); assert.doesNotMatch(html,/>Única</); assert.doesNotMatch(html,/Condición: Nuevo/);
});
test('unavailable product with positive variant stock keeps purchase disabled', () => {
 const html=render(React.createElement(ProductDetail,productProps({availability:'unavailable',stock:1})));
 assert.match(html,/aria-label="Aumentar cantidad de Producto real" disabled=""/);
 assert.match(html,/class="button"[^>]*disabled=""[^>]*>No disponible<\/button>/);
 assert.doesNotMatch(html,/Listo para despacho/);
});
test('an invalid requested variant cannot display a purchasable status', () => {
 const html=render(React.createElement(ProductDetail,productProps({variantId:'retirada'})));
 assert.match(html,/Esta opción ya no está disponible/);
 assert.match(html,/data-testid="product-availability">No disponible/);
 assert.doesNotMatch(html,/data-testid="product-availability">Por encargo/);
});
test('a catalog card with no active variant cannot advertise availability', () => {
 const html=render(React.createElement(ProductCard,productProps({availability:'available',active:false})));
 assert.match(html,/Precio no disponible/);
 assert.match(html,/data-testid="product-availability">No disponible/);
});
test('the quantity component allows reducing an excess and prevents increases', () => {
 const calls=[];
 const tree=quantities.QuantityControl({quantity:5,maximum:2,label:'Trípode',onChange:n=>calls.push(n)});
 const children=tree.props.children;
 assert.equal(children[0].props.disabled,false); assert.equal(children[2].props.disabled,true);
 children[0].props.onClick(); assert.deepEqual(calls,[4]);
});

test('current unknown condition takes precedence over a saved condition in guest cart', () => {
  const { guestCartView } = load('apps/storefront/src/lib/guest-cart-view.ts', {
    '@kora/core': core, './catalog-selection': selection,
  });
  const props = productProps();
  const product = { ...props.product, catalog_metadata: props.metadata };
  const saved = [{ product_id: product.id, variant_id: 'variant', quantity: 1, title: product.title, price_usd: 38.6, product_condition: 'new' }];
  const view = guestCartView(saved, { products: new Map([[product.id, product]]), metadata: new Map() });
  assert.equal(view.lines[0].product_condition, null);
  assert.equal(view.lines[0].quantity, 1);
});


test('guest quantity limits preserve zero stock without inventing an available unit', () => {
  const { guestCartView } = load('apps/storefront/src/lib/guest-cart-view.ts', {
    '@kora/core': core, './catalog-selection': selection,
  });
  const props = productProps({ stock: 0 });
  const product = { ...props.product, catalog_metadata: props.metadata };
  const saved = [{ product_id: product.id, variant_id: 'variant', quantity: 2, title: product.title, price_usd: 38.6 }];
  const view = guestCartView(saved, { products: new Map([[product.id, product]]), metadata: new Map() });
  assert.equal(view.lines[0].max_quantity, 0);
  assert.equal(view.lines[0].quantity, 2);
  assert.equal(view.lines[0].issue, 'sold_out');
});


test('a technical variant name shows its declared attributes inside the selector', () => {
  const props = productProps();
  props.metadata.variants[0].options = { capacity: '128 GB' };
  const html = render(React.createElement(ProductDetail, props));
  assert.match(html, /128 GB/);
  assert.doesNotMatch(html, />Única</);
});
