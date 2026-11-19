import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectRequest,inspectRequestRef,REQUEST_PATH } from './release-request.mjs';
import { validateSource,inventory,archive,hash,verifyExport,verifyCandidate,snapshotSource,verifySnapshot } from './prepare-candidate.mjs';
import { PAGES } from './check-deploy.mjs';
const S='a'.repeat(40),origin='https://github.com/somosoudy-design/marketplace.git';
const valid={origin,head:S,source:S,dirty:'',merges:'',paths:['apps/storefront/src/data/policies.json']};
test('isolated source rejects wrong SHA, dirty checkout, foreign repositories, merges and excluded work',()=>{
 validateSource(valid);
 for(const patch of [{origin:'https://github.com/other/repo.git'},{head:'b'.repeat(40)},{dirty:' M apps/admin/page.tsx'},{merges:'c'.repeat(40)},...['.github/panel-deploy-request','packages/core/src/installments.ts','supabase/migrations/change.sql','apps/mobile/src/lib/google.ts'].map(path=>({paths:[path]}))])assert.throws(()=>validateSource({...valid,...patch}));
});
test('explicit local request selects its actual parent without moving HEAD; invalid requests still fail',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mayami-request-'));const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:'pipe'}).trim();
 const commit=()=>{git('add','.');git('-c','user.name=Local test','-c','user.email=test@example.com','commit','-qm','fixture');return git('rev-parse','HEAD');};
 try{
  git('init','-q');mkdirSync(join(dir,'.github'));writeFileSync(join(dir,'source'),'reviewed');const source=commit();
  writeFileSync(join(dir,REQUEST_PATH),'source: '+source+'\n');const request=commit();
  assert.equal(inspectRequestRef(request,dir).sourceSha,source);
  writeFileSync(join(dir,'source'),'unreviewed');const head=commit();
  assert.equal(inspectRequestRef(request,dir).sourceSha,source);assert.equal(git('rev-parse','HEAD'),head);assert.throws(()=>inspectRequest(dir));
  for(const value of ['HEAD',request.slice(0,8),'https://github.com/evil/repo','; deploy'])assert.throws(()=>inspectRequestRef(value,dir));
  assert.throws(()=>inspectRequestRef(git('rev-parse','HEAD^{tree}'),dir));
  assert.throws(()=>inspectRequestRef(head,dir));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('packaging is deterministic for the same export despite filesystem timestamps, and refuses symlinks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mayami-archive-')),out=join(dir,'export');mkdirSync(out);
 try{writeFileSync(join(out,'x.txt'),'same');archive(out,join(dir,'a.tgz'));utimesSync(join(out,'x.txt'),new Date(0),new Date(1000));archive(out,join(dir,'b.tgz'));assert.equal(hash(readFileSync(join(dir,'a.tgz'))),hash(readFileSync(join(dir,'b.tgz'))));symlinkSync('/etc/passwd',join(out,'outside'));assert.throws(()=>inventory(out),/symlinks/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('frozen manifest detects swapped source, altered export and modified archive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mayami-package-')),out=join(dir,'export');mkdirSync(join(out,'_expo'),{recursive:true});
 try{
  for(const page of PAGES){const path=join(out,page==='/'?'index.html':page.slice(1).split('?')[0]+'.html');mkdirSync(join(path,'..'),{recursive:true});writeFileSync(path,'<html>local</html>');}
  const routes={headers:{'X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Robots-Tag':'noindex, nofollow'},redirects:[]};writeFileSync(join(out,'_expo/.routes.json'),JSON.stringify(routes));writeFileSync(join(out,'release.json'),JSON.stringify({schemaVersion:1,sourceSha:S,buildVersion:'candidate.test'}));
  verifyExport(out,S,'candidate.test');assert.throws(()=>verifyExport(out,'b'.repeat(40),'candidate.test'));
  archive(out,join(dir,'panel.tar.gz'));writeFileSync(join(dir,'build.log'),'built');writeFileSync(join(dir,'request-proof.txt'),'local request');
  const m={sourceSha:S,buildVersion:'candidate.test',files:inventory(out),archiveSha256:hash(readFileSync(join(dir,'panel.tar.gz'))),buildLogSha256:hash(readFileSync(join(dir,'build.log'))),requestProofSha256:hash(readFileSync(join(dir,'request-proof.txt')))};
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(m));const expected=hash(readFileSync(join(dir,'manifest.json')));verifyCandidate(dir,expected);
  writeFileSync(join(dir,'panel.tar.gz'),'tampered');assert.throws(()=>verifyCandidate(dir,expected),/paquete cambió/);writeFileSync(join(out,'login.html'),'changed');assert.throws(()=>verifyCandidate(dir,expected));assert.throws(()=>verifyCandidate(dir,'0'.repeat(64)),/manifiesto cambió/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('controlled snapshot excludes local ignored env and untracked pages, and detects injected build inputs',()=>{
 const root=mkdtempSync(join(tmpdir(),'mayami-snapshot-')),repo=join(root,'repo'),snap=join(root,'snapshot');mkdirSync(repo);
 const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:'pipe'}).trim();
 try{git('init','-q');mkdirSync(join(repo,'apps/admin/src/app'),{recursive:true});writeFileSync(join(repo,'.gitignore'),'.env.local\n');writeFileSync(join(repo,'apps/admin/src/app/page.tsx'),'tracked');git('add','.');git('-c','user.name=Local test','-c','user.email=test@example.com','commit','-qm','fixture');const source=git('rev-parse','HEAD');
  writeFileSync(join(repo,'apps/admin/.env.local'),'UNTRUSTED_LOCAL_INPUT=1');writeFileSync(join(repo,'apps/admin/src/app/extra.tsx'),'untracked');
  snapshotSource(repo,source,snap);assert.deepEqual(inventory(join(snap,'apps/admin/src')).map(x=>x.path),['app/page.tsx']);verifySnapshot(repo,source,snap);
  writeFileSync(join(snap,'apps/admin/src/app/extra.tsx'),'injected');assert.throws(()=>verifySnapshot(repo,source,snap),/no versionado/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
