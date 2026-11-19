// Proposal only. Copy into tests/db-tests/test/db in the isolated review checkout.
// Run only with TEST_DATABASE_URL explicitly pointing to the root-owned local clone.
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, describe, expect, it } from 'vitest';
import {
  admin, asUser, createAddress, createStoreWithProduct, createUser, expectHint,
  key, ledgerBalanced, pool,
} from '../../src/db';

// Fail closed before any fixture query: these proposals may only write the explicitly isolated clone.
const isolatedTarget = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['localhost','127.0.0.1','[::1]'].includes(isolatedTarget.hostname) ||
    !isolatedTarget.pathname.startsWith('/mayami_functional_')) {
  throw new Error('Set TEST_DATABASE_URL to the authorized local mayami_functional_* clone. No shared or remote database is allowed.');
}

afterAll(() => pool.end());

it('reviews physical condition before purchase and freezes it in the order without changing financial totals',async()=>{
  const buyer=await createUser('condition-checkout');const f=await createStoreWithProduct({kind:'platform',stock:5,price:25});const address=await createAddress(buyer.id);
  await admin("update public.products set condition='refurbished' where id=$1",[f.productId]);await setQty(buyer.id,f.variantId,1);
  const legacy=await asUser(buyer.id,async sql=>(await sql("select public.checkout_preview($1,'{}','full') r",[address]))[0].r);
  const reviewed=await preview(buyer.id,address);
  expect(reviewed.groups[0].lines[0].product_condition).toBe('refurbished');
  for(const key of ['items_usd','shipping_usd','financing_usd','total_usd'])expect(reviewed[key]).toEqual(legacy[key]);
  await admin("update public.products set condition='new' where id=$1",[f.productId]);
  await expectHint(place(buyer.id,address,key('condition-stale'),reviewed.review_token),'checkout_changed');
  expect(await quantity(buyer.id,f.variantId)).toBe(1);
  const latest=await preview(buyer.id,address);const order=await place(buyer.id,address,key('condition-order'),latest.review_token);
  await admin("update public.products set condition='refurbished' where id=$1",[f.productId]);
  expect((await admin('select product_condition from public.order_items where order_id=$1',[order.order_id]))[0].product_condition).toBe('new');
});

const setQty = (user: string, variant: string, quantity: number) =>
  asUser(user, (sql) => sql('select public.cart_set_quantity($1,$2) as result', [variant, quantity]));
const add = (user: string, variant: string, quantity: number, intent: string) =>
  asUser(user, async (sql) => (await sql('select public.cart_add_intent($1,$2,$3) as result', [variant, quantity, intent]))[0].result);
const merge = (user: string, lines: { variant_id: string; quantity: number }[], intent: string) =>
  asUser(user, async (sql) => (await sql('select public.cart_merge_intent($1::jsonb,$2) as result', [JSON.stringify(lines), intent]))[0].result);
const quantity = async (user: string, variant: string) => {
  const rows = await admin('select quantity from public.cart_items where user_id=$1 and variant_id=$2', [user, variant]);
  return rows[0]?.quantity ?? 0;
};
const journal = (user: string) => admin('select operation,payload,result from checkout_private.cart_intent_journal where buyer_id=$1', [user]);
const preview = (user: string, address: string) =>
  asUser(user, async (sql) => (await sql("select public.checkout_preview_reviewed($1,'{}','full') as result", [address]))[0].result);
const place = (user: string, address: string, intent: string, token: string | null) =>
  asUser(user, async (sql) => (await sql("select public.place_order_reviewed($1,'{}','full',$2,$3) as result", [address, intent, token]))[0].result);

async function reviewedFixture(label: string) {
  const buyer = await createUser(label);
  const product = await createStoreWithProduct({ price: 25, stock: 10 });
  const address = await createAddress(buyer.id);
  await setQty(buyer.id, product.variantId, 2);
  return { buyer, product, address, summary: await preview(buyer.id, address) };
}

// Every launched operation captures its error immediately, so a deliberate lock
// wait never leaves an unhandled rejection while another connection is inspected.
function launch(user: string, statement: string, params: unknown[], applicationName?: string) {
  let announce!: (pid: number) => void;
  const pid = new Promise<number>((resolve) => { announce = resolve; });
  const result = asUser(user, async (sql) => {
    if (applicationName) await sql("select set_config('application_name',$1,true)", [applicationName]);
    const [session] = await sql('select pg_backend_pid()::int as pid');
    announce(session.pid);
    return sql(statement, params);
  }).then(
    (rows) => ({ ok: true as const, rows }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return { pid, result };
}

async function expectLockWait(pids: number[], event?: string) {
  const deadline = Date.now() + 4000;
  let last: unknown[] = [];
  while (Date.now() < deadline) {
    const rows = await admin(
      'select pid,wait_event_type,wait_event from pg_stat_activity where pid=any($1::int[])', [pids],
    );
    last = rows;
    if (rows.length === pids.length && rows.every((row: any) => row.wait_event_type === 'Lock' && (!event || row.wait_event === event))) return;
    await delay(15);
  }
  throw new Error(`Expected database lock wait${event ? ` (${event})` : ''}; observed ${JSON.stringify(last)}`);
}

async function completed(operation: ReturnType<typeof launch>) {
  const outcome = await operation.result;
  if (!outcome.ok) throw outcome.error;
  return outcome.rows;
}

describe('checkout/cart functional integrity — isolated database only', () => {
  it('legacy concurrent adds preserve both increments (deterministic row-lock barrier)', async () => {
    const buyer = await createUser('legacy-add-race');
    const f = await createStoreWithProduct({ stock: 10 });
    await setQty(buyer.id, f.variantId, 1);
    const blocker = await pool.connect();
    let first: ReturnType<typeof launch> | undefined;
    let second: ReturnType<typeof launch> | undefined;
    try {
      await blocker.query('begin');
      // Do not acquire the buyer advisory lock here: hold only the target row.
      // Old cart_add reads quantity before either operation gets to its upsert;
      // corrected cart_add serializes before that read.
      await blocker.query('select 1 from public.cart_items where user_id=$1 and variant_id=$2 for update', [buyer.id, f.variantId]);
      first = launch(buyer.id, 'select public.cart_add($1,1) as result', [f.variantId]);
      second = launch(buyer.id, 'select public.cart_add($1,1) as result', [f.variantId]);
      await expectLockWait(await Promise.all([first.pid, second.pid]));
    } finally {
      await blocker.query('rollback');
      blocker.release();
    }
    const results = await Promise.all([completed(first!), completed(second!)]);
    expect(results.map((rows) => rows[0].result.quantity).sort()).toEqual([2, 3]);
    expect(await quantity(buyer.id, f.variantId)).toBe(3);
  });

  it.each(['insert', 'update', 'delete'] as const)('direct cart %s participates in the buyer checkout lock', async (operation) => {
    const buyer = await createUser(`direct-cart-${operation}`);
    const f = await createStoreWithProduct({ stock: 10 });
    if (operation !== 'insert') await setQty(buyer.id, f.variantId, 1);
    const blocker = await pool.connect();
    let pending: ReturnType<typeof launch> | undefined;
    try {
      await blocker.query('begin');
      await blocker.query("select pg_advisory_xact_lock(hashtextextended('checkout:' || $1::text,0))", [buyer.id]);
      const statement = {
        insert: 'insert into public.cart_items(user_id,variant_id,quantity) values(auth.uid(),$1,2) returning quantity',
        update: 'update public.cart_items set quantity=2 where user_id=auth.uid() and variant_id=$1 returning quantity',
        delete: 'delete from public.cart_items where user_id=auth.uid() and variant_id=$1 returning quantity',
      }[operation];
      pending = launch(buyer.id, statement, [f.variantId]);
      await expectLockWait([await pending.pid], 'advisory');
    } finally {
      await blocker.query('rollback');
      blocker.release();
    }
    expect(await completed(pending!)).toHaveLength(1);
    expect(await quantity(buyer.id, f.variantId)).toBe(operation === 'delete' ? 0 : 2);
  });

  it('direct DML cannot change the reviewed cart while real checkout waits on a variant lock', async () => {
    const { buyer, product, address, summary } = await reviewedFixture('checkout-dml-race');
    const blocker = await pool.connect();
    let order: ReturnType<typeof launch> | undefined;
    let edit: ReturnType<typeof launch> | undefined;
    try {
      await blocker.query('begin');
      await blocker.query('select 1 from public.product_variants where id=$1 for update', [product.variantId]);
      order = launch(buyer.id, "select public.place_order_reviewed($1,'{}','full',$2,$3) as result", [address, key('locked-order'), summary.review_token]);
      await expectLockWait([await order.pid]);
      edit = launch(buyer.id, 'update public.cart_items set quantity=3 where user_id=auth.uid() and variant_id=$1 returning quantity', [product.variantId]);
      await expectLockWait([await edit.pid], 'advisory');
    } finally {
      await blocker.query('rollback');
      blocker.release();
    }
    const orderRows = await completed(order!);
    expect(await completed(edit!)).toHaveLength(0); // checkout consumed that row before the edit could run
    const [line] = await admin('select quantity from public.order_items where order_id=$1 and variant_id=$2', [orderRows[0].result.order_id, product.variantId]);
    expect(line.quantity).toBe(2);
    expect(await quantity(buyer.id, product.variantId)).toBe(0);
  });

  it('add intent replays its result without adding again or overwriting later cart edits', async () => {
    const buyer = await createUser('add-replay');
    const f = await createStoreWithProduct({ stock: 10 });
    const intent = key('add');
    expect(await add(buyer.id, f.variantId, 2, intent)).toEqual({ variant_id: f.variantId, quantity: 2, replayed: false });
    await setQty(buyer.id, f.variantId, 4);
    expect(await add(buyer.id, f.variantId, 2, intent)).toEqual({ variant_id: f.variantId, quantity: 2, replayed: true });
    expect(await quantity(buyer.id, f.variantId)).toBe(4);
    expect(await journal(buyer.id)).toHaveLength(1);
  });

  it.each(['add', 'merge'] as const)('concurrent identical %s intents both succeed and mutate once', async (operation) => {
    const buyer = await createUser(`intent-race-${operation}`);
    const f = await createStoreWithProduct({ stock: 10 });
    const intent = key(operation);
    const act = () => operation === 'add'
      ? add(buyer.id, f.variantId, 2, intent)
      : merge(buyer.id, [{ variant_id: f.variantId, quantity: 2 }], intent);
    const [first, second] = await Promise.all([act(), act()]);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(await quantity(buyer.id, f.variantId)).toBe(2);
    expect(await journal(buyer.id)).toHaveLength(1);
  });

  it('binds a key to its payload and operation, including merge payloads', async () => {
    const buyer = await createUser('intent-binding');
    const f = await createStoreWithProduct({ stock: 10 });
    const addKey = key('bound-add');
    await add(buyer.id, f.variantId, 1, addKey);
    await expectHint(add(buyer.id, f.variantId, 2, addKey), 'idempotency_conflict');
    await expectHint(merge(buyer.id, [{ variant_id: f.variantId, quantity: 1 }], addKey), 'idempotency_conflict');
    const mergeKey = key('bound-merge');
    await merge(buyer.id, [{ variant_id: f.variantId, quantity: 2 }], mergeKey);
    await expectHint(merge(buyer.id, [{ variant_id: f.variantId, quantity: 3 }], mergeKey), 'idempotency_conflict');
    await expectHint(add(buyer.id, f.variantId, 2, mergeKey), 'idempotency_conflict');
    expect(await quantity(buyer.id, f.variantId)).toBe(3);
    expect(await journal(buyer.id)).toHaveLength(2);
  });

  it('the same intent key is isolated between buyers and preserves cart RLS', async () => {
    const first = await createUser('intent-owner-a');
    const second = await createUser('intent-owner-b');
    const f = await createStoreWithProduct({ stock: 10 });
    const intent = key('shared-key');
    expect((await add(first.id, f.variantId, 1, intent)).replayed).toBe(false);
    expect((await add(second.id, f.variantId, 2, intent)).replayed).toBe(false);
    expect(await quantity(first.id, f.variantId)).toBe(1);
    expect(await quantity(second.id, f.variantId)).toBe(2);
    const foreign = await asUser(first.id, (sql) => sql('select * from public.cart_items where user_id=$1', [second.id]));
    expect(foreign).toHaveLength(0);
    expect(await journal(first.id)).toHaveLength(1);
    expect(await journal(second.id)).toHaveLength(1);
  });

  it('intent merge rolls back every line when a later line is unavailable', async () => {
    const mode = 'intent';
    const buyer = await createUser(`atomic-${mode}`);
    const valid = await createStoreWithProduct({ stock: 10 });
    const unavailable = await createStoreWithProduct({ stock: 10, status: 'suspended' });
    await setQty(buyer.id, valid.variantId, 1);
    const lines = [{ variant_id: valid.variantId, quantity: 2 }, { variant_id: unavailable.variantId, quantity: 1 }];
    const intent = key('atomic');
    const action = () => merge(buyer.id, lines, intent);
    await expectHint(action(), 'unavailable');
    expect(await quantity(buyer.id, valid.variantId)).toBe(1);
    expect(await quantity(buyer.id, unavailable.variantId)).toBe(0);
    expect(await journal(buyer.id)).toHaveLength(0);
    // A failed attempt must not consume its key or leave a partial mutation.
    await admin("update public.stores set status='active' where id=$1", [unavailable.storeId]);
    expect(await action()).toEqual({ accepted: 2, replayed: false });
    expect(await quantity(buyer.id, valid.variantId)).toBe(3);
    expect(await quantity(buyer.id, unavailable.variantId)).toBe(1);
  });

  it('journal access is forbidden to both authenticated buyers and anonymous callers', async () => {
    const buyer = await createUser('private-journal');
    const f = await createStoreWithProduct({ stock: 10 });
    await add(buyer.id, f.variantId, 1, key('private'));
    for (const caller of [buyer.id, null]) {
      await expect(asUser(caller, (sql) => sql('select * from checkout_private.cart_intent_journal'))).rejects.toMatchObject({ code: '42501' });
      await expect(asUser(caller, (sql) => sql('delete from checkout_private.cart_intent_journal'))).rejects.toMatchObject({ code: '42501' });
    }
    await expect(asUser(null, (sql) => sql('select public.cart_add_intent($1,1,$2)', [f.variantId, key('anon')]))).rejects.toMatchObject({ code: '42501' });
    await expect(asUser(buyer.id, (sql) => sql("select public._checkout_review_token('{}'::jsonb)"))).rejects.toMatchObject({ code: '42501' });
    expect(await journal(buyer.id)).toHaveLength(1);
  });

  it('an unchanged server review has a stable token and preserves its exact total and ledger', async () => {
    const { buyer, product, address, summary } = await reviewedFixture('review-unchanged');
    expect(summary.review_token).toMatch(/^[0-9a-f]{64}$/);
    const second = await preview(buyer.id, address);
    expect(second).toEqual(summary);
    const result = await place(buyer.id, address, key('reviewed'), summary.review_token);
    expect(result.replayed).toBe(false);
    const [order] = await admin('select total_usd,items_usd,shipping_usd,financing_usd from public.orders where id=$1', [result.order_id]);
    for (const field of ['total_usd', 'items_usd', 'shipping_usd', 'financing_usd']) expect(Number(order[field])).toBe(summary[field]);
    const [variant] = await admin('select stock from public.product_variants where id=$1', [product.variantId]);
    expect(variant.stock).toBe(8);
    expect(await ledgerBalanced(result.order_id)).toBe(true);
  });

  it.each(['price', 'quantity', 'address'] as const)('a changed %s invalidates review without creating an order or consuming stock', async (change) => {
    const { buyer, product, address, summary } = await reviewedFixture(`review-change-${change}`);
    if (change === 'price') await admin('update public.product_variants set price_usd=29 where id=$1', [product.variantId]);
    if (change === 'quantity') await setQty(buyer.id, product.variantId, 3);
    if (change === 'address') await asUser(buyer.id, (sql) => sql("update public.addresses set line1='Otra calle de prueba 456' where id=$1", [address]));
    expect((await preview(buyer.id, address)).review_token).not.toBe(summary.review_token);
    await expectHint(place(buyer.id, address, key('changed'), summary.review_token), 'checkout_changed');
    const [{ n }] = await admin('select count(*)::int as n from public.orders where buyer_id=$1', [buyer.id]);
    expect(n).toBe(0);
    const [variant] = await admin('select stock from public.product_variants where id=$1', [product.variantId]);
    expect(variant.stock).toBe(10);
    expect(await quantity(buyer.id, product.variantId)).toBe(change === 'quantity' ? 3 : 2);
  });

  it('reviewed placement requires a token and rejects a fabricated revision', async () => {
    const { buyer, address } = await reviewedFixture('review-required');
    await expectHint(place(buyer.id, address, key('missing'), null), 'invalid_input');
    await expectHint(place(buyer.id, address, key('invalid'), ''), 'invalid_input');
    await expectHint(place(buyer.id, address, key('forged'), '0'.repeat(64)), 'checkout_changed');
    const [{ n }] = await admin('select count(*)::int as n from public.orders where buyer_id=$1', [buyer.id]);
    expect(n).toBe(0);
  });

  it('address edits after the review hash cannot replace the address actually accepted', async () => {
    const { buyer, address, summary } = await reviewedFixture('review-address-snapshot');
    const [{ definition }] = await admin("select pg_get_functiondef('public._checkout_review_token(jsonb)'::regprocedure) as definition");
    const applicationName = key('review-address'); // UUID-based fixture label, no user-controlled SQL.
    const literal = applicationName.replace(/'/g, "''");
    const blocker = await pool.connect();
    let held = false;
    let pending: ReturnType<typeof launch> | undefined;
    try {
      // Temporary instrumentation in THIS isolated clone only. Pause inside token
      // evaluation, after _build_checkout captured the address and before its
      // caller persists ship_to. All other sessions keep the same hash behaviour.
      const marker = '  return encode(';
      expect(definition).toContain(marker);
      const instrumented = definition.replace(marker, `
          if current_setting('application_name',true)='${literal}' then
            perform pg_advisory_xact_lock(hashtextextended('review-address:' || current_setting('application_name',true),0));
          end if;
        ${marker}`);
      // Preserve the exact production hash body and only inject a barrier before its return.
      await admin(instrumented);
      await blocker.query('begin');
      held = true;
      await blocker.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`review-address:${applicationName}`]);
      pending = launch(buyer.id, "select public.place_order_reviewed($1,'{}','full',$2,$3) as result", [address, key('address-race'), summary.review_token], applicationName);
      await expectLockWait([await pending.pid], 'advisory');
      await asUser(buyer.id, (sql) => sql("update public.addresses set line1='Dirección editada después de revisar' where id=$1", [address]));
      await blocker.query('rollback');
      held = false;
      const rows = await completed(pending);
      const [saved] = await admin('select ship_to from public.orders where id=$1', [rows[0].result.order_id]);
      expect(saved.ship_to.line1).toBe(summary.address.line1);
      const [current] = await admin('select line1 from public.addresses where id=$1', [address]);
      expect(current.line1).toBe('Dirección editada después de revisar');
      expect(saved.ship_to.line1).not.toBe(current.line1);
    } finally {
      if (held) await blocker.query('rollback');
      blocker.release();
      if (pending) await pending.result; // drain the operation before restoring the function
      await admin(definition); // restores original body, attributes and volatility, retaining ACL
    }
  });

  it('lost-response retry returns the existing reviewed order after the cart is empty', async () => {
    const { buyer, product, address, summary } = await reviewedFixture('review-recovery');
    const intent = key('lost-order-response');
    // Commit happened; discard the first RPC result as if its response never arrived.
    await place(buyer.id, address, intent, summary.review_token);
    expect(await quantity(buyer.id, product.variantId)).toBe(0);
    const [saved] = await admin('select id,number from public.orders where buyer_id=$1 and idempotency_key=$2', [buyer.id, intent]);
    const recovered = await place(buyer.id, address, intent, summary.review_token);
    expect(recovered).toEqual({ order_id: saved.id, number: saved.number, replayed: true });
    const [{ n }] = await admin('select count(*)::int as n from public.orders where buyer_id=$1', [buyer.id]);
    expect(n).toBe(1);
    const [variant] = await admin('select stock from public.product_variants where id=$1', [product.variantId]);
    expect(variant.stock).toBe(8);
    expect(await ledgerBalanced(saved.id)).toBe(true);
  });
});

it('incidental collection ordering cannot invalidate an otherwise identical reviewed summary',async()=>{
  const {summary}=await reviewedFixture('review-canonical');
  const doc={...summary};delete doc.review_token;
  // Add a second line/options/plans to exercise every collection independently of SQL's plan.
  const group=doc.groups[0];
  const a={...group, key:'a',lines:[{variant_id:'a',quantity:1},{variant_id:'b',quantity:2}],
    shipping_options:[{method_id:'b',cost_usd:4},{method_id:'a',cost_usd:4}]};
  const b={...group,key:'b'};
  doc.groups=[a,b];doc.plans=[{code:'full'},{code:'split'}];doc.schedule=[{seq:1,amount_usd:4},{seq:2,amount_usd:5}];
  doc.plan={...doc.plan,allowed_flows:['local_stock','seller_shipping']};
  const changed=structuredClone(doc);changed.groups.reverse();
  changed.groups.find((g:any)=>g.key==='a').lines.reverse();
  changed.groups.find((g:any)=>g.key==='a').shipping_options.reverse();
  changed.plans.reverse();changed.schedule.reverse();changed.plan.allowed_flows.reverse();
  const hash=async(value:unknown)=>(await admin('select public._checkout_review_token($1::jsonb) t',[JSON.stringify(value)]))[0].t;
  expect(await hash(doc)).toBe(await hash(changed));
  changed.total_usd+=1;expect(await hash(doc)).not.toBe(await hash(changed));
});
it('tied cart timestamps and a no-op quantity update do not force a new review',async()=>{
  const {buyer,product,address}=await reviewedFixture('review-tied-lines');
  const other=await createStoreWithProduct({stock:10});await setQty(buyer.id,other.variantId,1);
  await admin("update public.cart_items set added_at='2026-01-01T00:00:00Z' where user_id=$1",[buyer.id]);
  const before=await preview(buyer.id,address);
  await setQty(buyer.id,product.variantId,2);
  expect((await preview(buyer.id,address)).review_token).toBe(before.review_token);
  const result=await place(buyer.id,address,key('tie-order'),before.review_token);
  expect((await admin('select count(*)::int n from public.order_items where order_id=$1',[result.order_id]))[0].n).toBe(2);
});

it('legacy guest merge retains valid lines when another product is unavailable',async()=>{
  const buyer=await createUser('legacy-compat');const valid=await createStoreWithProduct({stock:10});const hidden=await createStoreWithProduct({status:'suspended'});
  const lines=[{variant_id:valid.variantId,quantity:2},{variant_id:hidden.variantId,quantity:1}];
  const [row]=await asUser(buyer.id,sql=>sql('select public.cart_merge($1::jsonb) accepted',[JSON.stringify(lines)]));
  expect(row.accepted).toBe(1);expect(await quantity(buyer.id,valid.variantId)).toBe(2);expect(await quantity(buyer.id,hidden.variantId)).toBe(0);
});
