// Actual TSX + controlled React/query/API ports. No DOM, browser, auth SDK or DB claim.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const repo = path.resolve(__dirname, '../..');
const editorPath = 'apps/admin/src/app/(panel)/vendedor/productos/editar/ProductEditor.tsx';
const adminPath = 'apps/admin/src/app/(panel)/admin/productos/editar/AdminProductEditor.tsx';
const plain = value => JSON.parse(JSON.stringify(value));
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' };
const nodes = x => !x || typeof x !== 'object' ? [] : Array.isArray(x) ? x.flatMap(nodes) : x.props ? [x, ...Object.values(x.props).filter(v => typeof v === 'object').flatMap(nodes)] : [];
const store = { id: 'store-target', name: "Aroma'top", kind: 'seller', status: 'active' };
const fixture = () => ({ revision: 'revision-reviewed', product: { id: 'product-yara', title: 'Yara', category_id: 'category', availability: 'available', weight_kg: 0.5, max_per_order: 10, moderation_status: 'published', moderation_events: [], product_variants: [{ id: 'variant', title: 'Única', price_usd: 30, stock: 5, active: true, sort: 7 }], product_images: [{ id: 'photo', path: 'store-target/product-yara/original.webp', sort: 4 }] }, pricing: { costs: null, variants: [{ variant_id: 'variant', cost_usd: null }] } });
function harness() {
  const h = { actor: 'admin', isAdmin: true, memberStore: store, id: 'product-yara', storeId: store.id, review: fixture(), calls: [], queries: [], effects: [], mutations: [], state: [], refs: [], current: true };
  let si = 0, ri = 0, mi = 0;
  const api = { seller: {
    productReviewed: async (...args) => { h.calls.push(['read', ...args]); return h.review; },
    saveProductReviewed: async (...args) => { h.calls.push(['save', ...plain(args)]); if (h.fail) throw new Error('revision_conflict'); if (h.wait) await h.wait; },
    uploadImage: async (...args) => { h.calls.push(['upload', args[1]]); if (h.uploadWait) await h.uploadWait; },
  }};
  const ports = {
    'react/jsx-runtime': jsx,
    react: { useState(initial) { const i = si++; if (!(i in h.state)) h.state[i] = typeof initial === 'function' ? initial() : initial; return [h.state[i], value => h.state[i] = typeof value === 'function' ? value(h.state[i]) : value]; }, useRef(initial) { const i = ri++; return h.refs[i] ??= { current: initial }; }, useMemo: fn => fn(), useEffect(fn) { if (!h.mounted) h.effects.push(fn()); } },
    '@tanstack/react-query': { useQuery(options) { h.queries.push(options); return { data: options.queryKey[0] === 'admin-editor-store' ? store : h.review, isPending: false, isError: false }; }, useQueryClient: () => ({ setQueryData() {}, invalidateQueries() {} }), useMutation(options) { h.mutations[mi++] = options; return { isPending: false, mutate() {}, reset() {} }; } },
    '@/lib/auth': { useAuth: () => ({ userId: h.actor, isAdmin: h.isAdmin }) },
    '@/lib/store': { useStore: () => ({ store: h.memberStore }) },
    '@/lib/hooks': { useQueryId: () => h.id, useCategoriesIndex: () => ({ list: [] }) },
    '@/lib/kora': { catalogImage: x => x, run: async x => x, koraForActor: async actor => { if (actor !== h.actor) throw new Error('actor changed'); return { api, client: { from() { throw new Error('No raw write permitted in reviewed editor test'); } }, assertCurrent: async () => { if (!h.current || actor !== h.actor) throw new Error('actor changed'); } }; } },
    '@/components/toast': { useToast: () => ({ ok() {}, error() {} }) },
    '@/components/ui': new Proxy({}, { get: (_, name) => name === 'cx' ? () => '' : name }),
    '@/lib/format': { dateTime: x => x, moderationTone: {} },
    '@/lib/pricing': {},
    '@kora/core': { AVAILABILITY: new Proxy({}, { get: () => ({ label: 'Disponible' }) }), MODERATION_LABEL: {} },
    'lucide-react': {}, 'next/link': { default: 'Link' },
    'next/navigation': { useSearchParams: () => new Map([['id', h.id], ['store', h.storeId]]) },
    '@/components/CatalogMetadataEditor': { CatalogMetadataEditor: 'CatalogMetadataEditor' },
  };
  function load(file) {
    const source = ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const exports = {};
    vm.runInNewContext(source, { exports, require: name => { if (!(name in ports)) throw new Error(`Unexpected module: ${name}`); return ports[name]; }, crypto: require('node:crypto').webcrypto, URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL() {} } });
    return exports;
  }
  ports['@/components/ProductCosts'] = load('apps/admin/src/components/ProductCosts.tsx');
  h.module = load(editorPath);
  ports['../../../vendedor/productos/editar/ProductEditor'] = h.module;
  h.admin = load(adminPath).default;
  h.outer = (admin = true) => h.module.ReviewedProductEditor({ store, admin });
  h.render = element => { si = ri = mi = 0; const tree = element.type(element.props); h.mounted = true; return tree; };
  h.open = (admin = true) => { h.element = h.outer(admin); return h.render(h.element); };
  h.rerender = () => h.render(h.element);
  h.close = () => h.effects.forEach(fn => fn?.());
  h.save = () => h.mutations[1].mutationFn();
  h.addImage = (tree, arrayBuffer = async () => new ArrayBuffer(1)) => nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ type: 'image/webp', size: 1, arrayBuffer }], value: '' } });
  return h;
}
test('admin context is explicit; guest/nonadmin/missing identifiers cannot start a query or creation', async () => {
  const h = harness(); h.admin(); assert.equal(h.queries.at(-1).enabled, true);
  assert.deepEqual(plain(h.queries.at(-1).queryKey), ['admin-editor-store', 'admin', store.id]);
  for (const context of [{ actor: null }, { actor: 'seller', isAdmin: false }, { actor: 'admin', isAdmin: true, id: null }]) {
    Object.assign(h, context); assert.equal(h.admin().type, 'Notice'); assert.equal(h.queries.at(-1).enabled, false);
    assert.equal(h.outer().type, 'Notice'); assert.equal(h.queries.at(-1).enabled, false);
  }
});
test('seller wrapper still uses membership store, not admin URL store', () => {
  const h = harness(); h.actor = 'seller'; h.isAdmin = false; h.memberStore = { ...store, id: 'own-store' };
  const wrapper = h.module.default(); assert.equal(wrapper.props.store.id, 'own-store'); assert.equal(wrapper.props.admin, undefined);
  wrapper.type(wrapper.props); assert.deepEqual(plain(h.queries.at(-1).queryKey), ['seller-product-reviewed', 'seller', 'own-store', h.id]);
});
test('image-only admin save leaves sparse variant sorts, money, costs and moderation untouched', async () => {
  const h = harness(); const tree = h.open(); h.addImage(tree); h.rerender(); await h.save();
  const [, sid, pid, revision, key, changes] = h.calls.find(x => x[0] === 'save');
  assert.equal(sid, store.id); assert.equal(pid, h.id); assert.equal(revision, h.review.revision); assert.ok(key);
  assert.deepEqual(changes.fields, {}); assert.deepEqual(changes.variants, []); assert.equal(changes.costs, undefined); assert.equal(changes.variantCosts, undefined);
  assert.equal(changes.images.length, 2); assert.deepEqual(changes.images[0], { id: 'photo', sort: 0 }); assert.match(changes.images[1].path, /^store-target\/product-yara\/.+\.webp$/);
  assert.equal(changes.images[1].sort, 1); assert.equal(h.calls.filter(x => x[0] === 'upload').length, 1);
});
test('CAS error retry preserves reviewed revision, idempotency key and uploaded image', async () => {
  const h = harness(); h.addImage(h.open()); h.rerender(); h.fail = true; await assert.rejects(h.save(), /revision_conflict/); h.fail = false; await h.save();
  const calls = h.calls.filter(x => x[0] === 'save'); assert.deepEqual(calls[0], calls[1]); assert.equal(h.calls.filter(x => x[0] === 'upload').length, 1);
});
test('double invocation cannot issue two writes', async () => {
  const h = harness(); h.open(); let finish; h.wait = new Promise(resolve => finish = resolve);
  const first = h.save(); await assert.rejects(h.save(), /Ya se está guardando/); finish(); await first;
  assert.equal(h.calls.filter(x => x[0] === 'save').length, 1);
});
test('actor change or editor close during file read prevents upload and write', async () => {
  for (const interrupt of [h => h.actor = 'other', h => h.close()]) {
    const h = harness(); let finish; const bytes = new Promise(resolve => finish = resolve);
    h.addImage(h.open(), () => bytes); h.rerender(); const saving = h.save(); await new Promise(resolve => setImmediate(resolve)); interrupt(h); finish(new ArrayBuffer(1));
    await assert.rejects(saving); assert.equal(h.calls.filter(x => ['save', 'upload'].includes(x[0])).length, 0);
  }
});
test('store/actor navigation changes editor key; unmount during upload prevents subsequent write', async () => {
  const h = harness(); const original = h.outer(); assert.notEqual(h.module.ReviewedProductEditor({ store: { ...store, id: 'other-store' }, admin: true }).key, original.key);
  h.actor = 'other-admin'; assert.notEqual(h.outer().key, original.key); h.actor = 'admin';
  let finish; h.uploadWait = new Promise(resolve => finish = resolve); h.addImage(h.open()); h.rerender(); const saving = h.save(); await new Promise(resolve => setImmediate(resolve)); h.close(); finish(); await assert.rejects(saving);
  assert.equal(h.calls.filter(x => x[0] === 'save').length, 0);
});

test('unchanged sparse image order does not create an implicit image change', async () => {
  const h = harness(); h.open(); await h.save();
  const changes = h.calls.find(x => x[0] === 'save')[5];
  assert.deepEqual(changes, { fields: {}, variants: [], images: [] });
});
test('seller explicit field edit uses same reviewed path and preserves commercial values', async () => {
  const h = harness(); h.isAdmin = false; h.actor = 'seller';
  const tree = h.open(false);
  nodes(tree).find(n => n.type === 'Input' && n.props.value === 'Yara').props.onChange({ target: { value: 'Yara perfume' } });
  h.rerender(); await h.save();
  assert.deepEqual(h.calls.find(x => x[0] === 'save')[5], { fields: { title: 'Yara perfume' }, variants: [], images: [] });
});
