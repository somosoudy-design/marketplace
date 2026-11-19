import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { admin, asUser, createStoreWithProduct, createUser, expectHint, pool } from '../../src/db';

let buyer: string, other: string, store: string;
const read = (id: string | null) => asUser(id, (sql) =>
  sql('select store_id from public.store_follows where store_id=$1', [store]));
const follow = (actor: string | null, owner: string) => asUser(actor, (sql) =>
  sql('insert into public.store_follows values ($1,$2) on conflict do nothing returning store_id', [owner, store]));
const unfollow = (actor: string, owner: string) => asUser(actor, (sql) =>
  sql('delete from public.store_follows where user_id=$1 and store_id=$2 returning store_id', [owner, store]));

beforeAll(async () => {
  const [environment] = await admin('select current_database() as db, host(inet_server_addr()) as host');
  if (environment.host !== '127.0.0.1') throw new Error('Follow fixtures require a local database');
  buyer = (await createUser('follow-buyer')).id;
  other = (await createUser('follow-other')).id;
  store = (await createStoreWithProduct({ owner: other })).storeId;
});
afterAll(() => pool.end());

it('stores one follow per account and rejects anonymous or cross-account access', async () => {
  const followed = [{ store_id: store }];
  await expect(read(null)).rejects.toMatchObject({ code: '42501' });
  await expect(follow(null, buyer)).rejects.toMatchObject({ code: '42501' });
  await expect(follow(buyer, other)).rejects.toMatchObject({ code: '42501' });
  expect(await follow(buyer, buyer)).toEqual(followed);
  expect(await follow(buyer, buyer)).toEqual([]);
  expect(await read(other)).toEqual([]);
  expect(await unfollow(other, buyer)).toEqual([]);
  expect(await read(buyer)).toEqual(followed);
  expect(await unfollow(buyer, buyer)).toEqual(followed);
  expect(await unfollow(buyer, buyer)).toEqual([]);
});

it('blocks closing accounts and removes only their follows during cleanup', async () => {
  await follow(buyer, buyer);
  await follow(other, other);
  const request = randomUUID(), lease = randomUUID();
  await admin('insert into public.account_deletion_requests (id,user_id) values ($1,$2)', [request, buyer]);
  await admin(`insert into account_private.close_jobs (request_id,user_id,phase,lease_token,lease_until)
    values ($1,$2,'processing',$3,now()+interval '1 hour')`, [request, buyer, lease]);
  expect(await read(buyer)).toEqual([]);
  await expectHint(follow(buyer, buyer), 'account_closed');
  await expectHint(unfollow(buyer, buyer), 'account_closed');
  await admin('select public.account_close_clean_data($1,$2)', [request, lease]);
  await admin('select public.account_close_clean_data($1,$2)', [request, lease]);
  expect(await admin('select user_id from public.store_follows where store_id=$1', [store])).toEqual([{ user_id: other }]);
});
