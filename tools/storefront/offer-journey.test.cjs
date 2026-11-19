const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = createRequire(root + '/apps/storefront/package.json'),
  ts = req('typescript'),
  React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
let params,
  pathname,
  session,
  guestReady,
  quantity,
  mutationState,
  mutationCalls,
  pushes,
  replaces,
  effects,
  current,
  view,
  guestWrites,
  liveWrites,
  cartSyncing,
  cartSyncError;
const browserWindow = {
  location: { pathname: '/carrito', search: '', href: 'https://mayami.invalid/p/product' },
  history: { replaceState() {} },
};
function load(relative, bindings = {}, sourceRoot = root, extra = '') {
  const filepath = path.join(sourceRoot, relative),
    out = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(filepath, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  assert.equal(
    (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length,
    0,
    relative + ' syntax',
  );
  vm.runInNewContext(compiled.outputText, {
    exports: out.exports,
    module: out,
    URL,
    URLSearchParams,
    window: browserWindow,
    require: (name) => {
      if (name in bindings) return bindings[name];
      if (name.startsWith('.'))
        return load(path.relative(sourceRoot, path.resolve(path.dirname(filepath), name)) + '.ts', {}, sourceRoot);
      return createRequire(filepath)(name);
    },
  });
  return out.exports;
}
const core = Object.assign(
  {},
  ...['store-link', 'availability', 'product-selection', 'eta', 'catalog-presentation', 'option-swatch', 'commerce-presentation'].map(
    (n) => load('packages/core/src/' + n + '.ts'),
  ),
  load('packages/core/src/payment-presentation.ts', {}, root),
  load('packages/core/src/money.ts', {}, root),
);
const auth = load('apps/storefront/src/lib/auth-return.ts', { '@kora/core': core }, root);
const selection = load('apps/storefront/src/lib/catalog-selection.ts');
const hookReact = {
  ...React,
  useState: (initial) => [typeof initial === 'number' ? quantity : initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useEffect: (fn) => effects.push(fn),
};
const queryClient = { invalidateQueries() {}, isMutating: () => liveWrites };
const nav = {
  useSearchParams: () => params,
  usePathname: () => pathname,
  useRouter: () => ({
    push: (destination) => pushes.push(destination),
    replace: (destination) => replaces.push(destination),
  }),
};
const account = () => ({ session, ready: true, retryCartSync() {}, cartSyncing, cartSyncError });
const Link = ({ children, prefetch, ...props }) => React.createElement('a', props, children);
const icons = new Proxy({}, { get: () => () => null });
const base = {
  '@/lib/store-presentation': require('../../apps/storefront/src/lib/store-presentation.ts'),
  './store-badge': { StoreIdentity: () => null },
  '@/components/store-badge': { StoreIdentity: () => null },

  'react/jsx-runtime': req('react/jsx-runtime'),
  react: hookReact,
  'next/link': { default: Link },
  'next/navigation': nav,
  '@kora/core': core,
  'lucide-react': icons,
  '@tanstack/react-query': {
    useQueryClient: () => queryClient,
    useMutation: () => ({
      ...mutationState,
      reset() {},
      mutate: (input, callbacks) => mutationCalls.push({ input, callbacks }),
    }),
    useQuery: () => current,
    useIsMutating: () => guestWrites,
  },
  '@/lib/providers': { useAccount: account },
  '@/lib/format': { money: core.formatOfferPrice },
  '@/lib/auth-return': auth,
  '@/lib/guest-hooks': {
    useGuestCartState: () => ({
      ready: guestReady,
      error: null,
      data: [{ product_id: 'p', variant_id: 'v', quantity: 2, title: 'Producto' }],
    }),
  },
  '@/lib/guest-errors': { guestError: (e) => e },
  '@/lib/guest-storage': {},
  '@/lib/browser': {},
  '@/lib/actor-api': {},
  '@/lib/guest-cart-view': { guestCartView: () => view },
  '@/components/photo': { ProductPhoto: () => null },
  '@/components/states': {
    Empty: (props) =>
      React.createElement(
        'section',
        null,
        React.createElement('h1', null, props.title),
        React.createElement('a', { href: props.href }, props.action),
      ),
  },
  '@/components/guest-sync': { PendingCartMerge: () => null },
};
base['@/lib/purchase-context'] = load('apps/storefront/src/lib/purchase-context.ts', base);
base['./offer'] = base['@/components/offer'] = load('apps/storefront/src/components/offer.tsx', base);
base['./quantity-control'] = base['@/components/quantity-control'] = load(
  'apps/storefront/src/components/quantity-control.tsx',
  base,
);
const productPorts = {
  ...base,
  './photo': { ProductPhoto: () => null },
  './color-dot': { ColorDot: () => null },
  './favorite': { Favorite: () => null },
  './product-share': { ProductShare: () => null },
  './product-reviews': { ProductReviews: () => null }, './product-questions': { ProductQuestions: () => null }, './product-questions.css': {},
  './product-card': { ProductGrid: () => null },
  '@/lib/photos': { catalogText: (x) => x, catalogSample: () => false, photo: () => null },
  '@/lib/product-link': require('../../apps/storefront/src/lib/product-link.ts'),
  './catalog-price': { CatalogPrice: ({ usd }) => React.createElement('strong', null, usd == null ? 'Precio no disponible' : core.formatOfferPrice(usd)) },
  '@/lib/catalog-selection': selection,
  '@/lib/cart-intents': {},
};
const productModule = load(
  'apps/storefront/src/components/product-detail.tsx',
  productPorts,
  root,
  '\nexport {DetailSession};',
);
const cartModule = load(
  'apps/storefront/src/app/carrito/page.tsx',
  base,
  root,
  '\nexport {BuyerCart,GuestCart,CartContent};',
);
const buyerModule = load(
  'apps/storefront/src/components/buyer.tsx',
  { ...base, './states': base['@/components/states'] },
  root,
  '\nexport {BuyerSession};',
);
const full = {
  code: 'full',
  name: 'Pago completo',
  down_payment_pct: 100,
  installments: 0,
  interval_days: 0,
  min_quantity: 1,
  max_quantity: 5,
};
const three = {
  code: 'three_parts',
  name: 'Plan 3',
  down_payment_pct: 50,
  installments: 2,
  interval_days: 15,
  min_quantity: 1,
  max_quantity: 5,
};
function productProps(overrides = {}) {
  return {
    product: {
      id: 'p',
      slug: 'product',
      title: 'Producto',
      availability: 'available',
      max_per_order: 5,
      lead_min_days: 1,
      lead_max_days: 2,
      store: { name: 'Mayami', slug: 'kora' },
      related: [],
      installment_options: [
        {
          variant_id: 'v',
          basis: 'products_only_excludes_shipping',
          unit_price_usd: 100,
          max_quantity: 5,
          plans: [full, three],
        },
      ],
      ...overrides,
    },
    metadata: {
      condition: null,
      variants: [{ variant_id: 'v', title: 'Única', options: {}, active: true, stock: 5, price_usd: 100, images: [] }],
    },
    relatedMetadata: {},
  };
}
function findAll(node, predicate, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((n) => findAll(n, predicate, out));
    return out;
  }
  if (predicate(node)) out.push(node);
  findAll(node.props?.children, predicate, out);
  return out;
}
const find = (node, predicate) => findAll(node, predicate)[0];
const render = (element) => renderToStaticMarkup(element);
const byTest = (tree, id) => find(tree, (n) => n.props?.['data-testid'] === id);
function primary(tree) {
  return find(tree, (n) => n.type === 'button' && n.props.className === 'button');
}
beforeEach(() => {
  params = new URLSearchParams();
  pathname = '/checkout';
  session = null;
  guestReady = true;
  quantity = 1;
  mutationState = { isPending: false, isSuccess: false, isError: false };
  mutationCalls = [];
  pushes = [];
  replaces = [];
  effects = [];
  guestWrites = 0;
  liveWrites = 0;
  cartSyncing = false;
  cartSyncError = null;
  current = {
    isSuccess: true,
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: 'idle',
    data: {
      line_count: 1,
      groups: [{ key: 'store', store: { name: 'Mayami' }, label: 'Disponible', lines: [] }],
      issues: 0,
      items_usd: 100,
      plans: [full, three],
    },
  };
  view = { lines: [], groups: [], units: 2, issues: 0, items_usd: 100 };
  browserWindow.location.pathname = '/carrito';
  browserWindow.location.search = '';
});
test('detail exposes the exact offered schedule while keeping a single primary cart action', () => {
  const tree = productModule.DetailSession(productProps()),
    html = render(tree);
  const [pricing] = findAll(tree, (node) => node.props?.className === 'detail-pricing');
  assert.ok(byTest(pricing, 'product-installments'));
  assert.equal(byTest(pricing, 'product-buy-three-parts'), undefined);
  assert.match(html, /data-testid="product-installments"/);
  assert.match(html, /3 pagos en total/);
  assert.match(html, /\$50,00 USD/);
  assert.match(html, /\$25,00 USD/);
  assert.match(html, /sin envío/);
  assert.equal(findAll(tree, (n) => n.type === 'button' && n.props.className === 'button').length, 1);
  assert.equal(byTest(tree, 'product-buy-three-parts').props.className, 'button secondary');
  assert.match(html, /role="group" aria-label="Oferta seleccionada"/);
  assert.doesNotMatch(html, />Única</);
});
for (const [label, options] of [
  ['missing', undefined],
  [
    'foreign variant',
    [
      {
        variant_id: 'other',
        basis: 'products_only_excludes_shipping',
        unit_price_usd: 100,
        max_quantity: 5,
        plans: [three],
      },
    ],
  ],
  [
    'unknown basis',
    [{ variant_id: 'v', basis: 'total_with_shipping', unit_price_usd: 100, max_quantity: 5, plans: [three] }],
  ],
  [
    'not offered',
    [
      {
        variant_id: 'v',
        basis: 'products_only_excludes_shipping',
        unit_price_usd: 100,
        max_quantity: 5,
        plans: [full],
      },
    ],
  ],
])
  test('detail does not create an installment offer: ' + label, () => {
    assert.equal(
      byTest(productModule.DetailSession(productProps({ installment_options: options })), 'product-installments'),
      undefined,
    );
  });
test('quantity determines schedule amounts and plan eligibility without changing commercial price', () => {
  quantity = 2;
  const tree = productModule.DetailSession(productProps());
  assert.match(render(tree), /\$100,00 USD/);
  assert.match(render(byTest(tree, 'product-installments')), /\$50,00 USD/);
  quantity = 6;
  assert.equal(byTest(productModule.DetailSession(productProps()), 'product-installments'), undefined);
});
test('normal add has no forced plan navigation and synchronous duplicate clicks coalesce', () => {
  const button = primary(productModule.DetailSession(productProps()));
  button.props.onClick();
  button.props.onClick();
  assert.equal(mutationCalls.length, 1);
  assert.deepEqual({ ...mutationCalls[0].input }, { variantId: 'v', quantity: 1 });
  mutationCalls[0].callbacks.onSuccess();
  assert.deepEqual(pushes, []);
  mutationCalls[0].callbacks.onSettled();
  button.props.onClick();
  assert.equal(mutationCalls.length, 2);
});
test('three-part action navigates only after successful add, preserving the exact preference', () => {
  const button = byTest(productModule.DetailSession(productProps()), 'product-buy-three-parts');
  button.props.onClick();
  assert.deepEqual(pushes, []);
  assert.equal(mutationCalls.length, 1);
  mutationCalls[0].callbacks.onSuccess();
  assert.deepEqual(pushes, ['/carrito?plan=three_parts']);
});
test('three-part action reuses a prior successful exact selection instead of adding duplicate units', () => {
  mutationState = { ...mutationState, isSuccess: true, variables: { variantId: 'v', quantity: 1 } };
  byTest(productModule.DetailSession(productProps()), 'product-buy-three-parts').props.onClick();
  assert.equal(mutationCalls.length, 0);
  assert.deepEqual(pushes, ['/carrito?plan=three_parts']);
});
test('a different quantity does not reuse the previous add success', () => {
  quantity = 2;
  mutationState = { ...mutationState, isSuccess: true, variables: { variantId: 'v', quantity: 1 } };
  byTest(productModule.DetailSession(productProps()), 'product-buy-three-parts').props.onClick();
  assert.equal(mutationCalls.length, 1);
  assert.equal(mutationCalls[0].input.quantity, 2);
  assert.deepEqual(pushes, []);
});
test('restored URL selection continues to control eligibility despite cached props', () => {
  params = new URLSearchParams('variant=missing');
  const props = productProps();
  props.initialVariantId = 'v';
  const tree = productModule.DetailSession(props);
  assert.equal(byTest(tree, 'product-installments'), undefined);
  assert.equal(primary(tree).props.disabled, true);
  assert.match(render(tree), /Esta opción ya no está disponible/);
});
for (const state of ['sold_out', 'unavailable'])
  test('unavailable status suppresses installments and disables primary purchase: ' + state, () => {
    const tree = productModule.DetailSession(productProps({ availability: state }));
    assert.equal(byTest(tree, 'product-installments'), undefined);
    assert.equal(primary(tree).props.disabled, true);
  });
test('guest cart carries plan to authentication and keeps live mutation guard for all activation methods', () => {
  const tree = cartModule.GuestCart({ preference: 'three_parts' }),
    checkout = byTest(tree, 'cart-checkout');
  assert.equal(checkout.props.href, '/cuenta?volver=%2Fcheckout%3Fplan%3Dthree_parts');
  assert(byTest(tree, 'guest-plan-preference'));
  liveWrites = 1;
  for (const handler of ['onClick', 'onAuxClick', 'onContextMenu']) {
    let blocked = false;
    checkout.props[handler]({
      preventDefault() {
        blocked = true;
      },
    });
    assert(blocked);
  }
});
test('guest pending writes remain a native disabled button even with an installment preference', () => {
  guestWrites = 1;
  const tree = cartModule.GuestCart({ preference: 'three_parts' }),
    button = byTest(tree, 'cart-checkout');
  assert.equal(button.type, 'button');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.href, undefined);
  assert(byTest(tree, 'guest-plan-preference'));
});
test('buyer cart keeps the offered plan and selector when proceeding to checkout', () => {
  const tree = cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' }),
    checkout = byTest(tree, 'cart-checkout');
  assert.equal(checkout.props.href, '/checkout?plan=three_parts');
  assert.equal(checkout.props['aria-disabled'], false);
  const selected = find(tree, (n) => n.type === 'input' && n.props.name === 'cart-plan' && n.props.checked);
  assert(selected);
  effects.forEach((effect) => effect());
  assert.deepEqual(replaces, ['/carrito?plan=three_parts']);
});
test('a withdrawn plan displays the server-offer fallback and checkout uses full instead', () => {
  current.data.plans = [full];
  const tree = cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' });
  assert.equal(byTest(tree, 'cart-checkout').props.href, '/checkout?plan=full');
  assert.match(render(tree), /El plan solicitado no está disponible/);
  effects.forEach((effect) => effect());
  assert.deepEqual(replaces, ['/carrito?plan=full']);
});
test('no offered plan blocks checkout and does not persist an invented fallback', () => {
  current.data.plans = [];
  const tree = cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' });
  const checkout = byTest(tree, 'cart-checkout');
  assert.equal(checkout.type, 'button');
  assert.equal(checkout.props.disabled, true);
  assert.equal(checkout.props['aria-disabled'], 'true');
  assert.equal(checkout.props.href, undefined);
  assert.equal(checkout.props.onClick, undefined);
  effects.forEach((effect) => effect());
  assert.deepEqual(replaces, []);
  assert.match(render(tree), /No hay un plan de pago disponible/);
});
for (const source of ['quantity write', 'refresh', 'merge error'])
  test('buyer cart never persists fallback while ' + source, () => {
    current.data.plans = [full];
    if (source === 'quantity write') guestWrites = 1;
    if (source === 'refresh') current.isFetching = true;
    if (source === 'merge error') cartSyncError = new Error('pending');
    cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' });
    effects.forEach((effect) => effect());
    assert.deepEqual(replaces, []);
  });
test('Buyer custom guest title and sanitized checkout plan survive the Suspense boundary', () => {
  params = new URLSearchParams('plan=three_parts&ignored=secret');
  const outer = buyerModule.Buyer({ guestTitle: 'Ingresa para ver tus compras', children: () => null });
  assert.equal(outer.type, React.Suspense);
  const tree = outer.props.children.type(outer.props.children.props);
  assert.equal(tree.props.title, 'Ingresa para ver tus compras');
  assert.equal(tree.props.href, '/cuenta?volver=%2Fcheckout%3Fplan%3Dthree_parts');
});
test('Buyer duplicate preference is discarded rather than choosing a financial plan', () => {
  params = new URLSearchParams('plan=full&plan=three_parts');
  const tree = buyerModule.BuyerSession({ children: () => null });
  assert.equal(tree.props.href, '/cuenta?volver=%2Fcheckout');
});
test('Buyer preserves the signed-in user keyed subtree and calls the existing child', () => {
  session = { user: { id: 'buyer-exact' } };
  const seen = [];
  const tree = buyerModule.BuyerSession({
    children: (id) => {
      seen.push(id);
      return null;
    },
  });
  assert.equal(tree.key, 'buyer-exact');
  assert.deepEqual(seen, ['buyer-exact']);
});

for (const source of ['quantity write', 'refresh', 'merge error'])
  test('buyer pending state uses a disabled button without a destination: ' + source, () => {
    if (source === 'quantity write') guestWrites = 1;
    if (source === 'refresh') current.isFetching = true;
    if (source === 'merge error') cartSyncError = new Error('pending');
    const tree = cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' });
    const checkout = byTest(tree, 'cart-checkout');
    assert.equal(checkout.type, 'button');
    assert.equal(checkout.props.disabled, true);
    assert.equal(checkout.props.href, undefined);
    for (const handler of ['onClick', 'onAuxClick', 'onContextMenu']) assert.equal(checkout.props[handler], undefined);
    assert.deepEqual(pushes, []);
    assert.deepEqual(replaces, []);
  });
for (const handler of ['onClick', 'onAuxClick', 'onContextMenu'])
  test('buyer live quantity mutation blocks ' + handler + ' before rerender until every write settles', () => {
    const checkout = byTest(cartModule.BuyerCart({ buyerId: 'buyer', preference: 'three_parts' }), 'cart-checkout');
    assert.equal(checkout.props.href, '/checkout?plan=three_parts');
    for (const count of [2, 1, 0]) {
      liveWrites = count;
      let blocked = false;
      checkout.props[handler]({ preventDefault() { blocked = true; } });
      assert.equal(blocked, count > 0);
    }
    assert.deepEqual(pushes, []);
    assert.deepEqual(replaces, []);
  });
