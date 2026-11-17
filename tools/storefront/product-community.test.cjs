const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.MAYAMI_COMMUNITY_SOURCE_ROOT || path.resolve(__dirname, '../..');
const componentDir = process.env.MAYAMI_COMMUNITY_COMPONENT_DIR || path.join(root, 'apps/storefront/src/components');
const req = require('node:module').createRequire(path.join(root, 'apps/storefront/package.json'));
const ts = req('typescript');
const productId = '00000000-0000-4000-8000-000000000001';
const questionId = '00000000-0000-4000-8000-000000000002';
const orderId = '00000000-0000-4000-8000-000000000003';
const actor = '00000000-0000-4000-8000-000000000004';
const question = { id: questionId, body: '¿Incluye el adaptador?', author: 'Persona local', store_name: 'Mayami', status: 'published', created_at: '2026-11-17T12:00:00Z', answer_body: null };
const jsx = (type, props) => ({ type, props: props || {} });
const tick = () => new Promise(resolve => setImmediate(resolve));
function load(name, ports, extra = '') {
  const exports = {};
  const source = fs.readFileSync(path.join(componentDir, name + '.tsx'), 'utf8') + extra;
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in ports)) throw Error('Unexpected dependency: ' + name); return ports[name]; }, URLSearchParams, Error, Intl, Date });
  return exports;
}
function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node?.props ? textOf(node.props.children) : '';
}
// Real component handlers and query/mutation boundaries, with deterministic hook slots.
// These are unit tests, not DOM, visual, keyboard, device or remote database verification.
function fixture(kind = 'session') {
  const slots = [];
  let index = 0, tree, props, ready = true, accountActor = actor, captureGate = async () => {}, assertCurrent = async () => {}, calls = [], mutationCount = 0, invalidations = 0, readOptions;
  const methods = { ask: async () => ({}), answer: async () => ({}), moderate: async () => ({}) };
  const query = { isSuccess: true, isFetching: false, isPending: false, isError: false, data: { count: 1, items: [question], can_ask: true, can_answer: true, can_moderate: true }, refetch: async () => {} };
  const hooks = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = index++; return slots[i] ||= { current: initial }; },
    useEffect(effect, dependencies) { const i = index++, previous = slots[i]; if (!previous || dependencies?.some((v, n) => v !== previous.dependencies?.[n])) { previous?.cleanup?.(); slots[i] = { dependencies, cleanup: effect() }; } },
  };
  const api = { questions: Object.fromEntries(Object.keys(methods).map(method => [method, async (...args) => { calls.push({ method, args }); return methods[method](...args); }])) };
  const ports = {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, 'next/link': { default: 'Link' },
    'next/navigation': { useSearchParams: () => new URLSearchParams('variant=purple') }, 'lucide-react': { MessageCircle: 'MessageCircle' },
    '@tanstack/react-query': {
      useQuery: options => { readOptions = options; return query; },
      useQueryClient: () => ({ invalidateQueries: async () => { invalidations++; } }),
      useMutation(options) {
        const i = index++;
        const mutation = slots[i] ||= { isPending: false, isError: false, error: null, variables: undefined };
        mutation.reset = () => { mutation.isError = false; mutation.error = null; };
        mutation.mutate = value => {
          mutationCount++; mutation.isPending = true; mutation.isError = false; mutation.variables = value;
          mutation.promise = Promise.resolve().then(() => options.mutationFn(value)).then(async result => { await options.onSuccess?.(result, value); }, async error => { mutation.error = error; mutation.isError = true; await options.onError?.(error, value); }).finally(() => { mutation.isPending = false; options.onSettled?.(); });
        };
        return mutation;
      },
    },
    '@kora/api': { createApi: () => api, createKoraClient: () => ({}) },
    '@/lib/providers': { useAccount: () => ({ ready, session: accountActor ? { user: { id: accountActor } } : null }) },
    '@/lib/actor-api': { captureBuyerApi: async expected => { assert.equal(expected, actor); await captureGate(); return { api, assertCurrent }; } },
    '@/lib/auth-return': { authHref: (route, back) => route + '?next=' + encodeURIComponent(back) }, '@/lib/env': { env: { url: 'http://local.invalid', anon: 'local-only' } },
  };
  const mod = load('product-questions', ports, '\nexport { QuestionsSession as TestSession, QuestionRow as TestRow };\n');
  props = kind === 'row' ? { question: { ...question }, actor, canAnswer: true, canModerate: true, editable: true, refresh: async () => { invalidations++; } } : { productId, slug: 'producto local', seller: 'Mayami', actor };
  function render() { index = 0; tree = (kind === 'row' ? mod.TestRow : mod.TestSession)(props); return tree; }
  function nodes(node) { if (!arguments.length) node = tree; if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
  function button(label) { const node = nodes().find(n => n.type === 'button' && textOf(n) === label); assert(node, 'Missing button: ' + label); return node; }
  function form() { return nodes().find(n => n.type === 'form'); }
  function fill(value) { const node = nodes().find(n => n.type === 'textarea' || n.type === 'select'); assert(node); node.props.onChange({ target: { value } }); render(); }
  function submit() { assert(form()); form().props.onSubmit({ preventDefault() {} }); }
  render();
  return { render, nodes, button, form, fill, submit, query, methods, props, calls, setReady: value => { ready = value; }, setActor: value => { accountActor = value; props.actor = value; }, setCapture: fn => { captureGate = fn; }, setAssert: fn => { assertCurrent = fn; }, get mutationCount() { return mutationCount; }, get invalidations() { return invalidations; }, get readOptions() { return readOptions; }, async settle() { await tick(); render(); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}

test('questions: immediate double submit makes one request, locks toggles, and recovers without losing the draft', async () => {
  const f = fixture(); f.button('Hacer una pregunta').props.onClick(); f.render();
  const draft = '¿Este producto incluye el adaptador?'; f.fill(draft);
  let fail; f.methods.ask = () => new Promise((_, reject) => { fail = reject; });
  const submit = f.form().props.onSubmit; submit({ preventDefault() {} }); submit({ preventDefault() {} });
  f.render(); assert.equal(f.mutationCount, 1); assert.equal(f.button('Hacer una pregunta').props.disabled, true);
  f.button('Hacer una pregunta').props.onClick(); f.render(); assert(f.form());
  await tick(); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].args[1], draft);
  fail(Error('No se pudo enviar. Intenta de nuevo.')); await f.settle();
  assert.equal(f.nodes().find(n => n.type === 'textarea').props.value, draft);
  assert(f.nodes().some(n => n.props.role === 'alert'));
  assert.equal(f.button('Enviar pregunta').props.disabled, false);
  f.methods.ask = async () => ({}); f.submit(); await f.settle();
  assert.equal(f.calls.length, 2); assert.equal(f.form(), undefined); assert.equal(f.invalidations, 1);
});

test('questions: refetch errors retain rows and the ask draft while blocking stale permissions', () => {
  const f = fixture(); f.button('Hacer una pregunta').props.onClick(); f.render(); f.fill('¿Funciona con mi equipo actual?');
  f.query.isSuccess = false; f.query.isError = true; f.render();
  assert.equal(f.nodes().find(n => n.type === 'textarea').props.value, '¿Funciona con mi equipo actual?');
  const row = f.nodes().find(n => typeof n.type === 'function' && n.type.name === 'QuestionRow'); assert(row); assert.equal(row.props.editable, false);
  assert.equal(f.button('Enviar pregunta').props.disabled, true); f.submit(); assert.equal(f.mutationCount, 0);
  assert(f.nodes().some(n => n.props.role === 'alert' && textOf(n).includes('Conservamos')));
  f.query.isError = false; f.query.isSuccess = true; f.query.data.can_ask = false; f.render(); f.submit(); assert.equal(f.mutationCount, 0);
});

test('questions: initial load errors do not masquerade as an empty successful collection', () => {
  const f = fixture(); f.query.isSuccess = false; f.query.isError = true; f.query.data = undefined; f.render();
  assert(f.nodes().some(n => n.props.role === 'alert' && textOf(n).includes('No pudimos cargar')));
  assert(!f.nodes().some(n => n.props.className === 'question-empty'));
});

test('questions: an account change during capture prevents an outgoing request', async () => {
  const f = fixture(); f.button('Hacer una pregunta').props.onClick(); f.render(); f.fill('¿Funciona con mi equipo actual?');
  let release; f.setCapture(() => new Promise(resolve => { release = resolve; })); f.submit(); await tick(); f.unmount(); release(); await tick();
  assert.equal(f.calls.length, 0); assert.equal(f.invalidations, 0);
});

test('questions: actor identity failure prevents submission and preserves recovery', async () => {
  const f = fixture(); f.button('Hacer una pregunta').props.onClick(); f.render(); f.fill('¿Funciona con mi equipo actual?');
  f.setAssert(async () => { throw Error('La cuenta cambió'); }); f.submit(); await f.settle();
  assert.equal(f.calls.length, 0); assert(f.form()); assert.equal(f.button('Enviar pregunta').props.disabled, false);
});

test('answer: pending save locks alternate actions and failures preserve the exact text', async () => {
  const f = fixture('row'); f.button('Responder').props.onClick(); f.render(); f.fill('Sí, el adaptador está incluido.');
  let fail; f.methods.answer = () => new Promise((_, reject) => { fail = reject; });
  f.submit(); f.submit(); f.render(); assert.equal(f.mutationCount, 1);
  assert.equal(f.button('Ocultar pregunta').props.disabled, true); f.button('Ocultar pregunta').props.onClick(); f.render();
  assert(f.nodes().some(n => n.type === 'textarea')); await tick(); assert.equal(f.calls[0].method, 'answer');
  fail(Error('No se pudo guardar')); await f.settle();
  assert.equal(f.nodes().find(n => n.type === 'textarea').props.value, 'Sí, el adaptador está incluido.');
  assert.equal(f.button('Publicar respuesta').props.disabled, false);
});

test('answer: retained form cannot submit after permission loss or read refetch', () => {
  const f = fixture('row'); f.button('Responder').props.onClick(); f.render(); f.fill('Respuesta que no se debe perder.');
  f.props.editable = false; f.render(); f.submit(); assert.equal(f.mutationCount, 0);
  assert.equal(f.nodes().find(n => n.type === 'textarea').props.value, 'Respuesta que no se debe perder.');
  f.props.editable = true; f.props.canAnswer = false; f.render(); f.submit(); assert.equal(f.mutationCount, 0);
  assert.equal(f.button('Publicar respuesta').props.disabled, true);
});

test('moderation: a concurrent refresh cannot reverse the explicitly chosen hide operation', async () => {
  const f = fixture('row'); f.button('Ocultar pregunta').props.onClick(); f.render(); f.fill('Incluye datos personales');
  f.props.question = { ...f.props.question, status: 'hidden' }; f.render();
  assert(f.nodes().some(n => n.type === 'select'));
  f.submit(); await f.settle();
  assert.deepEqual(f.calls.map(c => [c.method, ...c.args]), [['moderate', questionId, true, 'Incluye datos personales']]);
});

test('questions: guest return URL keeps variant and section without a rejected hash', () => {
  const f = fixture(); f.setActor(undefined); f.render();
  const link = f.nodes().find(n => n.props.href); const url = new URL(link.props.href, 'https://mayami.app');
  const next = new URL(url.searchParams.get('next'), 'https://mayami.app');
  assert.equal(next.pathname, '/p/producto%20local'); assert.equal(next.searchParams.get('variant'), 'purple'); assert.equal(next.searchParams.get('section'), 'preguntas'); assert.equal(next.hash, '');
  f.setReady(false); f.render(); assert(!f.nodes().some(n => n.props.href));
});

function destinationFixture(product = { slug: 'prueba /?á#' }) {
  const calls = [];
  const ports = { react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': {}, 'next/navigation': {}, 'lucide-react': {}, '@tanstack/react-query': {}, '@/lib/providers': {}, './buyer': {}, './states': {}, '@/lib/browser': { browser: () => ({ api: { catalog: { product: async id => { calls.push(id); return product; } } } }) } };
  return { calls, destination: load('notifications', ports, '\nexport { destination as testDestination };').testDestination };
}

test('notifications: seller and buyer question notices open the public question section, ahead of order routing', async () => {
  for (const audience of ['store', 'buyer']) {
    const f = destinationFixture();
    const destination = await f.destination({ data: { audience, question_id: questionId, product_id: productId, order_id: orderId } });
    assert.equal(destination, '/p/prueba%20%2F%3F%C3%A1%23?section=preguntas'); assert.deepEqual(f.calls, [productId]);
  }
});

test('notifications: ordinary seller notices never open another buyer order', async () => {
  const f = destinationFixture();
  assert.equal(await f.destination({ data: { audience: 'store', order_id: orderId, product_id: productId } }), null); assert.equal(f.calls.length, 0);
});

test('notifications: existing buyer order and ordinary product destinations remain intact', async () => {
  const f = destinationFixture({ slug: 'producto' });
  assert.equal(await f.destination({ data: { order_id: orderId, product_id: productId } }), '/pedidos/' + orderId);
  assert.equal(await f.destination({ data: { product_id: productId } }), '/p/producto'); assert.deepEqual(f.calls, [productId]);
});

test('notifications: unresolvable question product rejects instead of marking a false destination', async () => {
  const f = destinationFixture(null);
  await assert.rejects(f.destination({ data: { question_id: questionId, product_id: productId } }), /ya no está disponible/);
});

test('notifications: malformed ids never become deep links or trigger a product read', async () => {
  const f = destinationFixture();
  assert.equal(await f.destination({ data: { audience: 'store', question_id: 'bad', product_id: productId } }), null);
  assert.equal(await f.destination({ data: { question_id: questionId, product_id: '../../account', order_id: 'bad' } }), null); assert.equal(f.calls.length, 0);
});
