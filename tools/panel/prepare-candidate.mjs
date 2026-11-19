#!/usr/bin/env node
// Offline-only preparation. Never calls EAS, a provider API, git push or a deployment workflow.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectRequestRef, REQUEST_PATH } from './release-request.mjs';
import { readMarker } from './release-marker.mjs';
import { headerFailures, PAGES } from './check-deploy.mjs';

export const BASE = '881765ffc6f2dac1f3e98c3171b2284840671f28';
const ORIGINS = ['https://github.com/somosoudy-design/marketplace.git', 'git@github.com:somosoudy-design/marketplace.git'];
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding:'utf8' }).trim();
export const hash = value => createHash('sha256').update(value).digest('hex');
export function validateSource({ origin, head, source, dirty, merges, paths }) {
  if (!ORIGINS.includes(origin)) throw new Error('Repositorio no autorizado.');
  if (!/^[a-f0-9]{40}$/.test(source) || head !== source) throw new Error('El checkout no coincide con el SHA solicitado.');
  if (dirty) throw new Error('La fuente necesita un checkout limpio.');
  if (merges) throw new Error('La fuente aislada no admite merges del HEAD compartido.');
  const allowed = p => p.startsWith('docs/') || [
    'apps/storefront/src/data/policies.json','apps/mobile/src/app/settings.tsx',
    'tools/panel/release-request.mjs','tools/panel/prepare-candidate.mjs','tools/panel/candidate.test.mjs',
    'tools/storefront/privacy-copy.test.mjs',
  ].includes(p);
  if (paths.some(p => !allowed(p))) throw new Error('Cambios fuera de la preparación aprobada; backend, Google y cuotas deben conservarse.');
}
export function inventory(root) {
  const result=[];
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path=join(dir,name), stat=lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('El export no admite symlinks.');
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) result.push({path:relative(root,path).split('\\').join('/'),bytes:stat.size,sha256:hash(readFileSync(path))});
      else throw new Error('El export contiene un archivo no regular.');
    }
  }
  walk(root); return result;
}
export function archive(root, destination) {
  inventory(root); // reject links before the standard-library archiver reads any bytes
  const script=`import sys,os,tarfile,gzip,pathlib
root=pathlib.Path(sys.argv[1])
with open(sys.argv[2],'xb') as raw:
 with gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as gz:
  with tarfile.open(fileobj=gz,mode='w',format=tarfile.PAX_FORMAT) as tar:
   for p in sorted(root.rglob('*')):
    if p.is_symlink():raise RuntimeError('symlink')
    if p.is_file():
     info=tarfile.TarInfo('export/'+p.relative_to(root).as_posix());info.size=p.stat().st_size;info.mode=0o644;info.mtime=0;info.uid=0;info.gid=0;info.uname='';info.gname=''
     with p.open('rb') as f:tar.addfile(info,f)
`;
  execFileSync('python3',['-c',script,root,destination],{stdio:'pipe'});
}
export function verifyExport(out, source, buildVersion) {
  const marker=readMarker(join(out,'release.json'));
  if (marker.sourceSha!==source || marker.buildVersion!==buildVersion) throw new Error('Marcador de export incorrecto.');
  const routes=JSON.parse(readFileSync(join(out,'_expo/.routes.json'),'utf8'));
  if (headerFailures(new Headers(routes.headers)).length || !Array.isArray(routes.redirects) || routes.redirects.length) throw new Error('Rutas o cabeceras incorrectas.');
  for (const page of PAGES) if (!existsSync(join(out,page==='/'?'index.html':page.slice(1).split('?')[0]+'.html'))) throw new Error('Falta ruta '+page);
  return {marker,routes};
}
export function snapshotSource(cwd, source, destination) {
  mkdirSync(destination);
  const tar=destination+'.tar';
  execFileSync('git',['archive','--format=tar','-o',tar,source],{cwd,stdio:'pipe'});
  execFileSync('tar',['-xf',tar,'-C',destination],{stdio:'pipe'});
  for(const name of ['.env','.env.local','.env.production','.env.production.local'])
    if(existsSync(join(destination,'apps/admin',name))) throw new Error('El snapshot contiene un .env de build no permitido.');
}
export function verifySnapshot(cwd, source, snapshot) {
  const entries=execFileSync('git',['ls-tree','-r','-z',source],{cwd,encoding:'utf8'}).split('\0').filter(Boolean);
  const tracked=new Set();
  for(const entry of entries){
    const [meta,path]=entry.split('\t');tracked.add(path);
    const [mode,,sha]=meta.split(' '),file=join(snapshot,path);
    if(mode==='120000') throw new Error('El snapshot fuente no admite symlinks.');
    const bytes=readFileSync(file);
    const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    if(actual!==sha)throw new Error('Un input del snapshot cambió: '+path);
  }
  for(const folder of ['apps/admin/src','packages/api/src','packages/core/src','packages/design-tokens/src']){
    const dir=join(snapshot,folder);if(!existsSync(dir))continue;
    for(const file of inventory(dir))if(!tracked.has(folder+'/'+file.path))throw new Error('Input no versionado en snapshot.');
  }
}

export function prepareCandidate(requestSha, destination, cwd=process.cwd()) {
  cwd=realpathSync(cwd);
  const request=inspectRequestRef(requestSha,cwd), source=request.sourceSha;
  git(cwd,'merge-base','--is-ancestor',BASE,source);
  validateSource({origin:git(cwd,'remote','get-url','origin'),head:git(cwd,'rev-parse','HEAD'),source,
    dirty:git(cwd,'status','--porcelain','--untracked-files=all'),merges:git(cwd,'rev-list','--merges',BASE+'..'+source),paths:git(cwd,'diff','--name-only',BASE,source).split('\n').filter(Boolean)});
  destination=resolve(destination);
  const local=join(cwd,'.local');mkdirSync(local,{recursive:true});
  if (!destination.startsWith(local+'/') || existsSync(destination) || relative(realpathSync(local),realpathSync(dirname(destination))).split('/').includes('..') || realpathSync(local)!==local) throw new Error('Usa una carpeta nueva bajo .local, sin symlinks externos.');
  const publicEnv=JSON.parse(readFileSync(join(cwd,'apps/mobile/eas.json'),'utf8')).build.preview.env;
  const url=publicEnv.EXPO_PUBLIC_SUPABASE_URL, key=publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const claims=JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString('utf8'));
  if (url!=='https://mimnotafmfasvwrclxan.supabase.co' || claims.role!=='anon' || claims.ref!=='mimnotafmfasvwrclxan') throw new Error('Configuración pública de Marketplace inválida.');
  mkdirSync(destination);
  const snapshot=join(destination,'snapshot');snapshotSource(cwd,source,snapshot);verifySnapshot(cwd,source,snapshot);
  const buildVersion='candidate.'+source.slice(0,12), out=join(snapshot,'apps/admin/out');
  const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','PNPM_HOME','COREPACK_HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  Object.assign(env,{CI:'1',COREPACK_ENABLE_NETWORK:'0',NEXT_TELEMETRY_DISABLED:'1',KORA_PANEL_EXPORT:'1',PANEL_SOURCE_SHA:source,PANEL_BUILD_VERSION:buildVersion,
    NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:key,NEXT_PUBLIC_PANEL_API:url+'/functions/v1/panel-api',NEXT_PUBLIC_STORE_URL:'https://mayami.app'});
  const commands=[['pnpm',['--filter','@kora/admin...','install','--offline','--frozen-lockfile','--ignore-scripts']],['pnpm',['--filter','@kora/admin','build']],['node',['tools/panel/eas-routes.mjs',out]],['node',['tools/panel/release-marker.mjs',out,source,buildVersion]],['node',['tools/panel/check-export.mjs',out]]];
  const logs=[];
  for (const [exe,args] of commands) {
    const r=spawnSync(exe,args,{cwd:snapshot,env,encoding:'utf8',maxBuffer:20*1024*1024});logs.push(r.stdout??'',r.stderr??'');writeFileSync(join(destination,'build.log'),logs.join(''));
    if (r.status!==0 || r.error) throw new Error('Falló la preparación local; revisa build.log.');
  }
  if (git(cwd,'status','--porcelain','--untracked-files=all') || git(cwd,'rev-parse','HEAD')!==source) throw new Error('La fuente cambió durante la compilación.');
  verifySnapshot(cwd,source,snapshot);
  verifyExport(out,source,buildVersion);
  const target=join(destination,'export');renameSync(out,target);
  const files=inventory(target), artifact=join(destination,'panel.tar.gz');archive(target,artifact);
  const commit=execFileSync('git',['cat-file','commit',requestSha],{cwd,encoding:'utf8'});
  writeFileSync(join(destination,'request-proof.txt'),commit+'\n\n'+git(cwd,'show',requestSha+':'+REQUEST_PATH)+'\n');
  const receipt={schemaVersion:1,candidateOnly:true,repository:'somosoudy-design/marketplace',sourceSha:source,sourceTree:git(cwd,'rev-parse',source+'^{tree}'),requestSha,requestOnlyValidated:true,
    backendSourceSha:BASE,buildVersion,node:process.version,lockSha256:hash(readFileSync(join(cwd,'pnpm-lock.yaml'))),publicConfigSha256:hash(JSON.stringify({url,key,panelApi:env.NEXT_PUBLIC_PANEL_API,store:env.NEXT_PUBLIC_STORE_URL})),
    requestProofSha256:hash(readFileSync(join(destination,'request-proof.txt'))),buildLogSha256:hash(readFileSync(join(destination,'build.log'))),archiveSha256:hash(readFileSync(artifact)),files,publication:false,
    activationRequired:['backend881 verified','retention executor observed','privacy text coordinated','Free hosting account confirmed','explicit deployment authorization']};
  writeFileSync(join(destination,'manifest.json'),JSON.stringify(receipt,null,2)+'\n');
  return {sourceSha:source,requestSha,buildVersion,files:files.length,archiveSha256:receipt.archiveSha256,manifestSha256:hash(readFileSync(join(destination,'manifest.json'))),destination};
}
export function verifyCandidate(destination, expectedManifestHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedManifestHash??'')) throw new Error('Indica el hash de manifiesto aprobado por separado.');
  const bytes=readFileSync(join(destination,'manifest.json'));
  if (hash(bytes)!==expectedManifestHash) throw new Error('El manifiesto cambió.');
  const m=JSON.parse(bytes);
  verifyExport(join(destination,'export'),m.sourceSha,m.buildVersion);
  if (JSON.stringify(inventory(join(destination,'export')))!==JSON.stringify(m.files)
    || hash(readFileSync(join(destination,'panel.tar.gz')))!==m.archiveSha256
    || hash(readFileSync(join(destination,'build.log')))!==m.buildLogSha256
    || hash(readFileSync(join(destination,'request-proof.txt')))!==m.requestProofSha256) throw new Error('El paquete cambió después de verificarse.');
  return {sourceSha:m.sourceSha,files:m.files.length,archiveSha256:m.archiveSha256};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {if(process.argv[2]==='--verify'&&process.argv.length===5){console.log(JSON.stringify(verifyCandidate(resolve(process.argv[3]),process.argv[4])));process.exit(0);}if(process.argv.length!==4)throw new Error('Uso: prepare-candidate.mjs <requestSHA40> <carpeta .local nueva>');console.log(JSON.stringify(prepareCandidate(process.argv[2],process.argv[3])));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
