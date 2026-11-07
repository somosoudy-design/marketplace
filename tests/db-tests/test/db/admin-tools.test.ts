import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createStoreWithProduct, createUser, pool } from '../../src/db';

afterAll(() => pool.end());

describe('admin tools', () => {
  it('only admins can search users; results include roles and stores', async () => {
    const boss = await createUser('dir-admin', { role: 'admin' });
    const buyer = await createUser('dir-buyer');
    await expect(asUser(buyer.id, (sql) => sql(`select public.admin_users(null, 10)`))).rejects.toMatchObject({
      code: '42501',
    });
    const [{ admin_users: rows }] = await asUser(boss.id, (sql) =>
      sql(`select public.admin_users($1, 10)`, [buyer.email]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: buyer.id, email: buyer.email, roles: [], stores: [] });
  });

  it('roles are managed by superadmins only, never by the target themselves', async () => {
    const sa = await createUser('role-sa', { role: 'superadmin' });
    const adm = await createUser('role-admin', { role: 'admin' });
    const u = await createUser('role-target');
    await expect(
      asUser(adm.id, (sql) => sql(`select public.set_user_role($1, 'admin', true)`, [u.id])),
    ).rejects.toMatchObject({ code: '42501' });
    await asUser(sa.id, (sql) => sql(`select public.set_user_role($1, 'admin', true)`, [u.id]));
    expect(await admin(`select role from public.user_roles where user_id = $1`, [u.id])).toEqual([{ role: 'admin' }]);
    await expect(
      asUser(sa.id, (sql) => sql(`select public.set_user_role($1, 'superadmin', false)`, [sa.id])),
    ).rejects.toMatchObject({ code: 'P0001' });
    await asUser(sa.id, (sql) => sql(`select public.set_user_role($1, 'admin', false)`, [u.id]));
    expect(await admin(`select role from public.user_roles where user_id = $1`, [u.id])).toEqual([]);
    const audit = await admin(
      `select action from public.audit_log where entity = 'user' and entity_id = $1 order by id`,
      [u.id],
    );
    expect(audit.map((a: any) => a.action)).toEqual(['grant_role', 'revoke_role']);
  });

  it('admins add store staff by e-mail; unknown e-mails are reported', async () => {
    const adm = await createUser('team-admin', { role: 'admin' });
    const staff = await createUser('team-staff');
    const f = await createStoreWithProduct();
    await asUser(adm.id, (sql) =>
      sql(`select public.add_store_member($1, $2, 'staff')`, [f.storeId, staff.email.toUpperCase()]),
    );
    expect(
      await admin(`select role from public.store_members where store_id = $1 and user_id = $2`, [f.storeId, staff.id]),
    ).toEqual([{ role: 'staff' }]);
    await expect(
      asUser(adm.id, (sql) => sql(`select public.add_store_member($1, 'nadie@example.com')`, [f.storeId])),
    ).rejects.toMatchObject({ code: 'P0002' });
    await expect(
      asUser(staff.id, (sql) => sql(`select public.add_store_member($1, $2)`, [f.storeId, adm.email])),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('approving a deletion schedules verified cleanup and blocks the old actor without claiming completion', async () => {
    const adm = await createUser('del-admin', { role: 'admin' });
    const u = await createUser('del-user');
    await admin(`update public.profiles set full_name = 'Persona Real', phone = '0412-0000000' where id = $1`, [u.id]);
    await admin(
      `insert into public.addresses (user_id, label, recipient, phone, region_code, city, line1, country_code)
       values ($1, 'Casa', 'Persona Real', '0412-0000000', 'A', 'Caracas', 'Calle 1', 'VE')`,
      [u.id],
    );
    const [{ request_account_deletion: reqId }] = await asUser(u.id, (sql) =>
      sql(`select public.request_account_deletion('ya no la uso')`),
    );
    await expect(
      asUser(adm.id, (sql) => sql(`select public.process_account_deletion($1, false, '')`, [reqId])),
    ).rejects.toMatchObject({ code: '22023' });
    await asUser(adm.id, (sql) =>
      sql(`select public.process_account_deletion($1, true, 'verificado por soporte')`, [reqId]),
    );
    // Approval only installs the access gate. Auth and physical bytes require the worker APIs.
    const [p] = await admin(`select full_name, phone from public.profiles where id = $1`, [u.id]);
    expect(p).toEqual({ full_name: 'Persona Real', phone: '0412-0000000' });
    expect(await admin(`select 1 from public.addresses where user_id = $1`, [u.id])).toHaveLength(1);
    const [au] = await admin(`select encrypted_password, deleted_at from auth.users where id = $1`, [u.id]);
    expect(au).toEqual({ encrypted_password: 'x', deleted_at: null });
    const [r] = await admin(`select status, cleanup_state, processed_by, processed_at from public.account_deletion_requests where id = $1`, [reqId]);
    expect(r).toEqual({ status: 'in_review', cleanup_state: 'processing', processed_by: adm.id, processed_at: null });
    await expect(asUser(u.id, (sql) => sql(`select public.request_account_deletion(null)`))).rejects.toMatchObject({ hint: 'account_closed' });
    expect(await asUser(u.id, (sql) => sql(`select id from public.profiles where id=$1`, [u.id]))).toHaveLength(0);
    await expect(asUser(u.id, (sql) => sql(`update public.profiles set full_name='Repopulated' where id=$1`, [u.id]))).rejects.toMatchObject({ hint: 'account_closed' });
    await asUser(adm.id, (sql) => sql(`select public.process_account_deletion($1, true)`, [reqId]));
    expect(await admin(`select 1 from account_private.close_jobs where request_id=$1`, [reqId])).toHaveLength(1);
    await expect(asUser(adm.id, (sql) => sql(`select public.process_account_deletion($1, false, 'undo')`, [reqId]))).rejects.toMatchObject({ hint: 'closure_in_progress' });
    await expect(admin(`update public.account_deletion_requests set status='completed',cleanup_state='completed' where id=$1`, [reqId])).rejects.toMatchObject({ hint: 'closure_not_verified' });
  });

  it('a deletion waits while the account has open orders or staff access', async () => {
    const adm = await createUser('del2-admin', { role: 'admin' });
    const seller = await createUser('del2-seller');
    await createStoreWithProduct({ owner: seller.id });
    const [{ request_account_deletion: reqId }] = await asUser(seller.id, (sql) =>
      sql(`select public.request_account_deletion(null)`),
    );
    await expect(
      asUser(adm.id, (sql) => sql(`select public.process_account_deletion($1, true)`, [reqId])),
    ).rejects.toMatchObject({ code: 'P0001' });
  });

  it('rate ingestion rejects implausible jumps unless an admin forces a checked value', async () => {
    const adm = await createUser('rate-admin', { role: 'admin' });
    const pair = 'USD/VES';
    // rows are dated slightly in the future so they win over existing ones; removed at the end so the
    // rate other suites rely on stays untouched
    const [{ max }] = await admin(`select coalesce(max(id), 0) as max from public.exchange_rates`);
    try {
      await admin(
        `insert into public.exchange_rates (source_code, pair, rate, observed_at) values ('bcv_official', $1, 100, now() + interval '1 minute')`,
        [pair],
      );
      await expect(
        asUser(adm.id, (sql) =>
          sql(`select public.ingest_rate('bcv_official', $1, 180, now() + interval '2 minutes')`, [pair]),
        ),
      ).rejects.toMatchObject({ hint: 'rate_anomaly' });
      await asUser(adm.id, (sql) =>
        sql(`select public.ingest_rate('bcv_official', $1, 104.5, now() + interval '2 minutes')`, [pair]),
      );
      await asUser(adm.id, (sql) =>
        sql(`select public.ingest_rate('bcv_official', $1, 180, now() + interval '3 minutes', null, true)`, [pair]),
      );
      const [last] = await admin(
        `select rate from public.exchange_rates where source_code = 'bcv_official' and pair = $1 order by observed_at desc limit 1`,
        [pair],
      );
      expect(Number(last.rate)).toBe(180);
    } finally {
      await admin(`delete from public.exchange_rates where id > $1 and source_code = 'bcv_official'`, [max]);
    }
  });
});
