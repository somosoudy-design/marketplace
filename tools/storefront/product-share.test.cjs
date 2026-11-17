const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), req = require('node:module').createRequire(root + '/apps/storefront/package.json');
const ts = req('typescript'), sourceRoot = process.env.MAYAMI_SHARE_SOURCE_ROOT || root;
// Exercise the real component handlers with deterministic hook slots and explicit platform boundaries.
// This is not DOM, native device, focus or visual QA. The separate .ui.cjs covers those browser checks.
function fixture(kind = 'web', os = 'web') {
  const slots = []; let index = 0, tree, closed = 0, copied, calls = 0;
  const native = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  let copy = async value => { copied = value; return true; }, share = async () => { calls++; };
  const jsx = (type, props) => ({ type, props: props || {} });
  const hooks = {
    useRef(value) { const i = index++; return slots[i] ||= { current: value === null ? native : value }; },
    useState(value) { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useId() { return 'fixture-' + index++; },
  };
  const navigator = { share: value => share(value), clipboard: { writeText: async value => { await copy(value); } } };
  const ports = {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { Check: 'Check', Copy: 'Copy', Share2: 'Share2', X: 'X' },
    '../../../../config/brand-presentation': { publicBrandLink: p => 'https://mayami.app' + p },
    'react-native': { Platform: { OS: os }, Share: { share: p => share(p) }, View: 'View' },
    'expo-clipboard': { setStringAsync: p => copy(p) }, '@/lib/links': { appOnlyLinks: false }, '@/lib/brand': { brand: { name: 'mayami' } },
    '@/lib/haptics': { haptics: { success() {} } }, '@/theme': { useTheme: () => ({ radii: { sm: 8 }, colors: {} }) },
    './Button': { Button: 'Button' }, './Sheet': { Sheet: 'Sheet' }, './States': { Banner: 'Banner' }, './Text': { Text: 'Text' },
  };
  const exports = {}, source = fs.readFileSync(sourceRoot + (kind === 'web' ? '/apps/storefront/src/components/product-share.tsx' : '/apps/mobile/src/components/ui/ShareLinkSheet.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, require: n => { if (!(n in ports)) throw Error(n); return ports[n]; }, navigator, Error });
  function render() { index = 0; tree = kind === 'web' ? exports.ProductShare({ slug: 'prueba /?á#', title: 'Prueba' }) : exports.ShareLinkSheet({ visible: true, title: 'Compartir producto', name: 'Prueba', link: 'https://mayami.app/p/prueba', onClose: () => closed++, testID: 'product-share' }); return tree; }
  function nodes(value) { if (!arguments.length) value = tree; if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(nodes); return [value, ...nodes(value.props?.children), ...nodes(value.props?.footer)]; }
  function control(action) { return nodes().find(n => kind === 'mobile' ? n.props.testID === 'product-share-' + (action === 'share' ? 'native' : 'copy') : n.type === 'button' && (action === 'trigger' ? n.props['aria-haspopup'] === 'dialog' : action === 'close' ? n.props['aria-label'] === 'Cerrar opciones de compartir' : action === 'share' ? n.props.className === 'button' : n.props.className === 'button secondary')); }
  const click = async action => { const node = control(action); assert(node, action); node.props[kind === 'mobile' ? 'onPress' : 'onClick'](); await settle(); render(); };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  render();
  return { render, nodes, control, click, settle, close() { if (kind === 'mobile') tree.props.onClose(); else control('close').props.onClick(); render(); }, native, navigator,
    setCopy(fn) { copy = fn; }, setShare(fn) { share = fn; }, get closed() { return closed; }, get copied() { return copied; }, get calls() { return calls; },
    get error() { return nodes().find(n => n.props.role === 'alert' || n.type === 'Banner'); },
    get success() { return nodes().some(n => n.props.title === 'Enlace copiado' || n.props.role === 'status' && n.props.children === 'Enlace copiado'); },
  };
}
for (const kind of ['web', 'mobile']) {
  test(`${kind}: copy success, reset and rejected clipboard`, async () => {
    const f = fixture(kind); if(kind === 'web') await f.click('trigger');
    await f.click('copy'); assert.equal(f.success,true); assert.match(f.copied,/^https:\/\/mayami.app\/p\//);
    f.close(); assert.equal(f.success,false); f.setCopy(async()=>{throw Error('denied')});await f.click('copy'); assert(f.error);assert.equal(f.success,false);
  });
  test(`${kind}: native cancellation is not an error and failure is recoverable`, async () => {
    const f=fixture(kind);if(kind==='web')await f.click('trigger');
    f.setShare(async()=>{const e=Error('cancelled');e.name='AbortError';throw e});await f.click('share');assert.equal(f.error,undefined);assert.equal(f.closed,0);
    f.setShare(async()=>{throw Error('denied')});await f.click('share');assert(f.error);f.setShare(async()=>{});await f.click('share');assert.equal(f.error,undefined);
    assert.equal(kind==='mobile'?f.closed:!f.native.open,kind==='mobile'?1:true);
  });
  test(`${kind}: immediate repeated calls coalesce`, async () => {
    const f=fixture(kind);if(kind==='web')await f.click('trigger');let count=0,release;f.setCopy(()=>{count++;return new Promise(r=>release=r)});
    const button=f.control('copy'), action=kind==='mobile'?'onPress':'onClick';button.props[action]();button.props[action]();button.props[action]();f.render();assert.equal(count,1);assert.equal(f.control('copy').props.disabled,true);
    release(true);await f.settle();f.render();assert.equal(f.success,true);assert.equal(f.control('copy').props.disabled,false);
  });
  test(`${kind}: close permits recovery while stale copy cannot overwrite a newer operation`, async () => {
    const f=fixture(kind);if(kind==='web')await f.click('trigger');let oldRelease,newRelease;
    f.setCopy(()=>new Promise(r=>oldRelease=r));await f.click('copy');f.close();assert.equal(f.control('copy').props.disabled,false);
    f.setCopy(()=>new Promise(r=>newRelease=r));await f.click('copy');oldRelease(true);await f.settle();f.render();assert.equal(f.success,false);assert.equal(f.control('copy').props.disabled,true);
    newRelease(true);await f.settle();f.render();assert.equal(f.success,true);assert.equal(f.control('copy').props.disabled,false);
  });
  test(`${kind}: stale native completion does not close the reopened sheet`, async () => {
    const f=fixture(kind);if(kind==='web')await f.click('trigger');let release;f.setShare(()=>new Promise(r=>release=r));await f.click('share');f.close();const closed=f.closed;
    if(kind==='web')await f.click('trigger');release();await f.settle();f.render();assert.equal(f.closed,closed);if(kind==='web')assert.equal(f.native.open,true);
  });
}
test('web: canonical encoded product URL omits internal location and private query', async()=>{const f=fixture();await f.click('trigger');assert.equal(f.nodes().find(n=>n.type==='input').props.value,'https://mayami.app/p/prueba%20%2F%3F%C3%A1%23');});
test('web: missing native API retains copy and selectable link',async()=>{const f=fixture();delete f.navigator.share;await f.click('trigger');assert.equal(f.control('share'),undefined);assert(f.nodes().some(n=>n.type==='input'&&n.props.readOnly));await f.click('copy');assert.equal(f.success,true);});
test('web: missing clipboard reports error without false success',async()=>{const f=fixture();delete f.navigator.clipboard;await f.click('trigger');await f.click('copy');assert(f.error);assert.equal(f.success,false);});
test('mobile: false native clipboard result is an error, not copied',async()=>{const f=fixture('mobile','android');f.setCopy(async()=>false);await f.click('copy');assert(f.error);assert.equal(f.success,false);});
for(const os of ['ios','android','web']) test(`mobile: ${os} native payload preserves the public product link`,async()=>{const f=fixture('mobile',os);let payload;f.setShare(async p=>{payload=p});await f.click('share');if(os==='android')assert.equal(payload.message,'Prueba en mayami: https://mayami.app/p/prueba');else assert.equal(payload.url,'https://mayami.app/p/prueba');assert.equal(f.closed,1);});
test('web: real React SSR renders a named dialog, labelled read-only URL and non-submit controls',()=>{
  const React=req('react'), {renderToStaticMarkup}=req('react-dom/server'), exports={};
  const source=fs.readFileSync(root+'/apps/storefront/src/components/product-share.tsx','utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{
    if(n==='../../../../config/brand-presentation')return {publicBrandLink:p=>'https://mayami.app'+p};
    return req(n);
  }});
  const html=renderToStaticMarkup(React.createElement(exports.ProductShare,{slug:'prueba',title:'Producto local'}));
  assert.match(html,/<button type="button"[^>]*aria-label="Compartir producto"[^>]*aria-haspopup="dialog"/);
  assert.match(html,/<dialog[^>]*aria-labelledby="[^"]+"/);
  assert.match(html,/<label for="[^"]+">Enlace del producto<\/label>/);
  assert.match(html,/<input[^>]*readOnly=""[^>]*value="https:\/\/mayami.app\/p\/prueba"/);
  assert.match(html,/role="status"/);
  assert.doesNotMatch(html,/<button type="submit"/);
});

test('web: a delayed close event preserves the pending copy in the reopened dialog', async () => {
  const f = fixture();
  await f.click('trigger');
  f.close();
  await f.click('trigger');
  let finishCopy;
  f.setCopy(() => new Promise(resolve => { finishCopy = resolve; }));
  await f.click('copy');
  f.nodes().find(node => node.type === 'dialog').props.onClose({ currentTarget: f.native });
  f.render();
  assert.equal(f.control('copy').props.disabled, true);
  finishCopy();
  await f.settle();
  f.render();
  assert.equal(f.success, true);
});
