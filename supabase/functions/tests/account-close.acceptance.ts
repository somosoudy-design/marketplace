// Acceptance runs only against the explicitly named isolated local clone. Never production.
// Uses real GoTrue password JWT + official Storage HTTP/bytes, never mock Auth/RPC.
// Scoped retention acceptance: private injected clock, no production or scheduler activation.
// Only the first worker Storage DELETE is fault-injected; all other transport is real.
import { createHandler } from '../account-close/handler.ts';

const PRIVATE = Deno.env.get('MAYAMI_ACCOUNT_CLOSE_TEST_CONFIG');
if (!PRIVATE) throw new Error('MAYAMI_ACCOUNT_CLOSE_TEST_CONFIG must point to the isolated local configuration');
const DIR = PRIVATE.slice(0, PRIVATE.lastIndexOf('/'));
const REPORT = Deno.env.get('MAYAMI_ACCOUNT_RETENTION_TEST_REPORT');
if (!REPORT || !REPORT.startsWith('/') || REPORT === DIR + '/real-worker-acceptance-results.json')
  throw new Error('MAYAMI_ACCOUNT_RETENTION_TEST_REPORT must be a new absolute receipt path');
const REPORT_DIR = REPORT.slice(0, REPORT.lastIndexOf('/'));
const EXPECTED_DATABASE = 'mayami_account_close_20261107';
const EXPECTED_ORIGIN = 'http://127.0.0.1:55455';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Config = { localOnly: boolean; database: string; baseUrl: string; anonKey: string; serviceKey: string };
type Actor = { id: string; email: string; password: string; access: string; refresh: string };
type Result = { status: number; data: any; bytes: Uint8Array };
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII='), c => c.charCodeAt(0));
async function sha(bytes: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))).map(x => x.toString(16).padStart(2, '0')).join('');
}
async function physicalCount(uid: string): Promise<number> {
  let count = 0;
  async function walk(dir: string) {
    for await (const e of Deno.readDir(dir)) {
      const path = dir + '/' + e.name;
      if (e.isDirectory) await walk(path);
      else if (e.isFile && path.includes(uid)) count++;
    }
  }
  await walk(DIR + '/storage-bytes'); return count;
}

Deno.test('LOCAL real worker: Storage retry, scoped audit retention, 90d receipt expiry and stale JWT deny', async () => {
  // Secrets are read once into memory. Never log config, actors, bodies, headers or tokens.
  let config: Config;
  try { config = JSON.parse(await Deno.readTextFile(PRIVATE)) as Config; }
  catch { throw new Error('Invalid isolated local runtime configuration'); }
  assert(config.localOnly && config.database === EXPECTED_DATABASE && config.baseUrl === EXPECTED_ORIGIN, 'Wrong isolated local target');
  assert(typeof config.anonKey === 'string' && typeof config.serviceKey === 'string', 'Missing local runtime credentials');
  try { await Deno.stat(REPORT); throw new Error('Receipt already exists: inspect/archive it before an intentional new run'); }
  catch (e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }

  const report: Record<string, any> = { at: new Date().toISOString(), database: EXPECTED_DATABASE,
    localOnly: true, status: 'RUNNING', lastStep: 'initial', fixtures: {}, receipts: [],
    credentialValuesPersisted: false, vendorAuditMutated: true, vendorAuditMutationScope: 'known local fixture shapes only' };
  const persist = async () => Deno.writeTextFile(REPORT, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  await persist();
  const originalFetch = globalThis.fetch;
  const nativeFetch = originalFetch.bind(globalThis);
  let softDeletes = 0, faultedStorageCalls = 0;
  const guarded: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert(url.origin === EXPECTED_ORIGIN, 'Nonlocal request refused');
    const response = await nativeFetch(input, { ...init, redirect: 'error', signal: init?.signal ?? AbortSignal.timeout(15_000) });
    report.receipts.push({ method: init?.method ?? (input instanceof Request ? input.method : 'GET'), path: url.pathname, status: response.status });
    return response;
  };
  globalThis.fetch = guarded; // Includes real rest.ts RPC transport, which uses global fetch.
  async function api(path: string, options: { token?: string; method?: string; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> } = {}): Promise<Result> {
    const url = new URL(path, EXPECTED_ORIGIN);
    assert(url.origin === EXPECTED_ORIGIN, 'Nonlocal API target refused');
    const token = options.token ?? config.serviceKey;
    const headers: Record<string, string> = { apikey: options.token ? config.anonKey : config.serviceKey, ...options.headers };
    if (token.split('.').length === 3) headers.authorization = 'Bearer ' + token;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await guarded(url, { method: options.method ?? 'GET', headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.bytes ? { body: new Uint8Array(options.bytes).buffer } : {}) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    let data: any = null; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* Storage bytes */ }
    return { status: response.status, data, bytes };
  }
  function ok(r: Result, label: string): any {
    assert(r.status >= 200 && r.status < 300, label + ' failed with HTTP ' + r.status);
    return r.data;
  }
  async function actor(label: string): Promise<Actor> {
    const email = 'local-closure-' + label + '-' + crypto.randomUUID() + '@example.com';
    const password = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x => x.toString(16).padStart(2, '0')).join('');
    const created = ok(await api('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true, user_metadata: { full_name: 'Local ' + label } } }), 'Create local fixture');
    assert(UUID.test(created.id), 'Invalid fixture UUID');
    const session = ok(await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }), 'Real password login');
    assert(typeof session.access_token === 'string' && typeof session.refresh_token === 'string', 'Missing real JWT session');
    const user = ok(await api('/auth/v1/user', { token: session.access_token }), 'Real getUser');
    assert(user.id === created.id, 'Real JWT belongs to wrong actor');
    return { id: user.id, email, password, access: session.access_token, refresh: session.refresh_token };
  }
  async function grantOwnAdmin(id: string) {
    assert(UUID.test(id), 'Invalid admin fixture UUID');
    // Fixture-only SQL, same guarded pattern as baseline-red.mjs. No schema/config/vendor changes.
    const sql = "begin;do $guard$ begin if current_database()<>'mayami_account_close_20261107' or host(inet_server_addr())<>'127.0.0.1' or inet_server_port()<>55437 then raise exception 'Wrong local clone';end if;end $guard$;insert into public.user_roles(user_id,role,granted_by) values('" + id + "','admin','" + id + "');commit;";
    const p = await new Deno.Command('/opt/homebrew/bin/psql', {
      args: ['-h','127.0.0.1','-p','55437','-U','postgres','-d',EXPECTED_DATABASE,'-w','-X','-At','-v','ON_ERROR_STOP=1','-c',sql],
      clearEnv: true, env: { PGPASSFILE: '/dev/null', PGSERVICEFILE: '/dev/null', PGPASSWORD: '' }, stdout: 'piped', stderr: 'piped',
    }).output();
    assert(p.success, 'Local fixture admin assignment failed'); // Never echo SQL/stdout/stderr.
  }
  async function localSql(body: string) {
    const sql = "begin;do $guard$ begin if current_database()<>'mayami_account_close_20261107' or host(inet_server_addr())<>'127.0.0.1' or inet_server_port()<>55437 then raise exception 'Wrong local clone';end if;end $guard$;" + body + ';commit;';
    const p = await new Deno.Command('/opt/homebrew/bin/psql', {
      args: ['-h','127.0.0.1','-p','55437','-U','postgres','-d',EXPECTED_DATABASE,'-w','-X','-qAt','-v','ON_ERROR_STOP=1','-c',sql],
      clearEnv: true, env: { PGPASSFILE: '/dev/null', PGSERVICEFILE: '/dev/null', PGPASSWORD: '' }, stdout: 'piped', stderr: 'piped',
    }).output();
    if (!p.success) {
      // Fixture SQL contains only generated local example.com subjects, never credentials.
      await Deno.writeTextFile(REPORT_DIR + '/retention-fixture-sql-error.private.log', new TextDecoder().decode(p.stderr), { mode: 0o600 });
      throw new Error('Isolated fixture data operation failed');
    }
    return new TextDecoder().decode(p.stdout).trim();
  }
  async function seedDaily(a: Actor) {
    assert(UUID.test(a.id), 'Invalid daily fixture actor');
    await localSql(`
      insert into public.addresses(user_id,label,recipient,phone,region_code,city,line1,country_code) values('${a.id}','Local','Local person','0000000000','A','Caracas','Local fixture','VE');
      insert into public.favorites(user_id,product_id) select '${a.id}',id from public.products limit 1;
      insert into public.cart_items(user_id,variant_id,quantity) select '${a.id}',id,1 from public.product_variants limit 1;
      insert into public.stock_alerts(user_id,product_id) select '${a.id}',id from public.products limit 1;
      insert into public.user_events(user_id,kind,query) values('${a.id}','search','Local personal query');
      insert into public.rec_events(user_id,slot,kind,product_id) select '${a.id}','home','impression',id from public.products limit 1;
      insert into public.push_tokens(token,user_id,platform) values('local-${a.id}','${a.id}','web');
      insert into public.notifications(user_id,kind,title,body,push_status,is_test) values('${a.id}','system','Local','Local personal notification','skipped',true);
      insert into checkout_private.cart_intent_journal(buyer_id,idempotency_key,operation,payload,result) values('${a.id}','local-cleanup','merge','{}','{}');
      insert into favorites_private.merge_journal(buyer_id,idempotency_key,product_ids,result) select '${a.id}','local-cleanup',array[id],'{}'::jsonb from public.products limit 1`);
  }
  async function dailyCounts(a: Actor) {
    assert(UUID.test(a.id), 'Invalid daily fixture actor');
    const tables = ['addresses','favorites','cart_items','stock_alerts','user_events','rec_events','push_tokens','notifications'];
    return JSON.parse(await localSql('select jsonb_build_object(' + tables.flatMap(t => ["'" + t + "'", `(select count(*) from public.${t} where user_id='${a.id}')`]).join(',') +
      `,'cart_journal',(select count(*) from checkout_private.cart_intent_journal where buyer_id='${a.id}'),'favorite_journal',(select count(*) from favorites_private.merge_journal where buyer_id='${a.id}'))`)) as Record<string, number>;
  }
  const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  async function retentionSnapshot(a: Actor, requestId: string) {
    assert(UUID.test(a.id) && UUID.test(requestId), 'Invalid retention fixture identity');
    return JSON.parse(await localSql(`select jsonb_build_object(
      'auditRows',(select count(*) from auth.audit_log_entries where account_private.audit_links(payload::jsonb,'${a.id}')),
      'managedRows',(select count(*) from account_private.managed_auth_audit where subject_hash=account_private.subject_key('${a.id}')),
      'jobs',(select count(*) from account_private.close_jobs where request_id='${requestId}'),
      'requests',(select count(*) from public.account_deletion_requests where id='${requestId}'),
      'markers',(select count(*) from account_private.closed_subjects where subject_hash=account_private.subject_key('${a.id}')),
      'holds',(select count(*) from account_private.retention_holds where subject_hash=account_private.subject_key('${a.id}'))) `));
  }
  async function sweepAt(when: string) {
    assert(Number.isFinite(Date.parse(when)), 'Invalid private injected clock');
    return JSON.parse(await localSql(`select account_private.retention_sweep(${q(when)}::timestamptz,1000)`));
  }
  async function controlFingerprint(a: Actor) {
    return await localSql(`select md5(jsonb_build_object(
      'auth',(select to_jsonb(u) from auth.users u where id='${a.id}'),
      'profile',(select to_jsonb(p) from public.profiles p where id='${a.id}'),
      'audit',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from auth.audit_log_entries x
        where account_private.audit_links(x.payload::jsonb,'${a.id}')))::text)`);
  }
  const env = (name: string) => name === 'SUPABASE_URL' ? config.baseUrl :
    name === 'SUPABASE_SERVICE_ROLE_KEY' ? config.serviceKey :
    name === 'SUPABASE_ANON_KEY' ? config.anonKey : undefined;
  function workerFetch(injectStorageFailure: boolean): typeof fetch {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert(url.origin === EXPECTED_ORIGIN, 'Nonlocal worker target refused');
      if (init?.method === 'DELETE' && url.pathname.startsWith('/auth/v1/admin/users/')) softDeletes++;
      if (injectStorageFailure && init?.method === 'DELETE' && url.pathname === '/storage/v1/object/avatars' && faultedStorageCalls === 0) {
        faultedStorageCalls++;
        return new Response(JSON.stringify({ error: 'injected_storage_failure' }), { status: 503, headers: { 'content-type': 'application/json' } });
      }
      return await guarded(input, init);
    };
  }
  async function invoke(handler: ReturnType<typeof createHandler>, requestId: string, token?: string) {
    const r = await handler(new Request(EXPECTED_ORIGIN + '/functions/v1/account-close', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ requestId, notes: 'Local fixture only' }),
    }));
    return { status: r.status, data: await r.json() };
  }
  async function requestState(id: string) {
    const rows = ok(await api('/rest/v1/account_deletion_requests?id=eq.' + id + '&select=status,cleanup_state'), 'Read local closure receipt');
    assert(Array.isArray(rows) && rows.length === 1, 'Missing local closure receipt');
    return rows[0];
  }
  async function denyOldContext(a: Actor, avatar: string) {
    const data = await api('/rest/v1/profiles?id=eq.' + a.id + '&select=id,full_name', { token: a.access });
    assert([401,403].includes(data.status) || data.status === 200 && Array.isArray(data.data) && data.data.length === 0, 'Old JWT still reads profile');
    const mutation = await api('/rest/v1/profiles?id=eq.' + a.id, { method: 'PATCH', token: a.access, body: { full_name: 'Forbidden old JWT write' }, headers: { Prefer: 'return=representation' } });
    const own = ok(await api('/rest/v1/profiles?id=eq.' + a.id + '&select=full_name'), 'Verify old JWT write outcome');
    assert(own.every((x: any) => x.full_name !== 'Forbidden old JWT write'), 'Old JWT write persisted');
    assert(mutation.status >= 400 || Array.isArray(mutation.data) && mutation.data.length === 0, 'Old JWT write was accepted');
    const rpc = await api('/rest/v1/rpc/cart_summary_reviewed', { method: 'POST', token: a.access, body: { p_address_id: null } });
    assert(rpc.status >= 400, 'Old JWT still calls private buyer RPC');
    const file = await api('/storage/v1/object/avatars/' + avatar, { token: a.access });
    const upload = await api('/storage/v1/object/avatars/' + a.id + '/after-closing.png', { method: 'POST', token: a.access, bytes: png, headers: { 'content-type': 'image/png' } });
    assert(file.status !== 200 && upload.status >= 400, 'Old JWT still reads/writes Storage');
    return { noData: true, noWrite: true, noFile: true, profileStatus: data.status, rpcStatus: rpc.status, downloadStatus: file.status, uploadStatus: upload.status };
  }

  try {
    report.lastStep = 'fixtures';
    const buyer = await actor('buyer'), admin = await actor('admin'), control = await actor('control');
    await grantOwnAdmin(admin.id);
    report.fixtures = { buyer: buyer.id, admin: admin.id, control: control.id }; await persist();
    await seedDaily(buyer); await seedDaily(control);
    const controlBefore = await dailyCounts(control);
    const controlIdentityBefore = await controlFingerprint(control);
    assert(Object.values(await dailyCounts(buyer)).every(n => n === 1), 'Daily fixture domains were not seeded');
    const paths: string[] = [];
    for (let i = 0; i < 4; i++) {
      const path = buyer.id + '/worker-fixture-' + i + '.png'; paths.push(path);
      ok(await api('/storage/v1/object/avatars/' + path, { method: 'POST', token: buyer.access, bytes: png, headers: { 'content-type': 'image/png' } }), 'Real Storage upload');
      const downloaded = await api('/storage/v1/object/avatars/' + path, { token: buyer.access });
      assert(downloaded.status === 200 && await sha(downloaded.bytes) === await sha(png), 'Uploaded bytes mismatch');
    }
    ok(await api('/rest/v1/profiles?id=eq.' + buyer.id, { method: 'PATCH', token: buyer.access,
      body: { full_name: 'Local personal fixture', phone: '0000000000', avatar_path: paths[0], preferences: { local: 'personal fixture' }, personalization_enabled: true, marketing_opt_in: true }, headers: { Prefer: 'return=representation' } }), 'Set local profile');
    assert((await physicalCount(buyer.id)) === 4, 'Real fixture bytes are missing');
    const requestId = ok(await api('/rest/v1/rpc/request_account_deletion', { method: 'POST', token: buyer.access, body: { p_reason: 'Local fixture acceptance only' } }), 'Request closure');
    assert(UUID.test(requestId), 'Invalid closure request UUID'); report.requestId = requestId; await persist();
    const repeated = ok(await api('/rest/v1/rpc/request_account_deletion', { method: 'POST', token: buyer.access, body: { p_reason: null } }), 'Repeat request');
    assert(repeated === requestId, 'Request replay created another request');
    const broken = createHandler({ env, fetch: workerFetch(true) });
    assert((await invoke(broken, requestId)).status === 401, 'Anonymous operator was accepted');
    assert((await invoke(broken, requestId, buyer.access)).status === 403, 'Buyer operator was accepted');
    const deniedJob = await api('/rest/v1/rpc/account_close_claim', { method: 'POST', token: buyer.access, body: { p_request_id: requestId } });
    assert(deniedJob.status >= 400, 'Buyer can claim a service job');
    assert((await api('/rest/v1/rpc/account_retention_run', { method: 'POST', token: buyer.access, body: { p_limit: 100 } })).status >= 400,
      'Buyer can execute retention sweeps');
    assert((await localSql("select has_function_privilege('authenticated','account_private.retention_sweep(timestamptz,integer)','EXECUTE') or has_function_privilege('service_role','account_private.retention_sweep(timestamptz,integer)','EXECUTE')")) === 'f',
      'API role can choose a future purge clock');

    report.lastStep = 'injected_storage_failure'; await persist();
    const first = await invoke(broken, requestId, admin.access);
    assert(first.status === 202 && first.data.state === 'failed' && first.data.code === 'storage_delete_failed', 'Storage fault did not pause worker safely');
    assert(faultedStorageCalls === 1 && softDeletes === 1, 'Auth-first/Storage fault ordering is wrong');
    const failed = await requestState(requestId);
    assert(failed.status === 'in_review' && failed.cleanup_state === 'failed', 'Failure reported completed or lost pending state');
    report.afterFailure = { state: first.data.state, cleanupState: failed.cleanup_state, softDeleteCalls: softDeletes,
      bytesStillPresent: await physicalCount(buyer.id), ...(await denyOldContext(buyer, paths[0]!)) };
    assert(report.afterFailure.bytesStillPresent === 4, 'Injected failure unexpectedly deleted real bytes');
    const oldAuth = await api('/auth/v1/user', { token: buyer.access }); assert(oldAuth.status >= 400, 'Old JWT still accepted by Auth after soft deletion');
    const tombstone = ok(await api('/auth/v1/admin/users/' + buyer.id), 'Read Auth tombstone');
    assert(tombstone.id === buyer.id && !!tombstone.deleted_at && tombstone.email !== buyer.email, 'Auth tombstone is not verified');
    const b = ok(await api('/rest/v1/profiles?id=eq.' + control.id + '&select=id', { token: control.access }), 'Control actor read');
    assert(b.length === 1 && b[0].id === control.id, 'Closure blocked unrelated active actor');

    const failedBeforeAge = await retentionSnapshot(buyer,requestId);
    await sweepAt(new Date(Date.now()+100*86400_000).toISOString());
    assert(JSON.stringify(await retentionSnapshot(buyer,requestId))===JSON.stringify(failedBeforeAge) && (await requestState(requestId)).cleanup_state==='failed',
      'Aged failed cleanup lost its retry state');
    report.failedAge = { receiptPreserved: true, retryPreserved: true };

    report.lastStep = 'seed_auth_role_audit_batch_and_specific_hold'; await persist();
    // No JWT claims: this models the actual Auth SQL writer, not an API service JWT.
    // The job is still failed/data_cleaned=false, so the trigger must not pre-minimize.
    const auditHoldId = crypto.randomUUID(), receiptHoldId = crypto.randomUUID(), caseId = crypto.randomUUID();
    const heldAuditId = await localSql(`select id from auth.audit_log_entries
      where payload->>'action'='user_deleted' and account_private.audit_subject(payload::jsonb)='${buyer.id}'
      order by created_at desc,id limit 1`);
    assert(UUID.test(heldAuditId), 'Real user_deleted audit fixture is missing or unsupported');
    const heldFingerprint = await localSql(`select encode(account_private.audit_fingerprint(payload::jsonb,created_at,ip_address),'hex')
      from auth.audit_log_entries where id='${heldAuditId}'`);
    await localSql(`
      do $claims$ begin perform set_config('request.jwt.claims','',true);end $claims$;
      set local role supabase_auth_admin;
      insert into auth.audit_log_entries(instance_id,id,payload,created_at,ip_address)
      select '00000000-0000-0000-0000-000000000000',gen_random_uuid(),
        jsonb_build_object('action','login','actor_id','${buyer.id}','actor_name','Local fixture',
          'actor_username',${q(buyer.email)},'log_type','account',
          'traits',jsonb_build_object('provider','email','user_id','${buyer.id}','user_email',${q(buyer.email)}))::json,
        clock_timestamp(),'127.0.0.1' from generate_series(1,501);
      reset role;
      insert into account_private.retention_holds(id,subject_hash,scope,audit_id,reason_code,case_id,until_at)
      values('${auditHoldId}',account_private.subject_key('${buyer.id}'),'auth_audit','${heldAuditId}',
        'security_incident','${caseId}',clock_timestamp()+interval '2400 hours')`);
    report.auditFixtures = { seeded: 501, authRoleWithoutJwt: true, specificHold: true,
      localAuthRoleSuperuser: (await localSql("select rolsuper from pg_roles where rolname='supabase_auth_admin'")) === 't',
      hostedAuthPermissionsProved: false };

    report.lastStep = 'resume_without_repeating_auth_delete'; await persist();
    const live = createHandler({ env, fetch: workerFetch(false) });
    const second = await invoke(live, requestId, admin.access);
    assert(second.status === 202 && second.data.state === 'retention_pending', 'Bounded 500-row batch did not pause on remaining audit rows');
    assert(softDeletes === 1, 'Successful Auth deletion was repeated instead of verified resume');
    const pending = await requestState(requestId);
    assert(pending.status === 'in_review' && pending.cleanup_state === 'retention_pending', 'Incomplete batch reported completed');
    const remaining = ok(await api('/storage/v1/object/list/avatars', { method: 'POST', body: { prefix: buyer.id, limit: 100, offset: 0 } }), 'List after real Storage cleanup');
    assert(remaining.length === 0 && await physicalCount(buyer.id) === 0, 'Storage metadata or physical bytes remain');
    for (const path of paths) {
      assert((await api('/storage/v1/object/avatars/' + path)).status !== 200, 'Service download still returns deleted bytes');
    }
    const clean = ok(await api('/rest/v1/profiles?id=eq.' + buyer.id + '&select=full_name,phone,avatar_path,preferences,personalization_enabled,marketing_opt_in'), 'Check daily profile cleanup');
    assert(clean.length === 0 || clean.length === 1 && clean[0].full_name === null && clean[0].phone === null && clean[0].avatar_path === null &&
      JSON.stringify(clean[0].preferences) === '{}' && !clean[0].personalization_enabled && !clean[0].marketing_opt_in, 'Daily profile cleanup did not complete');
    report.afterRetry = { state: second.data.state, cleanupState: pending.cleanup_state, bytesRemaining: 0, storageRowsRemaining: 0,
      softDeleteCalls: softDeletes, ...(await denyOldContext(buyer, paths[0]!)) };
    report.dailyDomains = await dailyCounts(buyer);
    assert(Object.values(report.dailyDomains).every(n => n === 0), 'A supported daily data domain remains');
    assert(JSON.stringify(await dailyCounts(control)) === JSON.stringify(controlBefore), 'Daily cleanup affected another actor');

    report.lastStep = 'audit_batch_resume_completes_with_specific_hold'; await persist();
    const third = await invoke(live, requestId, admin.access);
    assert(third.status === 200 && third.data.state === 'completed' && softDeletes === 1, 'Next audit batch did not complete without another Auth delete');
    const closed = await requestState(requestId);
    assert(closed.status === 'completed' && closed.cleanup_state === 'completed', 'Verified completion was not stored');
    const policy = JSON.parse(await localSql(`select jsonb_build_object(
      'ready',account_private.audit_ready('${buyer.id}',clock_timestamp()),
      'heldRows',(select count(*) from account_private.managed_auth_audit where subject_hash=account_private.subject_key('${buyer.id}') and disposition='held'),
      'unexpectedPersonalRows',(select count(*) from auth.audit_log_entries a
        where account_private.audit_links(a.payload::jsonb,'${buyer.id}') and a.id<>'${heldAuditId}'
          and (a.payload::jsonb<>account_private.audit_minimal(a.payload::jsonb,'${buyer.id}') or a.ip_address<>'')),
      'heldFingerprint',(select encode(account_private.audit_fingerprint(payload::jsonb,created_at,ip_address),'hex')
        from auth.audit_log_entries where id='${heldAuditId}'))`));
    assert(policy.ready && policy.heldRows === 1 && policy.unexpectedPersonalRows === 0 && policy.heldFingerprint === heldFingerprint,
      'Known unnecessary fields remain or the exact legitimate audit hold was changed');
    report.afterAuditBatches = { state: third.data.state, softDeleteCalls: softDeletes, ready: true, heldRows: 1, unexpectedPersonalRows: 0 };

    report.lastStep = 'future_auth_insert_without_claims'; await persist();
    const lateAuditId = crypto.randomUUID();
    await localSql(`do $claims$ begin perform set_config('request.jwt.claims','',true);end $claims$;
      set local role supabase_auth_admin;
      insert into auth.audit_log_entries(instance_id,id,payload,created_at,ip_address)
      values('00000000-0000-0000-0000-000000000000','${lateAuditId}',
        jsonb_build_object('action','logout','actor_id','${buyer.id}','actor_username',${q(buyer.email)},
          'log_type','account','traits',jsonb_build_object('provider','email','user_id','${buyer.id}','user_email',${q(buyer.email)}))::json,
        clock_timestamp(),'127.0.0.1'); reset role;
      do $verify$ begin
       if not exists(select 1 from account_private.managed_auth_audit m join auth.audit_log_entries a on a.id=m.audit_id
        where a.id='${lateAuditId}' and m.disposition='minimized' and a.ip_address=''
         and a.payload::jsonb=account_private.audit_minimal(a.payload::jsonb,'${buyer.id}')) then
        raise exception 'Late Auth writer bypassed minimization';end if;end $verify$`);
    report.futureAuthInsert = { actorRole: 'supabase_auth_admin', jwtClaims: false, minimized: true };

    // Time is data passed only to an owner-only helper; global clocks are untouched.
    const clocks = JSON.parse(await localSql(`select jsonb_build_object(
      'before90',(select min(a.created_at)+interval '2160 hours'-interval '1 microsecond'
        from auth.audit_log_entries a join account_private.managed_auth_audit m on m.audit_id=a.id
        where m.subject_hash=account_private.subject_key('${buyer.id}')),
      'at90',(select max(expires_at)+interval '1 microsecond' from account_private.managed_auth_audit
        where subject_hash=account_private.subject_key('${buyer.id}')),
      'auditUntil',(select until_at from account_private.retention_holds where id='${auditHoldId}'))`));
    for (const value of Object.values(clocks)) assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'Bad injected time fixture');
    const receiptUntil = new Date(Date.parse(clocks.auditUntil) + 10 * 86400_000).toISOString();
    const afterAllHolds = new Date(Date.parse(receiptUntil) + 1).toISOString();
    await localSql(`insert into account_private.retention_holds(id,subject_hash,scope,audit_id,reason_code,case_id,until_at)
      values('${receiptHoldId}',account_private.subject_key('${buyer.id}'),'receipt',null,'security_incident','${caseId}',${q(receiptUntil)}::timestamptz)`);

    report.lastStep = 'p1_registered_audit_subject_remap_rolls_back'; await persist();
    // Intentional transient adversarial fixture, entirely rolled back. The stale
    // managed row for A must stop receipt GC when its source row is remapped to B.
    await localSql(`savepoint remap;
      update auth.audit_log_entries set payload=jsonb_build_object('action','logout','actor_id','${control.id}',
        'log_type','account','traits',jsonb_build_object('provider','email','user_id','${control.id}'))::json where id='${lateAuditId}';
      do $p1$ declare r jsonb;begin
       if account_private.audit_ready('${buyer.id}',${q(afterAllHolds)}::timestamptz) then raise exception 'Remap falsely ready for original subject';end if;
       r:=account_private.retention_sweep(${q(afterAllHolds)}::timestamptz,1000);
       if (r->>'receipts')::integer<>0 or not exists(select 1 from account_private.close_jobs where request_id='${requestId}')
        or exists(select 1 from account_private.closed_subjects where subject_hash=account_private.subject_key('${buyer.id}')) then
        raise exception 'Remapped audit failed to block original receipt GC';end if;
      end $p1$;
      rollback to savepoint remap`);
    report.p1AuditRemap = { originalReady: false, receiptGcSkipped: true, rolledBack: true };
    assert((await retentionSnapshot(buyer,requestId)).jobs === 1, 'Remap rollback lost receipt');

    report.lastStep = 'private_clock_before90'; await persist();
    const beforeSweep = await retentionSnapshot(buyer, requestId);
    const before90 = await sweepAt(clocks.before90);
    assert(before90.audit_rows === 0 && before90.receipts === 0, 'Retention expired before 90 days');
    assert(JSON.stringify(await retentionSnapshot(buyer,requestId)) === JSON.stringify(beforeSweep), 'Before90 changed retained state');
    report.before90 = { ...before90, stateUnchanged: true };

    report.lastStep = 'private_clock_90d_holds_specific'; await persist();
    const at90 = await sweepAt(clocks.at90);
    const held90 = await retentionSnapshot(buyer, requestId);
    assert(at90.audit_rows > 0 && at90.receipts === 0 && held90.auditRows === 1 && held90.managedRows === 1 && held90.jobs === 1 && held90.requests === 1,
      '90d did not remove unheld audit or retained the wrong held scope');
    assert(Number(await localSql(`select count(*) from auth.audit_log_entries where id='${heldAuditId}'`)) === 1, 'Specific held audit was purged');
    report.at90 = { ...at90, ...held90, exactHeldAuditRetained: true };

    report.lastStep = 'private_clock_audit_hold_expires'; await persist();
    const afterAuditHold = new Date(Date.parse(clocks.auditUntil) + 1).toISOString();
    const auditExpiry = await sweepAt(afterAuditHold);
    const receiptStillHeld = await retentionSnapshot(buyer, requestId);
    assert(auditExpiry.audit_rows === 1 && auditExpiry.receipts === 0 && receiptStillHeld.auditRows === 0 && receiptStillHeld.managedRows === 0 && receiptStillHeld.jobs === 1,
      'Audit hold expiry affected receipt hold or retained audit');
    report.afterAuditHold = { ...auditExpiry, ...receiptStillHeld };

    report.lastStep = 'private_clock_last_hold_expires_receipt_gc'; await persist();
    const finalSweep = await sweepAt(afterAllHolds);
    const finalState = await retentionSnapshot(buyer, requestId);
    assert(finalSweep.receipts === 1 && finalState.auditRows === 0 && finalState.managedRows === 0 && finalState.jobs === 0 && finalState.requests === 0 && finalState.markers === 1 && finalState.holds === 0,
      'Receipt/hold did not expire effectively or revocation marker was lost');
    const repeatedSweep = await sweepAt(afterAllHolds);
    assert(repeatedSweep.audit_rows === 0 && repeatedSweep.receipts === 0, 'Repeated sweep was not idempotent');
    assert(JSON.stringify(await retentionSnapshot(buyer,requestId)) === JSON.stringify(finalState), 'Repeated sweep changed terminal state');
    report.afterLastHold = { ...finalSweep, ...finalState, repeatUnchanged: true };

    // Prove the marker independently of Auth.deleted_at, using a rollback-only active control fixture.
    await localSql(`savepoint marker_only;
      insert into account_private.closed_subjects(subject_hash,request_hash,closed_at)
      values(account_private.subject_key('${control.id}'),sha256(convert_to('mayami:closed-request:v1:${crypto.randomUUID()}','UTF8')),clock_timestamp());
      set local role authenticated;
      do $marker$ begin
       perform set_config('request.jwt.claims','{"role":"authenticated","sub":"${control.id}"}',true);
       if account_private.session_open() then raise exception 'Marker did not deny a live Auth subject';end if;
      end $marker$;
      reset role; rollback to savepoint marker_only`);
    report.markerIndependentOfAuth = { liveSubjectDenied: true, rolledBack: true };

    report.lastStep = 'late_handler_replay_preserves_block_and_control'; await persist();
    const replay = await invoke(live, requestId, admin.access);
    assert(replay.status === 200 && replay.data.state === 'completed' && softDeletes === 1, 'Archived receipt lost terminal handler replay');
    report.afterGcReplay = { state: replay.data.state, softDeleteCalls: softDeletes, ...(await denyOldContext(buyer,paths[0]!)) };
    assert((await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: buyer.email, password: buyer.password } })).status >= 400, 'Old password can log in');
    assert((await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: buyer.refresh } })).status >= 400, 'Old refresh token still works');
    assert(JSON.stringify(await dailyCounts(control)) === JSON.stringify(controlBefore), 'Retention changed unrelated daily data');
    assert(await controlFingerprint(control) === controlIdentityBefore, 'Retention changed unrelated identity/profile/audit');
    const controlWrite = ok(await api('/rest/v1/profiles?id=eq.' + control.id, { method: 'PATCH', token: control.access,
      body: { full_name: 'Unaffected local control' }, headers: { Prefer: 'return=representation' } }), 'Control actor update');
    assert(controlWrite.length === 1, 'Unrelated active actor cannot write');
    report.lastStep = 'exact_90d_without_hold'; await persist();
    const unheld = await actor('unheld90');
    const unheldRequest = ok(await api('/rest/v1/rpc/request_account_deletion', { method: 'POST', token: unheld.access, body: { p_reason: 'Local exact boundary' } }), 'Request unheld closure');
    assert(UUID.test(unheldRequest), 'Invalid unheld request');
    const unheldClosed = await invoke(live,unheldRequest,admin.access);
    assert(unheldClosed.status===200 && unheldClosed.data.state==='completed' && Number(softDeletes)===2, 'Unheld closure did not verify');
    const boundary = JSON.parse(await localSql(`select jsonb_build_object('before',finished_at+interval '2160 hours'-interval '1 microsecond','exact',finished_at+interval '2160 hours') from account_private.close_jobs where request_id='${unheldRequest}'`));
    await sweepAt(boundary.before);
    const unheldBefore = await retentionSnapshot(unheld,unheldRequest);
    assert(unheldBefore.jobs===1 && unheldBefore.requests===1 && unheldBefore.markers===0 && unheldBefore.holds===0, 'Unheld receipt expired before exact90d');
    const exactSweep = await sweepAt(boundary.exact);
    const unheldAfter = await retentionSnapshot(unheld,unheldRequest);
    assert(exactSweep.receipts===1 && unheldAfter.jobs===0 && unheldAfter.requests===0 && unheldAfter.markers===1, 'Unheld receipt did not expire at exact90d');
    const unheldReplay = await invoke(live,unheldRequest,admin.access);
    assert(unheldReplay.status===200 && unheldReplay.data.state==='completed' && Number(softDeletes)===2, 'Unheld expired receipt lost replay');
    report.exact90WithoutHold = { before:unheldBefore,atBoundary:unheldAfter,replayed:true,...(await denyOldContext(unheld,unheld.id+'/absent.png')) };
    assert((await sweepAt(boundary.exact)).receipts===0,'Exact boundary repeat was not idempotent');

    report.lastStep = 'verified'; report.status = 'PASS';
    report.acceptance = { noData: true, noWrite: true, noFile: true, realPasswordJwt: true, realStorageBytes: true,
      storageFailureRetry: true, authDeleteNotRepeated: true, unrelatedActorUnaffected: true,
      knownAuditFieldsMinimized: true, boundedBatchResumes: true, specificFiniteHolds: true,
      before90Unchanged: true, expiredAuditRows: 0, expiredReceiptRows: 0, securityMarkers: 1,
      p1RegisteredRemapDenied: true, lateAuthInsertMinimized: true, archivedReplayCompleted: true,
      totalDeletionClaimed: false, localOnly: true };
    await persist();
    console.log(JSON.stringify({ status: 'PASS', noData: true, noWrite: true, noFile: true,
      storageFailureRetry: true, authDeleteCalls: softDeletes, receiptExpired: true, markerPreserved: true, productionTested: false }));
  } catch (error) {
    report.status = 'FAIL'; report.failureCode = error instanceof Error ? error.message : 'unknown_failure';
    await persist(); throw new Error('Local closure acceptance failed at ' + report.lastStep + '; inspect sanitized receipt');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
