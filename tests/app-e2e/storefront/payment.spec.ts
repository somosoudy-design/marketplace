// Real local payments stay in verification; no remote writes or provider transactions.
import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';
import { databaseUrl } from '../tests/support/db';
import { testUnpaidOrder } from './fixtures';
test.beforeEach(async ({ context }) => {
  await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', (r) => r.abort('blockedbyclient'));
});
async function payLogin(page: Page, b: { email: string; password: string; orderId: string }) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(b.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(b.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await page.goto('/pagar/' + b.orderId);
}
test('pago con comprobante y respuesta perdida se recupera sin duplicar', async ({ page }, info) => {
  const b = await testUnpaidOrder('audit-web-payment');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 900 });
  await payLogin(page, b);
  await page.locator('.payment-method').filter({ hasText: 'Transferencia' }).getByRole('radio').check();
  await page.getByRole('button', { name: 'Consultar importe a pagar' }).click();
  await expect(page.getByLabel('Comprobante', { exact: true })).toBeVisible();
  await page.getByLabel('Referencia del pago').fill(String(Date.now()).slice(-10));
  const uploads: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/storage/v1/object/payment-proofs/')) uploads.push(r.url());
  });
  await page
    .getByLabel('Comprobante', { exact: true })
    .setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) });
  await expect(page.getByText('El archivo supera 5 MB.')).toBeVisible();
  expect(uploads).toHaveLength(0);
  await page.getByLabel('Comprobante', { exact: true }).setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  let calls = 0;
  await page.route('**/rpc/submit_payment', async (r) => {
    calls++;
    const res = await r.fetch();
    expect(res.ok()).toBe(true);
    await r.abort('failed');
  });
  await page.getByRole('button', { name: 'Ya pagué, enviar para verificar' }).click();
  await expect(page.getByRole('heading', { name: /En verificación|Estamos verificando/ })).toBeVisible();
  expect(calls).toBe(1);
  expect(uploads).toHaveLength(1);
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const rows = (
      await db.query(
        'select p.status,p.proof_path,o.paid_usd from payments p join orders o on p.order_id=o.id where o.id=$1',
        [b.orderId],
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending_verification');
    expect(rows[0].proof_path).toMatch(new RegExp('^' + b.userId + '/'));
    expect(Number(rows[0].paid_usd)).toBe(0);
  } finally {
    await db.end();
  }
  await page.screenshot({ path: info.outputPath('pago-recuperado-dark.png'), fullPage: true });
});

test('cotización vencida bloquea envío y permite actualizar importe', async ({ page }, info) => {
  const b = await testUnpaidOrder('audit-web-expiry');
  await payLogin(page, b);
  await page.locator('.payment-method').filter({ hasText: 'Pago Móvil' }).getByRole('radio').check();
  await page.route('**/rpc/create_payment_quote', async (r) => {
    const res = await r.fetch();
    const q = await res.json();
    q.expires_at = '2020-01-01T00:00:00Z';
    await r.fulfill({ response: res, json: q });
  });
  await page.getByRole('button', { name: 'Consultar importe a pagar' }).click();
  await expect(page.getByText('El importe venció. Actualízalo antes de realizar el pago.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ya pagué, enviar para verificar' })).toHaveCount(0);
  await page.unroute('**/rpc/create_payment_quote');
  await page.getByRole('button', { name: 'Actualizar importe' }).click();
  await page.getByRole('button', { name: 'Consultar importe a pagar' }).click();
  await expect(page.getByRole('button', { name: 'Ya pagué, enviar para verificar' })).toBeVisible();
  await expect(page.getByText('El importe venció. Actualízalo antes de realizar el pago.')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('cotizacion-renovada-light.png'), fullPage: true });
});

test('saldo parcial se presenta descontando pagos y exoneraciones sin cambiar cotización', async ({ page }) => {
  const b = await testUnpaidOrder('web-partial-display');
  // Synthetic read-only DTO tests presentation; no payment is accepted or ledger modified.
  await page.route('**/rest/v1/orders*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('id') === `eq.${b.orderId}`) {
      const response = await route.fetch();
      const data = await response.json();
      const order = Array.isArray(data) ? data[0] : data;
      order.payment_obligations[0] = {
        ...order.payment_obligations[0],
        amount_usd: 100,
        paid_usd: 20,
        waived_usd: 10,
        status: 'partially_paid',
      };
      await route.fulfill({ response, json: data });
    } else await route.continue();
  });
  await payLogin(page, b);
  await expect(page.locator('.purchase-summary .summary-total strong')).toHaveText('$70,00');
});
