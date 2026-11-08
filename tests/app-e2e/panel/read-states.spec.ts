import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

async function demoOrderUrl(page: Page) {
  await signIn(page, 'admin@example.com');
  await page.goto('/admin/pedidos');
  const link = page.locator('main a[href*="/admin/pedidos/ver?id="]').first();
  await expect(link).toBeVisible();
  return (await link.getAttribute('href'))!;
}

function ledgerCard(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Movimientos contables', exact: true }) });
}

// These failures are injected into a read request only; no orders, payments, or ledger entries are changed.
test('ledger loading becomes an empty state only after a successful read', async ({ page }) => {
  const href = await demoOrderUrl(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/rest/v1/ledger_entries*', async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  try {
    await page.goto(href);
    const ledger = ledgerCard(page);
    await expect(ledger).toBeVisible();
    await expect(ledger.getByLabel('Cargando')).toBeVisible();
    await expect(ledger.getByText('Sin movimientos todavía.', { exact: false })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(ledgerCard(page).getByLabel('Cargando')).toHaveCount(0);
  await expect(ledgerCard(page).getByText('Sin movimientos todavía.', { exact: false })).toBeVisible();
});

test('an accounting read failure can be retried without leaving the order', async ({ page }) => {
  const href = await demoOrderUrl(page);
  let fail = true;
  await page.route('**/rest/v1/ledger_entries*', (route) => fail
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'permission denied for table ledger_entries', details: null, hint: null }) })
    : route.continue());
  await page.goto(href);
  const ledger = ledgerCard(page);
  await expect(ledger.getByRole('alert')).toBeVisible();
  await expect(ledger.getByText('Sin movimientos todavía.', { exact: false })).toHaveCount(0);
  const orderHeading = await page.getByRole('heading', { name: /^Pedido P-/ }).innerText();
  fail = false;
  const recoveredResponse = page.waitForResponse((response) => response.url().includes('/rest/v1/ledger_entries') && response.status() === 200);
  await ledger.getByRole('button', { name: 'Reintentar', exact: true }).click();
  const entries = await (await recoveredResponse).json() as unknown[];
  await expect(ledger.getByRole('alert')).toHaveCount(0);
  await expect(ledger.getByLabel('Cargando')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: orderHeading, exact: true })).toBeVisible();
  if (entries.length) await expect(ledger.getByRole('row')).toHaveCount(entries.length + 1);
  else await expect(ledger.getByText('Sin movimientos todavía.', { exact: false })).toBeVisible();
});

test('the order detail keeps actions and tables inside mobile and desktop widths', async ({ page }) => {
  const href = await demoOrderUrl(page);
  for (const width of [390, 1360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(href);
    await expect(page.getByRole('heading', { name: /^Pedido P-/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const update = page.getByRole('button', { name: 'Actualizar estado', exact: true }).first();
    if (await update.count()) {
      const rect = await update.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    }
    const products = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Productos', exact: true }) });
    const table = products.locator('table');
    await expect(table).toBeVisible();
    const scroller = table.locator('..');
    await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    const refund = products.getByRole('button', { name: 'Reembolsar', exact: true }).first();
    if (await refund.count()) {
      const rect = await refund.boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    }
  }
});
