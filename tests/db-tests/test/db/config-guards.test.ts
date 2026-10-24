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

  it('settings that database functions compute with are validated, and required ones cannot be deleted', async () => {
    const adm = await createUser('cfg-settings', { role: 'admin' });
    const set = (key: string, value: string) =>
      asUser(adm.id, (sql) => sql(`update public.app_settings set value = $2::jsonb where key = $1`, [key, value]));
    const [before] = await admin(`select value from public.app_settings where key = 'ranking'`);
    try {
      const e = await expectHint(set('claims.seller_response_hours', '"48 horas"'), 'invalid_setting');
      expect(e.detail).toBe('El plazo de respuesta del vendedor (horas) debe ser un número, sin texto ni comillas.');
      await expectHint(set('claims.seller_response_hours', '2.5'), 'invalid_setting');
      await expectHint(set('orders.unpaid_expiry_hours', '0'), 'invalid_setting');
      await expectHint(set('commission.default_pct', '75'), 'invalid_setting');
      await expectHint(set('orders.number_prefix', '"pedido"'), 'invalid_setting');
      await expectHint(set('ranking', '{"affinity": "alto"}'), 'invalid_setting');
      await expectHint(set('ranking', '{"affinity": 11}'), 'invalid_setting');
      const unknown = await expectHint(set('ranking', '{"afinity": 2}'), 'invalid_setting');
      expect(unknown.detail).toContain('«afinity» no es un parámetro del ranking');
      await expectHint(set('ranking', '{"max_per_store": 0}'), 'invalid_setting');
      await expectHint(set('pricing.import', '{"markup_pct": 30, "per_kg_usd": 0, "fixed_usd": 0, "round_to": 1.5}'), 'invalid_setting');
      await expectHint(set('pricing.import', '{"markup_pct": 30, "per_kg_usd": 0}'), 'invalid_setting'); // fixed_usd missing
      await expectHint(
        asUser(adm.id, (sql) => sql(`delete from public.app_settings where key = 'ranking'`)),
        'invalid_setting',
      );

      // valid values go through, and the recommendations feed keeps working with them
      await set('ranking', '{"affinity": 2.5, "popularity": 1, "max_per_store": 3}');
      await set('claims.seller_response_hours', '72');
      await set('orders.number_prefix', '"PX"');
      const rows = await asUser(adm.id, (sql) => sql(`select count(*)::int as n from public.recommended_products(10)`));
      expect(rows[0].n).toBeGreaterThan(0);
      // settings nobody computes with stay free-form
      await asUser(adm.id, (sql) => sql(`insert into public.app_settings (key, value) values ('ui.banner', '"Hola"')`));
      await asUser(adm.id, (sql) => sql(`delete from public.app_settings where key = 'ui.banner'`));
    } finally {
      await admin(`update public.app_settings set value = $1 where key = 'ranking'`, [before.value]);
      await admin(`update public.app_settings set value = '48' where key = 'claims.seller_response_hours'`);
      await admin(`update public.app_settings set value = '"P"' where key = 'orders.number_prefix'`);
    }
  });

  it('the support contact the app shows is validated, and buyers can read it', async () => {
    const adm = await createUser('cfg-support', { role: 'admin' });
    const buyer = await createUser('cfg-support-buyer');
    const set = (value: string) => asUser(adm.id, (sql) => sql(`update public.app_settings set value = $1::jsonb where key = 'support'`, [value]));
    const [before] = await admin(`select value from public.app_settings where key = 'support'`);
    try {
      expect((await expectHint(set('{"email":"no es correo","hours":"Lun a Vie"}'), 'invalid_setting')).detail).toBe('El correo de soporte no es válido.');
      expect((await expectHint(set('{"email":"ayuda@example.com","hours":""}'), 'invalid_setting')).detail).toMatch(/horario/);
      expect((await expectHint(set('{"email":"ayuda@example.com","hours":"Siempre","phone":"0412"}'), 'invalid_setting')).detail).toMatch(/«phone»/);
      await set('{"email":"ayuda@example.com","hours":"Lun a Sáb, 8:00 a 20:00"}');
      const [row] = await asUser(buyer.id, (sql) => sql(`select value from public.app_settings where key = 'support'`));
      expect(row.value).toEqual({ email: 'ayuda@example.com', hours: 'Lun a Sáb, 8:00 a 20:00' });
      // the unused presentation flag is gone, so nothing in the panel pretends to change the checkout
      expect(await admin(`select key from public.app_settings where key = 'checkout'`)).toEqual([]);
    } finally {
      await admin(`update public.app_settings set value = $1 where key = 'support'`, [JSON.stringify(before.value)]);
    }
  });
});
