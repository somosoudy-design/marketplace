// Isolated component QA. Only loopback is allowed; no Marketplace API or public URLs are contacted.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), app = path.join(root, 'apps/storefront');
const installed = name => path.join(root, 'node_modules/.pnpm', fs.readdirSync(root + '/node_modules/.pnpm').find(n => n.startsWith(name.replaceAll('/', '+') + '@')), 'node_modules', name);
const esbuild = require(installed('esbuild'));
const { chromium, expect } = require(installed('@playwright/test'));
const out = process.argv[2] || '/tmp/mayami-share-qa-20261116';
const stubs = {
  'next/navigation': 'export const useSearchParams=()=>new URLSearchParams(location.search);',
  'next/link': "import React from 'react';export default ({href,children})=><a href={href}>{children}</a>",
  './photo': 'export const ProductPhoto=()=>null;', './favorite': 'export const Favorite=()=>null;', './product-card': 'export const ProductGrid=()=>null;',
  '@/lib/providers': 'export const useAccount=()=>({session:null,ready:true,retryCartSync(){}});',
  '@/lib/photos': 'export const catalogText=x=>x,catalogSample=()=>false,localExhibition=false,photo=()=>null;',
  '@/lib/cart-intents': 'export const addReviewedCart=()=>{throw Error("network forbidden")};',
  '@/lib/guest-storage': 'export const guestCart={add(){throw Error("purchase outside test")}};',
  '@/lib/guest-hooks': 'export const useGuestCartState=()=>({ready:true});',
  '@/lib/guest-errors': 'export const guestError=e=>e;',
  'react-native': "import React from 'react';export const Platform={get OS(){return window.testOS||'web'}};export const Share={share:p=>window.nativeShare(p)};export const View=({children})=><div>{children}</div>;",
  'expo-clipboard': 'export const setStringAsync=link=>window.mobileCopy(link);',
  '@/lib/links': 'export const appOnlyLinks=false;', '@/lib/brand': "export const brand={name:'mayami'};", '@/lib/haptics': 'export const haptics={success(){}};',
  '@/theme': 'export const useTheme=()=>({radii:{sm:8},colors:{surfaceSunken:"#eee"}});',
  './Button': "import React from 'react';export const Button=({testID,title,disabled,onPress})=><button data-testid={testID} disabled={disabled} onClick={onPress}>{title}</button>;",
  './Sheet': "import React from 'react';export const Sheet=({visible,title,testID,onClose,footer,children})=>visible?<section role='dialog' aria-label={title} data-testid={testID}><h2>{title}</h2><button onClick={onClose}>Cerrar móvil</button>{children}{footer}</section>:null;",
  './States': "import React from 'react';export const Banner=({body})=><p role='alert'>{body}</p>;",
  './Text': "import React from 'react';export const Text=({testID,children})=><span data-testid={testID}>{children}</span>;",
};
const jsx = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ProductDetail} from './src/components/product-detail';import {ProductShare} from './src/components/product-share';import {ShareLinkSheet} from '../mobile/src/components/ui/ShareLinkSheet';
const metadata={variants:[{variant_id:'local-variant',title:'Negro',active:true,stock:2,price_usd:25,images:[]}],general_images:[]};
const product={id:'local-product',slug:'producto-sintetico-local',title:'Producto sintético local con nombre extenso para probar el ajuste del contenido',availability:'available',max_per_order:2,store:{name:'Tienda de prueba local',slug:'local'},related:[],category_name:'Prueba local',category_slug:'local'};
function Mobile(){const [visible,setVisible]=useState(false);return <><button onClick={()=>setVisible(true)}>Abrir móvil</button><ShareLinkSheet visible={visible} title='Compartir producto' name={product.title} link='https://mayami.app/p/producto-sintetico-local' onClose={()=>setVisible(false)} testID='mobile-share'/></>}
const kind=new URLSearchParams(location.search).get('kind');const root=createRoot(document.querySelector('main'));root.render(<QueryClientProvider client={new QueryClient()}>{kind==='mobile'?<Mobile/>:kind==='encoded'?<ProductShare slug={'prueba /?á#'} title='Producto local'/>:<ProductDetail product={product} metadata={metadata} relatedMetadata={{}}/>}</QueryClientProvider>);`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const bundle = await esbuild.build({ alias: {react: installed('react'), 'react-dom': installed('react-dom')}, stdin: { contents: jsx, resolveDir: app, loader: 'jsx' }, bundle: true, write: false, jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, tsconfig: app + '/tsconfig.json', plugins: [{ name: 'local-boundaries', setup(build) {
    build.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: 'stub' } : null);
    build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'jsx', resolveDir: app }));
  } }] });
  if (process.env.MAYAMI_SHARE_COMPILE_ONLY === '1') { fs.writeFileSync(out + '/component-bundle.js', bundle.outputFiles[0].text); console.log('PASS: real components bundled; browser checks NOT run'); return; }
  const css = ['tokens.css', 'purchase.css', 'marketplace-home.css', 'globals.css'].map(f => fs.readFileSync(app + '/src/app/' + f, 'utf8').replace(/@import[^;]+;/g, '')).join('\n');
  const html = '<!doctype html><html lang="es"><head><title>Prueba local de compartir</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + ':root{--font-jakarta:Arial;}</style></head><body><main></main><script src="/bundle.js"></script></body></html>';
  const server = require('node:http').createServer((r, s) => { s.setHeader('Content-Type', r.url === '/bundle.js' ? 'text/javascript' : 'text/html'); s.end(r.url === '/bundle.js' ? bundle.outputFiles[0].text : html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try { browser = await chromium.launch({ ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  const report = [], link = 'https://mayami.app/p/producto-sintetico-local';
  async function page(options = {}, setup = {}) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options });
    const errors = [], blocked = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route('**/*', r => { if (new URL(r.request().url()).origin === origin) return r.continue(); blocked.push(r.request().url()); return r.abort(); });
    await p.addInitScript(({mode,os}) => {
      window.calls = 0; window.copyMode = 'success'; window.shareMode = 'success'; window.testOS = os;
      Object.defineProperty(navigator, 'share', { configurable: true, value: mode === 'absent' ? undefined : async payload => {
        window.calls++; window.payload = payload;
        if (window.shareMode === 'cancel') throw new DOMException('User cancelled', 'AbortError');
        if (window.shareMode === 'failure') throw new Error('denied');
        if (window.shareMode === 'pending') return new Promise(r => window.releaseShare = r);
      } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => {
        window.calls++; window.copiedLink = value;
        if (window.copyMode === 'failure') throw new Error('denied');
        if (window.copyMode === 'pending') return new Promise(r => window.releaseCopy = r);
      } } });
      window.nativeShare = p => navigator.share(p);
      window.mobileCopy = async p => { window.calls++; window.copiedLink=p; if(window.copyMode==='false')return false; if(window.copyMode==='failure')throw Error('denied');if(window.copyMode==='pending')await new Promise(r=>window.releaseCopy=r);return true; };
    }, {mode:setup.mode||'absent', os:setup.os||'web'});
    return {p,errors,blocked};
  }
  try {
    for (const width of [320,390,768,1440]) for (const colorScheme of ['light','dark']) {
      const {p,errors,blocked}=await page({viewport:{width,height:960},colorScheme});
      await p.goto(origin+'/p/producto-sintetico-local?token=private#private');
      const trigger=p.getByRole('button',{name:'Compartir producto',exact:true});
      await expect(trigger).toBeVisible();
      const size=await trigger.boundingBox(); assert(size.width>=44&&size.height>=44);
      await trigger.click(); const dialog=p.getByRole('dialog',{name:'Compartir producto',exact:true});
      await expect(dialog).toBeVisible(); await expect(dialog.getByLabel('Enlace del producto')).toHaveValue(link);
      await expect(dialog.getByRole('button',{name:'Compartir',exact:true})).toHaveCount(0);
      await expect(p.getByRole('button',{name:'Agregar al carrito'})).toBeVisible();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const box=await dialog.boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=960);
      await p.addScriptTag({path:installed('axe-core')+'/axe.min.js'});
      const axe=await p.evaluate(()=>axe.run(document.querySelector('dialog'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(axe.violations.map(v=>[v.id,v.nodes.map(n=>n.target)]),[]);
      await p.screenshot({path:path.join(out,`${width}-${colorScheme}.png`)});
      await dialog.getByRole('button',{name:'Copiar enlace'}).click();await expect(dialog.getByRole('status')).toHaveText('Enlace copiado'); assert.equal(await p.evaluate(()=>window.copiedLink),link);
      await p.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
      await trigger.click();await expect(dialog.getByRole('status')).toBeEmpty();
      await p.evaluate(()=>window.copyMode='failure');await dialog.getByRole('button',{name:'Copiar enlace'}).click();await expect(dialog.getByRole('alert')).toContainText('No pudimos copiar');
      await dialog.getByRole('button',{name:'Cerrar opciones de compartir'}).click();await expect(dialog).not.toBeVisible();
      assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);report.push({type:'web-responsive',width,colorScheme,axeViolations:axe.violations.length}); await p.close();
    }
    {
      const {p,errors}=await page({}, {mode:'native'});await p.goto(origin);const trigger=p.getByRole('button',{name:'Compartir producto',exact:true});await trigger.click();const d=p.getByRole('dialog');
      await p.evaluate(()=>window.shareMode='cancel');await d.getByRole('button',{name:'Compartir',exact:true}).click();await expect(d).toBeVisible();await expect(d.getByRole('alert')).toHaveCount(0);
      await p.evaluate(()=>window.shareMode='failure');await d.getByRole('button',{name:'Compartir',exact:true}).click();await expect(d.getByRole('alert')).toContainText('No pudimos compartir');
      await p.evaluate(()=>{window.shareMode='pending';window.calls=0});await d.getByRole('button',{name:'Compartir',exact:true}).click();await expect(d.getByRole('button',{name:'Copiar enlace'})).toBeDisabled();
      await p.evaluate(()=>{const b=[...document.querySelectorAll('dialog button')].find(x=>x.textContent==='Compartir');b.click();b.click()});assert.equal(await p.evaluate(()=>window.calls),1);
      await d.getByRole('button',{name:'Cerrar opciones de compartir'}).click();await trigger.click();await p.evaluate(()=>window.releaseShare());await expect(d).toBeVisible();await expect(d.getByRole('button',{name:'Copiar enlace'})).toBeEnabled();
      await d.getByRole('button',{name:'Compartir',exact:true}).click(); // still pending, release this new operation
      await p.evaluate(()=>window.releaseShare());await expect(d).not.toBeVisible();assert.equal(await p.evaluate(()=>window.payload.url),link);
      assert.deepEqual(errors,[]);report.push({type:'web-native-boundary',cancel:true,error:true,duplicate:true,staleCompletion:true});await p.close();
    }
    {
      const {p}=await page();await p.goto(origin+'?kind=encoded');await p.getByRole('button',{name:'Compartir producto'}).click();await expect(p.getByLabel('Enlace del producto')).toHaveValue('https://mayami.app/p/prueba%20%2F%3F%C3%A1%23');await p.close();report.push({type:'web-encoded-link'});
    }
    for(const os of ['web','android','ios']) {
      const {p,errors}=await page({}, {mode:'native',os});await p.goto(origin+'?kind=mobile');const open=p.getByRole('button',{name:'Abrir móvil'});await open.click();const d=p.getByRole('dialog');
      await p.evaluate(()=>window.copyMode='false');await d.getByTestId('mobile-share-copy').click();await expect(d.getByRole('alert')).toBeVisible();await expect(d.getByTestId('mobile-share-copy')).toHaveText('Copiar enlace');
      await p.evaluate(()=>window.copyMode='success');await d.getByTestId('mobile-share-copy').click();await expect(d.getByTestId('mobile-share-copy')).toHaveText('Enlace copiado');assert.equal(await p.evaluate(()=>window.copiedLink),link);
      await d.getByRole('button',{name:'Cerrar móvil'}).click();await open.click();await expect(d.getByTestId('mobile-share-copy')).toHaveText('Copiar enlace');
      await p.evaluate(()=>{window.copyMode='pending';window.calls=0});await d.getByTestId('mobile-share-copy').click();await expect(d.getByTestId('mobile-share-native')).toBeDisabled();
      await d.getByRole('button',{name:'Cerrar móvil'}).click();await open.click();await p.evaluate(()=>window.releaseCopy());await expect(d.getByTestId('mobile-share-copy')).toHaveText('Copiar enlace');assert.equal(await p.evaluate(()=>window.calls),1);
      await p.evaluate(()=>window.shareMode='cancel');await d.getByTestId('mobile-share-native').click();await expect(d.getByRole('alert')).toHaveCount(0);await expect(d).toBeVisible();
      await p.evaluate(()=>window.shareMode='success');await d.getByTestId('mobile-share-native').click();await expect(d).not.toBeVisible();const payload=await p.evaluate(()=>window.payload);assert.equal(os==='ios'?payload.url:os==='android'?payload.message.split(': ').pop():payload.url,link);
      assert.deepEqual(errors,[]);report.push({type:'mobile-component-boundaries',os,falseClipboard:true,staleCompletion:true,nativePayload:true,cancellation:true});await p.close();
    }
    fs.writeFileSync(out+'/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.length,out,report},null,2));
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(e=>{console.error(e);process.exitCode=1});
