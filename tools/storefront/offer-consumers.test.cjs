const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const req = createRequire(root + '/apps/storefront/package.json');
const ts = req('typescript'),
  React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const overlay = process.env.MAYAMI_PRESENTATION_SOURCE_ROOT;
function sourcePath(relative) {
  return overlay && fs.existsSync(path.join(overlay, relative))
    ? path.join(overlay, relative)
    : path.join(root, relative);
}
function compile(source, bindings = {}, relative = 'fixture.tsx') {
  const out = { exports: {} };
  const result = ts.transpileModule(source, {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(
    (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length,
    0,
    relative,
  );
  vm.runInNewContext(result.outputText, {
    exports: out.exports,
    module: out,
    URL,
    URLSearchParams,
    require: (name) => {
      if (name in bindings) return bindings[name];
      if (name.startsWith('.'))
        return load(path.relative(root, path.resolve(path.dirname(path.join(root, relative)), name)) + '.ts');
      return createRequire(path.join(root, relative))(name);
    },
  });
  return out.exports;
}
function load(relative, bindings = {}) {
  return compile(fs.readFileSync(sourcePath(relative), 'utf8'), bindings, relative);
}
const core = Object.assign(
  {},
  ...['catalog-presentation', 'availability', 'product-selection', 'commerce-presentation', 'payment-presentation'].map(
    (n) => load('packages/core/src/' + n + '.ts'),
  ),
);
const base = { '@kora/core': core, 'react/jsx-runtime': req('react/jsx-runtime'), react: React };
const selection = load('apps/storefront/src/lib/catalog-selection.ts');
const banner = load('apps/storefront/src/components/product-banner.tsx', {
  ...base,
  'next/link': { default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) },
  'lucide-react': { ArrowRight: () => null },
  './photo': { ProductPhoto: () => null },
  './product-spotlight.css': {},
  '@/lib/catalog-selection': selection,
  '@/lib/format': { money: core.formatOfferPrice },
});
const editorial = load('apps/mobile/src/lib/editorial-selection.ts', base);
function fixture(title, options = {}) {
  const product = {
    id: 'product',
    slug: 'product',
    title: 'Producto real',
    availability: 'available',
    max_per_order: 5,
  };
  const metadata = {
    condition: null,
    variants: [
      {
        variant_id: 'variant',
        title,
        options,
        active: true,
        media_classified: true,
        price_usd: 39,
        stock: 3,
        images: [{ id: 'photo', path: 'product.jpg', sort: 0 }],
      },
    ],
    general_images: [],
  };
  return { product, metadata };
}
const render = (tree) => renderToStaticMarkup(tree);
for (const title of ['Único', 'default', 'Edición única'])
  test('commercial variant name is retained in banner and editorial preview: ' + title, () => {
    const { product, metadata } = fixture(title);
    const chosen = banner.selectBannerProduct([product], { [product.id]: metadata });
    assert.equal(chosen.option, title);
    assert.match(
      render(React.createElement(banner.ProductBanner, { chosen })),
      new RegExp('feed-highlight-option">' + title),
    );
    assert.equal(editorial.reviewedEditorialPreview(product, metadata).variantTitle, title);
  });
for (const title of ['Única', ' UNICA ', '', null])
  test('technical or empty title uses actual options in banner and native editorial: ' + title, () => {
    const { product, metadata } = fixture(title, { Color: 'Negro', Capacidad: '128 GB' });
    const chosen = banner.selectBannerProduct([product], { [product.id]: metadata });
    assert.equal(chosen.option, 'Negro · 128 GB');
    const html = render(React.createElement(banner.ProductBanner, { chosen }));
    assert.match(html, /Negro · 128 GB/);
    assert.match(html, /\$39,00 USD/);
    assert.match(html, /href="\/p\/product\?variant=variant"/);
    const preview = editorial.reviewedEditorialPreview(product, metadata);
    assert.equal(preview.variantTitle, 'Negro · 128 GB');
    assert.equal(preview.variantId, 'variant');
    assert.equal(preview.price, 39);
    assert.equal(preview.imagePath, 'product.jpg');
  });
test('a technical title without attributes stays hidden while selected identity remains intact', () => {
  const { product, metadata } = fixture('Única');
  const chosen = banner.selectBannerProduct([product], { [product.id]: metadata });
  assert.equal(chosen.option, null);
  assert.doesNotMatch(render(React.createElement(banner.ProductBanner, { chosen })), /feed-highlight-option|>Única</);
  const preview = editorial.reviewedEditorialPreview(product, metadata);
  assert.equal(preview.variantTitle, null);
  assert.equal(preview.variantId, 'variant');
});
test('unavailable merchandise is never newly promoted by the title normalization', () => {
  const { product, metadata } = fixture('Única', { Color: 'Negro' });
  product.availability = 'unavailable';
  assert.equal(banner.selectBannerProduct([product], { [product.id]: metadata }), undefined);
  assert.equal(editorial.reviewedEditorialPreview(product, metadata).availability.purchasable, false);
});

// Execute the actual mobile amount declarations, BottomBar JSX and PaymentSchedule.
// Hooks/network/navigation belong to the separate checkout suites; this isolates the displayed server amounts.
const checkoutSource = fs.readFileSync(sourcePath('apps/mobile/src/app/checkout.tsx'), 'utf8');
const ast = ts.createSourceFile('checkout.tsx', checkoutSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const amountNames = new Set(['firstPayment', 'dueToday', 'actionAmount', 'actionAmountLabel']);
const declarations = [];
let bottomBar, paymentSchedule;
function visit(node) {
  if (
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && amountNames.has(d.name.text))
  )
    declarations.push(node.getText(ast));
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'BottomBar') bottomBar = node.getText(ast);
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'PaymentSchedule') paymentSchedule = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert(bottomBar);
assert(paymentSchedule);
assert(declarations.length);
const jsxPorts = {
  ...base,
  ui: {
    BottomBar: 'BottomBar',
    SummaryRow: 'SummaryRow',
    Text: 'Text',
    View: 'View',
    ChangingText: 'ChangingText',
    Button: 'Button',
  },
};
const presentation = compile(
  `
import { formatOfferPrice, presentServerSchedule } from '@kora/core';
import { BottomBar, SummaryRow, Text, View, ChangingText, Button } from 'ui';
export function Amount({s, step}) {
  ${declarations.join('\n')}
  const MAX_W=720, blocking=null, setBarHeight=()=>{}, preparing=false, place={isPending:false}, preview={isFetching:false}, canPlace=true, canContinue=true, nextTitle='Revisar pedido', confirm=()=>{}, advance=()=>{}, palette={coral:{100:'#fff'}};
  return (${bottomBar});
}
${paymentSchedule}
export { PaymentSchedule };
`,
  jsxPorts,
);
function findAll(node, predicate, results = []) {
  if (!node) return results;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, results));
    return results;
  }
  if (predicate(node)) results.push(node);
  findAll(node.props?.children, predicate, results);
  return results;
}
function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  return textContent(node.props?.children);
}
const schedule = (rows) =>
  rows.map(([due, amount], index) => ({
    seq: index + 1,
    kind: index === 0 ? 'down_payment' : 'installment',
    due_in_days: due,
    amount_usd: amount,
  }));
for (const [label, rows, expectedToday] of [
  [
    'one payment today',
    [
      [0, '17.91'],
      [15, '12.09'],
      [30, '10.00'],
    ],
    '$17,91 USD',
  ],
  [
    'multiple payments today',
    [
      [0, '17.91'],
      [0, '12.09'],
      [30, '10.00'],
    ],
    null,
  ],
  [
    'only future payments',
    [
      [15, '17.91'],
      [30, '12.09'],
      [45, '10.00'],
    ],
    null,
  ],
  ['full payment', [[0, '40.00']], null],
])
  test('mobile summary and action keep truthful server amounts: ' + label, () => {
    const s = { total_usd: '40.00', schedule: schedule(rows) };
    const before = JSON.stringify(s);
    const review = presentation.Amount({ s, step: 3 });
    const todayRows = findAll(review, (node) => node.type === 'SummaryRow' && node.props.label === 'Pagas hoy');
    assert.equal(todayRows.length, expectedToday ? 1 : 0);
    if (expectedToday) assert.equal(todayRows[0].props.value, expectedToday);
    assert.equal(findAll(review, (node) => node.props?.testID === 'checkout-total')[0].props.value, '$40,00 USD');
    const action = presentation.Amount({ s, step: 2 });
    const amount = findAll(action, (node) => node.type === 'ChangingText')[0];
    assert.equal(amount.props.value, expectedToday ?? '$40,00 USD');
    const labelNode = findAll(action, (node) => node.type === 'Text' && node.props.variant === 'subtitle')[0];
    assert.equal(textContent(labelNode), expectedToday ? 'Pagas hoy' : 'Total del pedido');
    const shown = presentation.PaymentSchedule({ summary: s });
    if (rows.length > 1)
      for (const row of s.schedule) assert(textContent(shown).includes(core.formatOfferPrice(row.amount_usd)));
    assert.equal(JSON.stringify(s), before);
  });
