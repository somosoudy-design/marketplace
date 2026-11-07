import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../../apps/storefront/package.json',import.meta.url));
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const policy=JSON.parse(readFileSync(new URL('../../apps/storefront/src/data/policies.json',import.meta.url)));
const before=JSON.parse(execFileSync('git',['show','881765ffc6f2dac1f3e98c3171b2284840671f28:apps/storefront/src/data/policies.json'],{encoding:'utf8'}));
const source=readFileSync(new URL('../../apps/storefront/src/components/information-page.tsx',import.meta.url),'utf8');
const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:id=>id==='@/data/policies.json'?policy:require(id)});
test('only privacy and deletion wording changes; existing links and unrelated legal pages stay intact',()=>{
 assert.equal(policy.updatedAt,before.updatedAt);
 assert.deepEqual(policy.pages.map(x=>x.slug),before.pages.map(x=>x.slug));
 for(const page of policy.pages){const old=before.pages.find(x=>x.slug===page.slug);if(!['privacidad','eliminar-cuenta'].includes(page.slug))assert.deepEqual(page,old);
  assert.deepEqual(page.sections.flatMap(s=>s.links??[]),old.sections.flatMap(s=>s.links??[]));}
});
for(const slug of ['privacidad','eliminar-cuenta'])test(slug+' renders server-side with scoped periods and explicit external uncertainty',()=>{
 const html=renderToStaticMarkup(React.createElement(exports.InformationPage,{slug}));
 assert.match(html,/<h1>/);assert.match(html,/90 días desde (cada |el )evento/);assert.match(html,/90 días desde el cierre verificado/);
 assert.match(html,/cuenta comprendidos en el cierre/);assert.match(html,/marcador seudónimo mínimo/);assert.match(html,/No hemos verificado un plazo/);assert.match(html,/soporte@mayami.app/);
 assert.doesNotMatch(html,/anonimización|30 días|borrado total acreditado|se reduce la dirección/);
});
test('request acknowledgment makes neither immediate deletion nor continuous access promises',()=>{
 const text=readFileSync(new URL('../../apps/mobile/src/app/settings.tsx',import.meta.url),'utf8');assert.match(text,/Enviarla no elimina los datos de inmediato/);assert.doesNotMatch(text,/tu cuenta sigue funcionando mientras se tramita/);
});
