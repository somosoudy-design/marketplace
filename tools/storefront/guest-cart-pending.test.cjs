const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),req=createRequire(root+'/apps/storefront/package.json'),ts=req('typescript');
let pending=0,live=0,current,mutationOptions,linePending=false,linePaused=false,mutationCalls=[],settleLine;
const selectors=[];
const checkSelector=options=>{assert.deepEqual(Array.from(options.mutationKey),['cart-write','guest']);assert.equal(options.exact,true);selectors.push(options);};
const qc={isMutating:options=>{checkSelector(options);return live;}};
const guest={ready:true,error:null,data:[{product_id:'p',variant_id:'v',quantity:2,title:'Local'}]};
const view={lines:[],groups:[],units:2,issues:0,items_usd:50};
const decimal=n=>({times:x=>decimal(n*x),plus:x=>decimal(n+x),toNumber:()=>n});
const source=fs.readFileSync(process.env.CART_SOURCE || root+'/apps/storefront/src/app/carrito/page.tsx','utf8');
const ports=Object.fromEntries([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>[m[1],{}]));
Object.assign(ports,{'react/jsx-runtime':req('react/jsx-runtime'),react:{useState:()=>[false,()=>{}],useRef:value=>({current:value})},'next/link':{default:()=>null},'@tanstack/react-query':{useQueryClient:()=>qc,useIsMutating:options=>{checkSelector(options);return pending;},useQuery:()=>current,useMutation:options=>{mutationOptions=options;return {isPending:linePending,isPaused:linePaused,isError:false,mutate:(quantity,callbacks)=>{mutationCalls.push(quantity);settleLine=callbacks.onSettled;}};}},'@kora/core':{D:decimal,productConditionLabel:()=>null},'@/lib/guest-hooks':{useGuestCartState:()=>guest},'@/lib/guest-cart-view':{guestCartView:()=>view},'@/lib/auth-return':{authHref:(path,back)=>path+'?volver='+encodeURIComponent(back)},'@/lib/format':{money:n=>'$'+n},'@/lib/guest-errors':{guestError:e=>e}});
function real(relative, bindings = ports) {
  const out = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/' + relative, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: out, URL, URLSearchParams,
    require: name => {
      if (name in bindings) return bindings[name];
      const dependency = path.resolve(path.dirname(root + '/' + relative), name) + '.ts';
      if (name.startsWith('.') && fs.existsSync(dependency)) return real(path.relative(root, dependency), {});
      return createRequire(root + '/' + relative)(name);
    },
  });
  return out;
}
Object.assign(ports['@kora/core'], real('packages/core/src/commerce-presentation.ts', {}), real('packages/core/src/eta.ts', {}), real('packages/core/src/payment-presentation.ts', {}));
ports['@/lib/purchase-context'] = real('apps/storefront/src/lib/purchase-context.ts');
const m={exports:{}};new vm.Script(ts.transpileModule(source+'\nexport {GuestCart,Line};',{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText).runInNewContext({exports:m.exports,URL,URLSearchParams,require:n=>{if(n in ports)return ports[n];throw Error(n)}});
const {GuestCart,Line}=m.exports;
function find(node,predicate){if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return find(node.props?.children,predicate);}
function state(extra={}){pending=0;live=0;linePending=false;linePaused=false;mutationCalls=[];settleLine=undefined;current={data:{},fetchStatus:'idle',isPending:false,isError:false,isFetching:false,...extra};}
function checkout(tree){return find(tree,n=>n.props?.['data-testid']==='cart-checkout');}
function prevented(link){let result=false;link.props.onClick({preventDefault(){result=true;}});return result;}
test('ready guest can continue using existing safe checkout return',()=>{state();const link=checkout(GuestCart());assert.equal(link.props['aria-disabled'],false);assert.equal(link.props.href,'/cuenta?volver=%2Fcheckout');assert.equal(prevented(link),false);});
test('pending write disables continuation and announces saving',()=>{state();pending=1;live=1;const tree=GuestCart();assert.equal(checkout(tree).type,'button');assert.equal(checkout(tree).props.disabled,true);assert.equal(checkout(tree).props.href,undefined);assert.equal(find(tree,n=>n.props?.children==='Guardando cambios del carrito…').props.children,'Guardando cambios del carrito…');});
test('click checks live mutation count before rerender',()=>{state();const link=checkout(GuestCart());live=1;assert.equal(prevented(link),true);});
test('multiple writes remain blocked until the final write settles',()=>{state();const link=checkout(GuestCart());live=2;assert.equal(prevented(link),true);live=1;assert.equal(prevented(link),true);live=0;assert.equal(prevented(link),false);});
for(const [label,flags] of [['offline',{fetchStatus:'paused'}],['read error',{isError:true}],['refreshing',{isFetching:true}]])test(`${label} retains previous guard`,()=>{state(flags);const link=checkout(GuestCart());assert.equal(link.type,'button');assert.equal(link.props.disabled,true);assert.equal(link.props.href,undefined);});
test('settled mutation clears visible saving state',()=>{state();pending=1;GuestCart();pending=0;const tree=GuestCart();assert.equal(checkout(tree).props['aria-disabled'],false);assert.equal(find(tree,n=>n.props?.role==='status'),null);});
test('guest line writes use explicit guest key and preserve local mutation',async()=>{state();const received=[];Line({line:{product_id:'p',variant_id:'v',quantity:2,max_quantity:5},guestQuantity:async q=>{received.push(q);}});assert.deepEqual(Array.from(mutationOptions.mutationKey),['cart-write','guest']);assert.equal(mutationOptions.networkMode,'always');await mutationOptions.mutationFn(3);await mutationOptions.mutationFn(0);assert.deepEqual(received,[3,0]);});
test('buyer mutation identity and network behavior remain unchanged',()=>{state();Line({line:{product_id:'p',variant_id:'v',quantity:2,max_quantity:5},buyerId:'buyer-123'});assert.deepEqual(Array.from(mutationOptions.mutationKey),['cart-write','buyer-123']);assert.equal(mutationOptions.networkMode,'online');});

for (const handler of ['onClick','onAuxClick','onContextMenu']) test('live guard covers '+handler+' before rerender',()=>{state();const link=checkout(GuestCart());live=1;let blocked=false;link.props[handler]({preventDefault(){blocked=true;}});assert.equal(blocked,true);});
test('blocked guest CTA is native disabled button with no navigation target',()=>{state();pending=1;const c=checkout(GuestCart());assert.equal(c.type,'button');assert.equal(c.props.type,'button');assert.equal(c.props.disabled,true);assert.equal(c.props['aria-disabled'],'true');assert.equal(c.props.href,undefined);assert.equal(c.props.onClick,undefined);});

// The buyer line uses server amounts verbatim, never recomputes quantity × unit.
for (const guestMode of [false,true]) test(`${guestMode?'guest':'buyer'} multi-unit line explicitly names subtotal and retains unit price`,()=>{
  state();const line={product_id:'p',variant_id:'v',title:'Producto',quantity:3,max_quantity:5,unit_price_usd:12.5,line_total_usd:37.49};
  const tree=Line({line,...(guestMode?{guestQuantity:async()=>{}}:{buyerId:'buyer-123'})});
  const label=find(tree,n=>n.props?.className==='cart-line-price-label');
  assert.equal(label.props.children,'Subtotal');
  assert.equal(find(tree,n=>n.props?.className==='cart-line-total').props.children,'$37.49');
  assert.deepEqual(Array.from(find(tree,n=>n.props?.className==='muted').props.children),['$12.5',' por unidad']);
});
test('single unit stays compact without duplicate labels',()=>{
  state();const tree=Line({line:{product_id:'p',variant_id:'v',quantity:1,max_quantity:5,unit_price_usd:12.5,line_total_usd:12.5}});
  assert.equal(find(tree,n=>n.props?.className==='cart-line-price-label'),null);
  assert.equal(find(tree,n=>n.props?.className==='muted'),null);
  assert.equal(find(tree,n=>n.props?.className==='cart-line-total').props.children,'$12.5');
});
test('unknown price never acquires a subtotal or a unit amount',()=>{
  state();const tree=Line({line:{product_id:'p',variant_id:'v',quantity:3,max_quantity:5,unit_price_usd:0,line_total_usd:0},priceKnown:false});
  assert.equal(find(tree,n=>n.props?.className==='cart-line-price-label'),null);
  assert.equal(find(tree,n=>n.props?.className==='muted'),null);
  assert.equal(find(tree,n=>n.props?.className==='cart-line-total').props.children,'Precio no disponible');
});

const shellSource=fs.readFileSync(root+'/apps/storefront/src/components/shell.tsx','utf8');
let shellSession=null,shellGroups=[];
const shellPorts=Object.fromEntries([...shellSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>[m[1],{}]));
Object.assign(shellPorts,{
  'react/jsx-runtime':req('react/jsx-runtime'),react:{useRef:value=>({current:value}),useEffect:()=>{}},
  'next/navigation':{usePathname:()=>'/carrito'},
  '@tanstack/react-query':{useQuery:()=>({data:{groups:shellGroups}})},
  '@/lib/providers':{useAccount:()=>({session:shellSession,ready:true,cartSyncing:false})},
  '@/lib/guest-hooks':{useGuestCartState:()=>({ready:true,error:null,data:shellGroups.flatMap(g=>g.lines)})},
  '@/lib/format':{brand:{name:'mayami'}},
});
const shellModule={exports:{}};
new vm.Script(ts.transpileModule(shellSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText).runInNewContext({exports:shellModule.exports,require:n=>{if(n in shellPorts)return shellPorts[n];throw Error(n);}});
for(const actor of ['guest','buyer']) for(const separate of [false,true]) test(`${actor} badge counts units rather than references or stores (${separate?'two stores':'same store'})`,()=>{
  shellSession=actor==='buyer'?{user:{id:'buyer-local'}}:null;
  const lines=[{quantity:2},{quantity:3}];
  shellGroups=separate?[{lines:[lines[0]]},{lines:[lines[1]]}]:[{lines}];
  const tree=shellModule.exports.Shell({children:null});
  const header=find(tree,n=>n.props?.className==='header-cart');
  assert.equal(header.props['aria-label'],'Carrito, 5 unidades');
  assert.equal(find(header,n=>n.props?.className==='count').props.children,5);
  const mobile=find(tree,n=>n.props?.cartUnits!==undefined);
  assert.equal(mobile.props.cartUnits,5);assert.equal(mobile.props.cartKnown,true);
});
test('badge uses singular unit and keeps the same count for mobile navigation',()=>{
  shellSession=null;shellGroups=[{lines:[{quantity:1}]}];
  const tree=shellModule.exports.Shell({children:null});
  assert.equal(find(tree,n=>n.props?.className==='header-cart').props['aria-label'],'Carrito, 1 unidad');
  assert.equal(find(tree,n=>n.props?.cartUnits!==undefined).props.cartUnits,1);
});


test('a line coalesces repeated quantity changes before the pending render', () => {
  state();
  const tree = Line({ line: { product_id:'p', variant_id:'v', title:'Producto', quantity:2, max_quantity:5, unit_price_usd:12.5, line_total_usd:25 }, guestQuantity:async()=>{} });
  const control = find(tree, node => node.props?.maximum === 5 && typeof node.props?.onChange === 'function');
  control.props.onChange(3);
  control.props.onChange(3);
  assert.deepEqual(mutationCalls, [3]);
  settleLine();
  control.props.onChange(3);
  assert.deepEqual(mutationCalls, [3, 3]);
});
for (const paused of [false, true]) test('pending line announces its state while preserving confirmed amounts: ' + paused, () => {
  state(); linePending = true; linePaused = paused;
  const tree = Line({ line: { product_id:'p', variant_id:'v', title:'Producto', quantity:2, max_quantity:5, unit_price_usd:12.5, line_total_usd:25 }, guestQuantity:async()=>{} });
  const status = find(tree, node => node.props?.role === 'status');
  assert(status);
  assert.equal(status.props.children[1], paused ? 'Esperando conexión para actualizar este producto…' : 'Actualizando este producto…');
  assert.equal(find(tree, node => node.props?.className === 'cart-line-total').props.children, '$25');
  const control = find(tree, node => node.props?.maximum === 5 && typeof node.props?.onChange === 'function');
  assert.equal(control.props.pending, true);
  assert.equal(control.props.quantity, 2);
});
