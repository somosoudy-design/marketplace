// Characterization only: actual TSX component bodies, controlled React/query/UI/API ports.
// No renderer, browser, SDK/network, persistence, hosted DB, device or UGC compliance claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.env.MAYAMI_SOURCE_ROOT || process.cwd());
const localRequire = createRequire(path.join(root, 'package.json'));
const ts = localRequire('typescript');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), '39ffbee1e9bfbaaaba771da35bfa1479bf6044ce', 'Run only against the isolated reviewed base');
const hashes = {}, cases = [];
let networkAttempts = 0;
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };

function load(relative, ports) {
  const input = fs.readFileSync(path.join(root, relative), 'utf8');
  hashes[relative] = crypto.createHash('sha256').update(input).digest('hex');
  const compiled = ts.transpileModule(input, { fileName: relative, reportDiagnostics: true, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } });
  assert.deepEqual((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
  const module = { exports: {} };
  const sandbox = vm.createContext({ module, exports: module.exports,
    require(name) { assert.ok(Object.hasOwn(ports, name), `Unlisted component import: ${name}`); return ports[name]; },
    fetch() { networkAttempts++; throw new Error('Network forbidden'); },
  });
  new vm.Script(compiled.outputText, { filename: relative }).runInContext(sandbox, { timeout: 2000 });
  return module.exports;
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  const nested = value.props ? Object.values(value.props).flatMap(v => typeof v === 'object' ? nodes(v) : []) : [];
  return value.props ? [value, ...nested] : nested;
}
function texts(value) {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(texts);
  return value.props ? texts(value.props.children) : [];
}
const byId = (tree, id) => nodes(tree).find(node => node.props.testID === id);
const theme = { colors: { surfaceSunken: '#eee', success: '#080' }, radii: { md: 10 } };
const shared = {
  'react/jsx-runtime': jsx, 'react-native': { View: 'View' },
  '@/components/ui/Text': { Text: 'Text' }, '@/components/ui/Icon': { Icon: 'Icon' },
  '@/components/ui/Pressable': { ScalePressable: 'ScalePressable' },
  '@/theme': { useTheme: () => theme },
};

function makeSheet({ fail = false } = {}) {
  const states = []; let stateIndex = 0, options, pending;
  const calls = [], invalidations = [], haptic = { success: 0, warning: 0 };
  let closed = 0, shouldFail = fail;
  const mutation = { isPending: false, error: null, mutate() {
    mutation.isPending = true; mutation.error = null;
    // Query is a controlled port: explicitly drive callbacks and hook state, not a React Query test.
    pending = Promise.resolve().then(() => options.mutationFn()).then(result => {
      mutation.isPending = false; options.onSuccess(result); return result;
    }, error => { mutation.isPending = false; mutation.error = error; options.onError(error); return undefined; });
  } };
  const react = { useState(initial) {
    const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  } };
  const component = load('apps/mobile/src/components/reviews/ReviewSheet.tsx', {
    ...shared, react,
    '@tanstack/react-query': { useMutation(value) { options = value; return mutation; }, useQueryClient: () => ({ invalidateQueries: value => invalidations.push(value) }) },
    '@/components/catalog/ProductImage': { ProductImage: 'ProductImage' },
    '@/components/ui/Button': { Button: 'Button' }, '@/components/ui/Sheet': { Sheet: 'Sheet' },
    '@/components/ui/States': { Banner: 'Banner' }, '@/components/ui/TextField': { TextField: 'TextField' },
    '@/lib/haptics': { haptics: { success() { haptic.success++; }, warning() { haptic.warning++; } } },
    '@/lib/query': { qk: { myReviews: id => ['my-reviews', id], reviews: id => ['reviews', id], reviewable: id => ['my-reviews', 'product', id], product: id => ['product', id] } },
    '@/lib/supabase': { api: { reviews: { async submit(...args) { calls.push(args); if (shouldFail) throw new Error('Sin conexión (puerto controlado)'); return { id: 'review-fixture' }; } } } },
    './Reviews': { StarInput: 'StarInput' },
  }).ReviewSheet;
  const props = { item: { id: 'item-fixture', product_id: 'product-fixture', title: 'Producto fixture', image_path: null },
    existing: { id: 'review-fixture', rating: 4, body: '  Comentario fixture  ' }, orderId: 'order-fixture', onClose() { closed++; } };
  return { calls, invalidations, haptic, mutation,
    render() { stateIndex = 0; return component(props); },
    async press(tree) { byId(tree, 'review-submit').props.onPress(); assert.ok(pending); await pending; },
    allowSuccess() { shouldFail = false; }, closed: () => closed,
  };
}

(async () => {
  const reviewItem = load('apps/mobile/src/components/reviews/Reviews.tsx', {
    ...shared,
    '@/lib/catalog-exhibition': { isPrivateCatalogPresentation: true },
    '@/lib/haptics': { haptics: { select() {} } },
    '@/lib/format': { formatRating: String, shortDate: value => value },
  }).ReviewItem;
  const tree = reviewItem({ review: { id: 'review-fixture', rating: 4, body: 'Reseña fixture', author: 'Autor F.', created_at: '2026-11-09', reply_body: 'Respuesta fixture' }, storeName: 'Tienda fixture' });
  assert.ok(byId(tree, 'review-review-fixture'));
  assert.ok(byId(tree, 'review-reply-review-fixture'));
  assert.ok(texts(tree).includes('Reseña fixture') && texts(tree).includes('Respuesta fixture'));
  assert.equal(nodes(tree).filter(node => typeof node.props.onPress === 'function').length, 0);
  cases.push({ name: 'Real ReviewItem emits review and reply without interactive reporting/blocking controls', result: 'CHARACTERIZED GAP' });

  const success = makeSheet(); const edit = success.render();
  assert.equal(byId(edit, 'review-submit').props.disabled, false);
  assert.equal(nodes(edit).filter(node => node.props.accessibilityRole === 'checkbox').length, 0);
  assert.equal(nodes(edit).filter(node => node.type === 'LegalLinks').length, 0);
  await success.press(edit);
  assert.deepEqual(success.calls, [['item-fixture', 4, 'Comentario fixture']]);
  assert.equal(success.closed(), 1); assert.equal(success.haptic.success, 1);
  cases.push({ name: 'Real ReviewSheet edit invokes submit with three existing arguments and no UGC acceptance', result: 'CHARACTERIZED GAP' });

  const failure = makeSheet({ fail: true }); await failure.press(failure.render());
  const failed = failure.render();
  assert.equal(failure.closed(), 0); assert.equal(failure.haptic.success, 0); assert.equal(failure.haptic.warning, 1);
  assert.equal(failure.invalidations.length, 0);
  assert.ok(nodes(failed).some(node => node.type === 'Banner' && node.props.body === 'Sin conexión (puerto controlado)'));
  assert.equal(byId(failed, 'review-body').props.value, '  Comentario fixture  ');
  assert.equal(byId(failed, 'review-submit').props.disabled, false);
  failure.allowSuccess(); await failure.press(failed);
  assert.deepEqual(failure.calls, [['item-fixture', 4, 'Comentario fixture'], ['item-fixture', 4, 'Comentario fixture']]);
  assert.equal(failure.closed(), 1); assert.equal(failure.haptic.success, 1);
  cases.push({ name: 'Controlled rejection renders actual error banner, preserves draft, does not close or invalidate, and explicit retry can finish', result: 'CHARACTERIZED EXISTING RECOVERY' });
  assert.equal(networkAttempts, 0);
  const report = { observedAt: new Date().toISOString(), source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), hashes,
    cases, networkAttempts, scope: 'Actual ReviewItem/ReviewSheet TSX bodies in VM; controlled React state, query callbacks, UI descriptors, formatting/theme and API. No DOM/native rendering or SDK/network. Characterization of missing controls, not a fix or compliance certification.' };
  fs.writeFileSync(path.join(__dirname, 'MOBILE_CHARACTERIZATION.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
