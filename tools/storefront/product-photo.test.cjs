const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const root = resolve(__dirname, '../..');
const req = createRequire(root + '/apps/storefront/package.json');
const ts = req('typescript');
const React = req('react');

// Exercise the real component and effects with deterministic hook/event ports.
// This is not a browser, network, image decoding, or visual-layout test.
function harness(initial = {}) {
  const listeners = new Map(),
    microtasks = [],
    probes = [],
    instances = new Map();
  let current,
    dirty = false,
    updates = 0,
    live = new Set(),
    props = initial,
    tree;
  const window = {
    navigator: { onLine: true },
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    Image: class {
      constructor() {
        probes.push(this);
      }
    },
  };
  const hooks = {
    useState: (value) => {
      const instance = current,
        index = instance.cursor++;
      if (!(index in instance.slots)) instance.slots[index] = typeof value === 'function' ? value() : value;
      return [
        instance.slots[index],
        (update) => {
          const next = typeof update === 'function' ? update(instance.slots[index]) : update;
          if (!Object.is(next, instance.slots[index])) {
            instance.slots[index] = next;
            updates++;
            dirty = true;
          }
        },
      ];
    },
    useEffect: (effect, deps) => {
      const instance = current,
        index = instance.cursor++,
        previous = instance.effects[index];
      if (!previous || !deps || deps.some((d, i) => !Object.is(d, previous.deps[i]))) {
        instance.effects[index] = { deps, effect, cleanup: previous?.cleanup, pending: true };
      }
    },
  };
  const ports = {
    react: hooks,
    'react/jsx-runtime': req('react/jsx-runtime'),
    'lucide-react': { ImageOff: () => null },
    '@/lib/env': { env: { url: 'http://127.0.0.1:4515' } },
    '@kora/api': {
      publicImageUrl: (base, bucket, path) => (path ? `${base}/storage/v1/object/public/${bucket}/${path}` : null),
    },
    '@/lib/photos': { imageUrl: (id, path) => (path ? `/approved/${path}` : null) },
  };
  const output = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(root + '/apps/storefront/src/components/photo.tsx', 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports: output,
      queueMicrotask: (fn) => microtasks.push(fn),
      window,
      require: (name) => {
        assert(name in ports, name);
        return ports[name];
      },
    },
  );
  function resolveNode(node, path = 'root') {
    if (node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((child, i) => resolveNode(child, `${path}/${i}`));
    if (typeof node.type === 'function') {
      const key = `${path}/${node.type.name}/${node.key ?? ''}`;
      if (!instances.has(key)) instances.set(key, { cursor: 0, slots: [], effects: [] });
      current = instances.get(key);
      current.cursor = 0;
      live.add(key);
      return resolveNode(node.type(node.props), key);
    }
    return { ...node, props: { ...node.props, children: resolveNode(node.props.children, `${path}/children`) } };
  }
  function flushMicrotasks() {
    while (microtasks.length) microtasks.shift()();
  }
  function render(next = props, flush = true) {
    props = next;
    for (let runs = 0; runs < 20; runs++) {
      dirty = false;
      live = new Set();
      tree = resolveNode(
        React.createElement(output.ProductPhoto, {
          id: 'p',
          path: 'photo.webp',
          demo: false,
          title: 'Foto de prueba',
          ...props,
        }),
      );
      for (const [key, instance] of instances) {
        if (!live.has(key)) {
          instance.effects.forEach((e) => e?.cleanup?.());
          instances.delete(key);
          continue;
        }
        for (const effect of instance.effects)
          if (effect?.pending) {
            effect.pending = false;
            effect.cleanup?.();
            effect.cleanup = effect.effect();
          }
      }
      if (flush) flushMicrotasks();
      if (!dirty) return tree;
    }
    throw Error('Effects did not settle');
  }
  function find(type, node = tree) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map((n) => find(type, n)).find(Boolean) ?? null;
    return node.type === type ? node : find(type, node.props?.children);
  }
  const api = {
    render,
    find,
    window,
    probes,
    pendingMicrotasks: () => microtasks.length,
    updates: () => updates,
    flushMicrotasks,
    failBeforeReconnectEffect: (flush = true) => {
      window.navigator.onLine = false;
      find('img').props.onError();
      window.navigator.onLine = true;
      for (const callback of [...(listeners.get('online') ?? [])]) callback();
      render(props, flush);
    },
    fail: () => {
      assert(find('img'), 'Image required before error');
      find('img').props.onError();
      render();
    },
    event: (name, online) => {
      window.navigator.onLine = online;
      for (const callback of [...(listeners.get(name) ?? [])]) callback();
      render();
    },
    count: (name) => listeners.get(name)?.size ?? 0,
    unmount: () => {
      for (const instance of instances.values()) instance.effects.forEach((e) => e?.cleanup?.());
      instances.clear();
    },
  };
  render();
  return api;
}

test('preserves image identity, accessible title, priority and lazy loading', () => {
  const h = harness();
  assert.equal(h.find('img').props.src, '/approved/photo.webp');
  assert.equal(h.find('img').props.alt, 'Foto de prueba');
  assert.equal(h.find('img').props.loading, 'lazy');
  h.render({ exact: true, priority: true });
  assert.equal(h.find('img').props.src, 'http://127.0.0.1:4515/storage/v1/object/public/catalog/photo.webp');
  assert.equal(h.find('img').props.loading, 'eager');
});

test('a missing path never registers retry listeners or makes an image', () => {
  const h = harness({ path: null });
  assert.equal(h.find('img'), null);
  assert.equal(h.count('online'), 0);
  h.event('offline', false);
  h.event('online', true);
  assert.equal(h.find('img'), null);
});

test('an online event without a real offline transition does not loop on a missing file', () => {
  const h = harness();
  h.fail();
  h.event('online', true);
  h.event('online', true);
  assert.equal(h.find('img'), null);
});

test('a failed image retries once after offline to online, and may fail safely again', () => {
  const h = harness();
  h.fail();
  h.event('offline', false);
  h.event('online', true);
  assert.equal(h.find('img')?.props.src, '/approved/photo.webp');
  assert.equal(h.count('online'), 0);
  h.fail();
  h.event('online', true);
  assert.equal(h.find('img'), null);
  h.event('offline', false);
  h.event('online', true);
  assert(h.find('img'));
});

test('failure that started while offline retries on first online event', () => {
  const h = harness();
  h.window.navigator.onLine = false;
  h.fail();
  h.event('online', true);
  assert(h.find('img'));
});

test('returning to a previously failed gallery image starts a fresh attempt', () => {
  const h = harness();
  h.fail();
  h.render({ path: 'other.webp' });
  assert(h.find('img'));
  h.render({ path: 'photo.webp' });
  assert(h.find('img'));
});

test('changing product or variant resets failure even if image URL is shared', () => {
  const h = harness();
  h.fail();
  h.render({ variant: 'blue' });
  assert(h.find('img'));
  h.fail();
  h.render({ id: 'other-product', variant: 'blue' });
  assert(h.find('img'));
});

test('listeners are removed on source change and unmount', () => {
  const h = harness();
  h.fail();
  assert.equal(h.count('offline'), 1);
  assert.equal(h.count('online'), 1);
  h.render({ path: 'other.webp' });
  assert.equal(h.count('offline'), 0);
  assert.equal(h.count('online'), 0);
  h.fail();
  h.unmount();
  assert.equal(h.count('offline'), 0);
  assert.equal(h.count('online'), 0);
});

test('optional matte never hides original while loading or on failure; success applies mask', () => {
  const h = harness({ alphaMask: '/mask.png' });
  assert.equal(h.find('img').props.style, undefined);
  assert.equal(h.probes[0].src, '/mask.png');
  h.probes[0].onload();
  h.render();
  assert.equal(h.find('img').props.style.maskImage, 'url("/mask.png")');
  h.render({ alphaMask: '/other-mask.png' });
  assert.equal(h.find('img').props.style, undefined);
  h.unmount();
  assert.equal(h.probes.at(-1).onload, null);
});

test('reconnection between onError and the passive subscription still retries once', () => {
  const h = harness();
  h.failBeforeReconnectEffect();
  assert(h.find('img'));
  h.fail();
  h.event('online', true);
  h.event('online', true);
  assert.equal(h.find('img'), null, 'a permanent online failure must not loop');
});

test('a queued reconnection is canceled when its source is unmounted', () => {
  const h = harness();
  h.failBeforeReconnectEffect(false);
  assert.equal(h.pendingMicrotasks(), 1);
  const updates = h.updates();
  h.unmount();
  h.flushMicrotasks();
  assert.equal(h.updates(), updates);
  assert.equal(h.count('offline'), 0);
  assert.equal(h.count('online'), 0);
});

test('duplicate online signals before a queued retry do not multiply attempts', () => {
  const h = harness();
  h.failBeforeReconnectEffect(false);
  assert.equal(h.pendingMicrotasks(), 1);
  const updates = h.updates();
  h.event('online', true);
  assert(h.find('img'));
  assert.equal(h.updates(), updates + 1);
  assert.equal(h.pendingMicrotasks(), 0);
});

test('a queued retry waits if the browser goes offline again before its microtask', () => {
  const h = harness();
  h.failBeforeReconnectEffect(false);
  assert.equal(h.pendingMicrotasks(), 1);
  h.event('offline', false);
  assert.equal(h.find('img'), null, 'a stale online snapshot must not retry offline');
  h.event('online', true);
  assert(h.find('img'));
});

test('hydration handles an already broken image and waits for an actual reconnection', () => {
  const h = harness();
  h.find('img').props.ref({ complete: true, naturalWidth: 0 });
  h.render();
  assert.equal(h.find('img'), null);
  h.event('online', true);
  assert.equal(h.find('img'), null);
  h.event('offline', false);
  h.event('online', true);
  assert.ok(h.find('img'));
});

test('a loading or successfully decoded SSR image keeps its original source', () => {
  for (const image of [{ complete: false, naturalWidth: 0 }, { complete: true, naturalWidth: 640 }]) {
    const h = harness();
    const source = h.find('img').props.src;
    h.find('img').props.ref(image);
    h.render();
    assert.equal(h.find('img').props.src, source);
  }
});
