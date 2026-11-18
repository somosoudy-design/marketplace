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
const source = fs.readFileSync(root + '/apps/storefront/src/components/product-detail.tsx', 'utf8');
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
  ...['product-selection', 'availability', 'eta', 'catalog-presentation', 'option-swatch', 'commerce-presentation', 'payment-presentation'].map((name) =>
    real('packages/core/src/' + name + '.ts'),
  ),
);
const selection = real('apps/storefront/src/lib/catalog-selection.ts');
let restoredParams = null;
const ports = {
  'next/navigation': { useSearchParams: () => restoredParams, useRouter: () => ({ push() {} }) },
  'react/jsx-runtime': req('react/jsx-runtime'),
  react: React,
  'next/link': { default: ({ children, href }) => React.createElement('a', { href }, children) },
  '@tanstack/react-query': { useQueryClient: () => ({}), useMutation: () => ({ reset() {} }) },
  'lucide-react': { Star: () => null, MessageCircle: () => null, ShoppingBag: () => null, ArrowRight: () => null, Check: () => null, Store: () => null, CircleHelp: () => null, Package: () => null, Undo2: () => null, Minus: () => null, Plus: () => null },
  '@kora/core': core,
  './photo': { ProductPhoto: () => null },
  './color-dot': { ColorDot: () => null },
  './favorite': { Favorite: () => null },
  './product-share': { ProductShare: () => null },
  './product-reviews': { ProductReviews: () => null }, './product-questions': { ProductQuestions: () => null }, './product-questions.css': {},
  './product-card': { ProductGrid: () => null },
  '@/lib/providers': { useAccount: () => ({ session: null, ready: true }) },
  '@/lib/format': { money: (x) => '$' + x },
  '@/lib/photos': { catalogText: (x) => x, catalogSample: () => false, photo: () => null },
  '@/lib/product-link': require('../../apps/storefront/src/lib/product-link.ts'),
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
function render(stock, availability = 'available', color = true, initialVariantId, overrides = {}) {
  return renderToStaticMarkup(
    React.createElement(m.exports.ProductDetail, {
      product: {
        id: 'p',
        title: 'Producto local',
        availability,
        max_per_order: 5,
        store: { name: 'Prueba', slug: 'prueba' },
        related: [],
      },
      metadata: {
        variants: [
          {
            variant_id: 'v',
            active: true,
            title: color ? 'Azul' : '128 GB',
            options: color ? { Color: 'Azul' } : { Capacidad: '128 GB' },
            stock,
            price_usd: 25,
            images: [],
            ...overrides,
          },
        ],
        general_images: [],
      },
      relatedMetadata: {},
      initialVariantId,
    }),
  );
}
for (const color of [true, false])
  test(`stock cero visible y opción explorable, color=${color}`, () => {
    const html = render(0, 'available', color);
    assert.match(html, /variant-stock-label">Agotado/);
    assert.doesNotMatch(html, /Confirma otra cantidad/);
    assert.equal((html.match(/aria-label="(?:Reducir|Aumentar) cantidad de Producto local" disabled=""/g) || []).length, 2);
    const choice = html.match(/<button[^>]*aria-pressed=[\s\S]*?<\/button>/)[0];
    assert.doesNotMatch(choice, /disabled/);
    assert.match(
      choice,
      color ? /aria-label="Color Azul · Agotado"/ : /128 GB<span class="variant-stock-label">Agotado/,
    );
  });
for (const state of ['available', 'on_order', 'reservable', 'in_transit'])
  for (const stock of [2, null])
    test(`${state}, stock=${stock} conserva compra`, () => {
      const html = render(stock, state);
      assert.doesNotMatch(html, /Agotado|Confirma otra cantidad/);
      assert.match(html, /Agregar al carrito/);
      assert.match(html, /aria-label="Aumentar cantidad de Producto local">/);
    });
for (const state of ['sold_out', 'unavailable'])
  test(`${state} no pide cambiar cantidad deshabilitada`, () => {
    const html = render(5, state);
    assert.doesNotMatch(html, /Confirma otra cantidad/);
    assert.equal((html.match(/aria-label="(?:Reducir|Aumentar) cantidad de Producto local" disabled=""/g) || []).length, 2);
  });
for (const state of ['on_order', 'reservable'])
  test(`${state} respeta stock cero`, () => {
    const html = render(0, state);
    assert.match(html, /Agotado/);
    assert.doesNotMatch(html, /Agregar al carrito/);
  });
// Invalid preorder strings are rejected by the actual domain resolver, not rendered as supported availability.
for (const availability of ['preorder', 'pre_sale', 'preventa'])
  test(`${availability} no habilita compra`, () => {
    assert.equal(
      core.resolveProductSelection({
        availability,
        max_per_order: 5,
        images: [],
        variants: [{ id: 'v', active: true, price_usd: 25, stock: 5 }],
      }).canBuy,
      false,
    );
  });


test('restored URL determines purchasability even when cached page props reference a different option', () => {
  try {
    restoredParams = new URLSearchParams('variant=missing');
    assert.match(render(5, 'available', true, 'v'), /Esta opción ya no está disponible/);
    restoredParams = new URLSearchParams('variant=v');
    assert.match(render(5, 'available', true, 'missing'), /Agregar al carrito/);
  } finally {
    restoredParams = null;
  }
});

for (const title of ['Única', ' Unica ', 'ÚNICA']) test(`generic single option is not presented as a choice: ${title}`, () => {
  const html = render(3, 'available', false, undefined, { title, options: {} });
  assert.doesNotMatch(html, /variant-picker|Elige una opción/);
  assert.match(html, /Agregar al carrito/);
  assert.match(html, /Hasta 3 unidades en esta selección/);
});
test('hidden generic option still exposes stock zero and blocks purchase', () => {
  const html = render(0, 'available', false, undefined, { title: 'Única', options: {} });
  assert.doesNotMatch(html, /variant-picker/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>No disponible<\/button>/);
  assert.match(html, /data-testid="product-availability">Agotado/);
  assert.equal((html.match(/aria-label="(?:Reducir|Aumentar) cantidad de Producto local" disabled=""/g) || []).length, 2);
});
test('stale variant URL keeps generic recovery selector', () => {
  const html = render(3, 'available', false, 'removed', { title: 'Única', options: {} });
  assert.match(html, /variant-picker/);
  assert.match(html, /Esta opción ya no está disponible/);
});
for (const override of [
  { title: '128 GB', options: {} },
  { title: 'Única', options: { Capacidad: '128 GB' } },
  { title: 'Única', options: { Condición: 'Reacondicionado' } },
  { title: 'Única', options: {}, color: 'Azul' },
  { title: 'Talla única', options: {} },
]) test(`meaningful option remains visible: ${JSON.stringify(override)}`, () => {
  assert.match(render(3, 'available', false, undefined, override), /variant-picker/);
});
test('multiple or unselected variants are never treated as redundant', () => {
  const generic = { id: 'v', title: 'Única', options: {} };
  assert.equal(selection.isRedundantSingleOption([], undefined), false);
  assert.equal(selection.isRedundantSingleOption([generic, { ...generic, id: 'v2' }], 'v'), false);
  assert.equal(selection.isRedundantSingleOption([generic], undefined), false);
});
