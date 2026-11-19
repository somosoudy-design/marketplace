// Isolated loopback channels. Never configure shared methods or contact a real payment provider.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import pg from 'pg';
import { databaseUrl } from '../tests/support/db';
import { testUnpaidOrder } from './fixtures';

type Buyer = Awaited<ReturnType<typeof testUnpaidOrder>>;
type Channel = {
  code: 'test_zelle_manual' | 'binance_internal_test';
  name: string;
  rail: string;
  currency: 'USD' | 'USDT';
  requiresReference: boolean;
  instructions: Record<string, string>;
};
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const receipt = {
  name: 'receipt-local.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  ),
};
async function localDb<T>(fn: (db: pg.Client) => Promise<T>) {
  const connectionString = databaseUrl();
  if (!LOOPBACK.has(new URL(connectionString).hostname))
    throw new Error('Payment-channel fixtures require an exact loopback database host.');
  const db = new pg.Client({ connectionString });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}
async function controls(db: pg.Client) {
  return (
    await db.query(`select code, enabled, kind, rail, currency from public.payment_methods
    where code in ('zelle', 'binance_pay', 'usdt_trc20') order by code`)
  ).rows;
}
async function channelFixture(channel: Channel) {
  const buyer = await testUnpaidOrder(channel.code);
  const original = await localDb(async (db) => {
    const snapshot = await controls(db);
    // A collision must fail. Never overwrite a seed/shared method or a previous run's history.
    await db.query(
      `insert into public.payment_methods
      (code, name, rail, currency, kind, integration_status, enabled, fee_pct, fee_fixed_usd,
       min_usd, max_usd, quote_ttl_minutes, requires_reference, requires_proof, reference_pattern,
       instructions, description, sort, price_basis, basis_adjust_pct)
      values ($1,$2,$3,$4,'manual','live',true,0,0,0,null,60,$5,true,null,$6::jsonb,
              'Canal manual exclusivo de una prueba local; no usar para pagos reales.',900,'divisas',0)`,
      [
        channel.code,
        channel.name,
        channel.rail,
        channel.currency,
        channel.requiresReference,
        JSON.stringify(channel.instructions),
      ],
    );
    return snapshot;
  });
  return {
    buyer,
    async cleanup() {
      await localDb(async (db) => {
        await db.query('begin');
        try {
          const owner = await db.query(
            `select o.id from public.orders o join public.profiles p on p.id=o.buyer_id
            join auth.users u on u.id=p.id where o.id=$1 and o.buyer_id=$2 and p.is_demo and u.email=$3`,
            [buyer.orderId, buyer.userId, buyer.email],
          );
          expect(owner.rows).toHaveLength(1);
          const payments = (
            await db.query(
              `select id,status,usd_recognized,provider from public.payments
            where order_id=$1 and buyer_id=$2 and method_code=$3 for update`,
              [buyer.orderId, buyer.userId, channel.code],
            )
          ).rows;
          // Preserve evidence instead of deleting any credited/automated financial activity on a failure.
          for (const payment of payments) {
            expect(payment.status).toBe('pending_verification');
            expect(Number(payment.usd_recognized ?? 0)).toBe(0);
            expect(payment.provider).toBeNull();
          }
          const ids = payments.map((p) => p.id);
          const related = (
            await db.query(
              `select
            (select count(*)::int from public.payment_allocations where payment_id=any($1::uuid[])) as allocations,
            (select count(*)::int from public.payment_events where payment_id=any($1::uuid[])) as events,
            (select count(*)::int from public.ledger_entries where payment_id=any($1::uuid[])) as ledger`,
              [ids],
            )
          ).rows[0];
          expect(related).toEqual({ allocations: 0, events: 0, ledger: 0 });
          await db.query(
            `delete from public.notifications where user_id=$1 and kind='payment_received'
            and data->>'payment_id'=any($2::text[])`,
            [buyer.userId, ids],
          );
          await db.query(`delete from public.payments where order_id=$1 and buyer_id=$2 and method_code=$3`, [
            buyer.orderId,
            buyer.userId,
            channel.code,
          ]);
          await db.query(`delete from public.payment_quotes where order_id=$1 and buyer_id=$2 and method_code=$3`, [
            buyer.orderId,
            buyer.userId,
            channel.code,
          ]);
          const removed = await db.query('delete from public.payment_methods where code=$1 returning code', [
            channel.code,
          ]);
          expect(removed.rows).toEqual([{ code: channel.code }]);
          expect(await controls(db)).toEqual(original);
          // Keep the isolated unpaid order, suspended product and immutable order ledger, as existing fixtures do.
          await db.query('commit');
        } catch (error) {
          await db.query('rollback');
          throw error;
        }
      });
    },
  };
}

test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL || !LOOPBACK.has(new URL(baseURL).hostname))
    throw new Error('Payment-channel UI requires a loopback storefront.');
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['http:', 'https:'].includes(url.protocol) && !LOOPBACK.has(url.hostname)
      ? route.abort('blockedbyclient')
      : route.continue();
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL).origin });
});
async function login(page: Page, buyer: Buyer) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await page.goto('/pagar/' + buyer.orderId);
}
async function showChannel(page: Page, buyer: Buyer, channel: Channel) {
  // Scope only this browser's method list; never disable/reconfigure shared fixture methods in the database.
  await page.route('**/rest/v1/payment_methods*', async (route) => {
    const request = route.request();
    if (!LOOPBACK.has(new URL(request.url()).hostname) || request.method() !== 'GET')
      return route.abort('blockedbyclient');
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const rows = await response.json();
    expect(Array.isArray(rows)).toBe(true);
    const scoped = rows.filter((m: { code: string }) => m.code === channel.code);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]).toMatchObject({
      code: channel.code,
      kind: 'manual',
      currency: channel.currency,
      rail: channel.rail,
      requires_proof: true,
      price_basis: 'divisas',
    });
    await route.fulfill({ response, json: scoped });
  });
  await login(page, buyer);
  await expect(page.locator('.payment-method')).toHaveCount(1);
  await page.locator('.payment-method').getByRole('radio').check();
  await page.getByRole('button', { name: 'Consultar importe a pagar', exact: true }).click();
  await expect(page.getByRole('heading', { name: channel.name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Datos para pagar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar pago en línea', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continuar con el proveedor', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Comprobante', { exact: true })).toBeVisible();
}
function requests(page: Page) {
  const submit: { p_reference?: string | null }[] = [],
    uploads: string[] = [],
    automated: string[] = [],
    remoteWrites: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (
      url.pathname.includes('/functions/v1/payments-start') ||
      url.pathname.endsWith('/rpc/review_payment') ||
      url.hostname.includes('binanceapi') ||
      url.hostname.includes('binance.com')
    )
      automated.push(url.origin + url.pathname);
    if (r.method() !== 'POST') return;
    if (!LOOPBACK.has(url.hostname)) remoteWrites.push(url.origin + url.pathname);
    if (url.pathname.endsWith('/rpc/submit_payment')) submit.push(r.postDataJSON());
    if (url.pathname.includes('/storage/v1/object/payment-proofs/')) uploads.push(url.pathname);
  });
  return { submit, uploads, automated, remoteWrites };
}
async function verifyCopy(page: Page, expected: string[]) {
  await page.getByRole('button', { name: 'Copiar datos', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Datos copiados.' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split('\n').sort()).toEqual([...expected].sort());
}
async function finishManual(
  page: Page,
  buyer: Buyer,
  channel: Channel,
  ref: string | null,
  calls: ReturnType<typeof requests>,
  info: TestInfo,
  screenshot: string,
) {
  if (channel.requiresReference) {
    const reference = page.getByLabel('Referencia del pago', { exact: true });
    await expect(reference).toHaveAttribute('required', '');
    await page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true }).click();
    await expect(reference).toBeFocused();
    expect(await reference.evaluate((e) => (e as HTMLInputElement).validity.valueMissing)).toBe(true);
    expect(calls.submit).toEqual([]);
    expect(calls.uploads).toEqual([]);
    await reference.fill('123');
    await page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Escribe la referencia del pago.' })).toBeVisible();
    expect(calls.submit).toEqual([]);
    expect(calls.uploads).toEqual([]);
  }
  if (ref) await page.getByLabel('Referencia del pago', { exact: true }).fill(ref);
  await page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Adjunta el comprobante del pago.' })).toBeVisible();
  expect(calls.submit).toEqual([]);
  expect(calls.uploads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator('.skip').evaluate((e) => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: info.outputPath(screenshot), fullPage: true });
  await page.getByLabel('Comprobante', { exact: true }).setInputFiles(receipt);
  await page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true }).click();
  await expect(page.getByTestId('payment-sent')).toContainText('En verificación');
  await expect(page.getByTestId('payment-sent')).toContainText('Confirmaremos el pago después de revisarlo.');
  expect(calls.submit).toHaveLength(1);
  expect(calls.submit[0]?.p_reference).toBe(ref);
  expect(calls.uploads).toHaveLength(1);
  expect(calls.automated).toEqual([]);
  expect(calls.remoteWrites).toEqual([]);
  await localDb(async (db) => {
    const rows = (
      await db.query(
        `select p.status,p.method_code,p.currency,p.reference,p.proof_path,p.provider,
      p.usd_recognized,o.paid_usd,
      (select count(*)::int from public.payment_allocations a where a.payment_id=p.id) as allocations,
      (select count(*)::int from public.payment_events e where e.payment_id=p.id) as events
      from public.payments p join public.orders o on o.id=p.order_id
      where p.order_id=$1 and p.buyer_id=$2 and p.method_code=$3`,
        [buyer.orderId, buyer.userId, channel.code],
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'pending_verification',
      method_code: channel.code,
      currency: channel.currency,
      reference: ref,
      provider: null,
      allocations: 0,
      events: 0,
    });
    expect(rows[0].proof_path).toMatch(new RegExp('^' + buyer.userId + '/'));
    expect(Number(rows[0].paid_usd)).toBe(0);
    expect(Number(rows[0].usd_recognized ?? 0)).toBe(0);
  });
}

test('Zelle manual USD muestra beneficiario, copia datos y exige comprobante sin acreditar saldo', async ({
  page,
}, info) => {
  const channel: Channel = {
    code: 'test_zelle_manual',
    name: 'Zelle · prueba manual local',
    rail: 'zelle',
    currency: 'USD',
    requiresReference: true,
    instructions: {
      correo: 'zelle-receptor@example.com',
      titular: 'Beneficiario de prueba',
      nota: 'Verificación manual local. No realizar transferencias reales.',
    },
  };
  const fixture = await channelFixture(channel);
  try {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.setViewportSize({ width: 320, height: 900 });
    const calls = requests(page);
    await showChannel(page, fixture.buyer, channel);
    await expect(page.locator('.quote-amount strong')).toContainText('$');
    await expect(page.locator('.payment-instructions')).toContainText('Beneficiario de prueba');
    await expect(page.locator('.payment-instructions')).toContainText('zelle-receptor@example.com');
    await verifyCopy(page, ['Correo: zelle-receptor@example.com', 'Titular: Beneficiario de prueba']);
    await finishManual(page, fixture.buyer, channel, 'ZELLE12345678', calls, info, 'zelle-manual-light-320.png');
  } finally {
    await fixture.cleanup();
  }
});

test('Binance interna USDT usa ID interno y comprobante con revisión manual, sin pasarela ni cadena', async ({
  page,
}, info) => {
  const channel: Channel = {
    code: 'binance_internal_test',
    name: 'Binance interna · prueba manual local',
    rail: 'binance_internal',
    currency: 'USDT',
    requiresReference: true,
    instructions: {
      Plataforma: 'Binance',
      correo: 'binance-receptor@example.com',
      Alias: 'Alias de prueba',
      Moneda: 'USDT',
      nota: 'Transferencia interna a un usuario Binance por correo. Reporta el ID interno completo. No es un retiro por TRC-20 ni requiere TxID blockchain. Verificación manual; no se acredita automáticamente.',
    },
  };
  const fixture = await channelFixture(channel);
  try {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 320, height: 900 });
    const calls = requests(page);
    await showChannel(page, fixture.buyer, channel);
    await expect(page.locator('.quote-amount strong')).toContainText('USDT');
    await expect(page.locator('.payment-instructions')).toContainText('Binance');
    await expect(page.locator('.payment-instructions')).toContainText('Alias de prueba');
    await expect(page.locator('.payment-instructions')).toContainText('USDT');
    await expect(page.locator('.payment-instructions dt').filter({ hasText: /^(Red|Dirección)$/ })).toHaveCount(0);
    await expect(page.getByLabel('Hash de la transacción', { exact: true })).toHaveCount(0);
    await verifyCopy(page, [
      'Plataforma: Binance',
      'Correo: binance-receptor@example.com',
      'Alias: Alias de prueba',
      'Moneda: USDT',
    ]);
    const internalId = '1234567890123456';
    expect(internalId).toMatch(/^\d{16}$/);
    await finishManual(page, fixture.buyer, channel, internalId, calls, info, 'binance-interna-manual-dark-320.png');
  } finally {
    await fixture.cleanup();
  }
});
