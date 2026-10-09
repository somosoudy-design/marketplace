import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, createUser, expectHint, pool } from '../../src/db';

afterAll(() => pool.end());

describe('commercial configuration guards', () => {
  it('admins cannot mark a provider integration as live or enable it without credentials', async () => {
    const adm = await createUser('cfg-admin', { role: 'admin' });
    await expect(
      asUser(adm.id, (sql) => sql(`update public.payment_methods set integration_status = 'live' where code = 'binance_pay'`)),
    ).rejects.toMatchObject({ code: '42501' });
    await expectHint(
      asUser(adm.id, (sql) => sql(`update public.payment_methods set enabled = true where code = 'binance_pay'`)),
      'integration_not_ready',
    );
    const [m] = await admin(`select enabled, integration_status from public.payment_methods where code = 'binance_pay'`);
    expect(m).toEqual({ enabled: false, integration_status: 'pending_credentials' });
  });

  it('a manual method needs payment instructions before buyers can see it', async () => {
    const adm = await createUser('cfg-admin2', { role: 'admin' });
    const [before] = await admin(`select enabled, instructions from public.payment_methods where code = 'pago_movil'`);
    try {
      await admin(`update public.payment_methods set enabled = false, instructions = '{}' where code = 'pago_movil'`);
      await expectHint(
        asUser(adm.id, (sql) => sql(`update public.payment_methods set enabled = true where code = 'pago_movil'`)),
        'instructions_required',
      );
      await asUser(adm.id, (sql) =>
        sql(`update public.payment_methods set enabled = true, instructions = '{"telefono":"0412-000-0000"}', fee_pct = 1.5 where code = 'pago_movil'`),
      );
      const [audit] = await admin(
        `select actor_id, data from public.audit_log where entity = 'payment_methods' and entity_id = 'pago_movil' and actor_id = $1 order by id desc limit 1`,
        [adm.id],
      );
      expect(audit.data).toMatchObject({ enabled: { from: false, to: true }, fee_pct: { from: 0, to: 1.5 } });
    } finally {
      await admin(`update public.payment_methods set enabled = $1, instructions = $2, fee_pct = 0 where code = 'pago_movil'`, [before.enabled, before.instructions]);
    }
  });

  it('settings record who changed them', async () => {
    const adm = await createUser('cfg-admin3', { role: 'admin' });
    const [before] = await admin(`select value from public.app_settings where key = 'claims.seller_response_hours'`);
    try {
      await asUser(adm.id, (sql) => sql(`update public.app_settings set value = '72' where key = 'claims.seller_response_hours'`));
      const [s] = await admin(`select value, updated_by from public.app_settings where key = 'claims.seller_response_hours'`);
      expect(s).toEqual({ value: 72, updated_by: adm.id });
    } finally {
      await admin(`update public.app_settings set value = $1 where key = 'claims.seller_response_hours'`, [JSON.stringify(before.value)]);
    }
  });
});
