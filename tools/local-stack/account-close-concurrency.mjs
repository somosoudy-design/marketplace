// Isolated local concurrency acceptance. Uses no Auth/Storage API or Auth/vendor DML.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=dirname(resolve(process.argv[2]??'.local/account-close-input.json'));
if(!process.argv[2])throw Error('Pass an input file containing the active local fixture IDs.');
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
if(input.localOnly!==true||input.database!=='mayami_account_close_20261107'||!['buyerId','adminId','requestId'].every(k=>uuid.test(input[k]??''))||input.buyerId===input.adminId)throw Error('Use the exact local clone and distinct fixture IDs.');
const source=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(resolve(source,'tests/app-e2e/package.json'));const{Client}=require('pg');
const clients=[0,1,2].map(()=>new Client({host:'127.0.0.1',port:55437,user:'postgres',database:input.database}));
const[a,b,observer]=clients;const connected=new Set();const report={test:'shared actor gate precedes approval request row lock',executed:true,passed:false,transactionsRolledBack:false,authVendorDml:false,realJwtVerification:false};
const act=async(client,id)=>{await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'authenticated',sub:id})]);await client.query('set local role authenticated');};
const snapshot=async()=> (await observer.query("select md5(to_jsonb(d)::text) as request_hash,(select md5(to_jsonb(p)::text) from public.profiles p where id=$2) as profile_hash,(select md5(to_jsonb(u)::text) from auth.users u where id=$2) as auth_hash from public.account_deletion_requests d where d.id=$1",[input.requestId,input.buyerId])).rows[0];
try{
 await Promise.all(clients.map(client=>client.connect().then(()=>connected.add(client))));
 await observer.query('begin');
 const target=(await observer.query('select current_database() as db,host(inet_server_addr()) as host,inet_server_port() as port')).rows[0];assert.deepEqual(target,{db:input.database,host:'127.0.0.1',port:55437});
 const valid=(await observer.query("select exists(select 1 from public.account_deletion_requests where id=$1 and user_id=$2 and status in('requested','in_review')) as request_ok,not exists(select 1 from account_private.close_jobs where user_id=$2) as no_job,account_private.blockers($2)='{}'::jsonb as simple_buyer,exists(select 1 from auth.users where id=$2 and email like '%@example.com' and deleted_at is null and (banned_until is null or banned_until<=now())) as active_buyer,exists(select 1 from public.user_roles where user_id=$3 and role in('admin','superadmin')) as admin_ok",[input.requestId,input.buyerId,input.adminId])).rows[0];assert(Object.values(valid).every(v=>v===true),'Fixture must be an active simple local buyer with a requested row and active operator.');
 const before=await snapshot();assert(before,'Prepared request missing');
 await a.query('begin');await a.query("set local statement_timeout='8s'");await act(a,input.buyerId);
 await a.query('select public.account_request_guard()'); // shared account-close gate is held until ROLLBACK.
 await b.query('begin');await b.query("set local statement_timeout='8s'");await act(b,input.adminId);
 const aPid=(await a.query('select pg_backend_pid() as pid')).rows[0].pid;
 const bPid=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
 let settled=false,error=null;
 const approval=b.query('select public.process_account_deletion($1,true,$2)',[input.requestId,'Local concurrency rollback probe']).then(r=>{settled=true;return r;},e=>{settled=true;error=e;return null;});
 let blocked=false;
 for(let i=0;i<25;i++){
  const owners=(await observer.query('select pg_blocking_pids($1) as pids',[bPid])).rows[0].pids;
  if(owners.includes(aPid)){blocked=true;break;}
  if(settled)break;
  await new Promise(done=>setTimeout(done,40));
 }
 assert(blocked,'Approval did not wait for the buyer shared gate');assert.equal(settled,false,'Approval ended while a buyer request was still active');
 // Proves approval is waiting BEFORE locking the request row (old order raises 55P03 here).
 const row=await observer.query('select id from public.account_deletion_requests where id=$1 for update nowait',[input.requestId]);assert.equal(row.rowCount,1);
 await observer.query('rollback');
 await a.query('rollback');
 await approval;if(error)throw error;
 await b.query('reset role');
 const job=(await b.query('select state,phase,user_id from account_private.close_jobs where request_id=$1',[input.requestId])).rows[0];assert.equal(job?.state,'closing');assert.equal(job?.phase,'queued');assert.equal(job?.user_id,input.buyerId);
 await b.query('rollback');
 await observer.query('begin read only');assert.deepEqual(await snapshot(),before,'Fixture rows changed after rollback');
 assert.equal((await observer.query('select count(*)::int as n from account_private.close_jobs where request_id=$1',[input.requestId])).rows[0].n,0);
 await observer.query('rollback');
 report.passed=true;report.transactionsRolledBack=true;
}catch(error){report.error={name:error.name,code:error.code??null,hint:error.hint??null,message:error.message};process.exitCode=1;}
finally{for(const client of clients){if(connected.has(client))await client.query('rollback').catch(()=>{});await client.end().catch(()=>{});}writeFileSync(resolve(directory,'concurrency-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
