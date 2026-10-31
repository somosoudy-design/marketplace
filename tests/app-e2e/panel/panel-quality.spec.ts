import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

// Read-only UI failure/format fixtures. No payment is approved, no store or ledger is changed.
test.beforeEach(async ({ page }) => {
  await page.route('**/mimnotafmfasvwrclxan.supabase.co/**', (route) => route.abort());
});

test('seller store read failure offers a retry and recovers without logging out', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/stores?*', (route) => fail
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'fixture: store read denied' }) })
    : route.continue());
  await signIn(page, 'tiendas@example.com');
  await page.goto('/vendedor');
  await expect(page.locator('main').getByRole('alert')).toContainText('No pudimos cargar esta información');
  await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
});

test('seller with no returned stores receives an explicit empty state', async ({ page }) => {
  await page.route('**/rest/v1/stores?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await signIn(page, 'tiendas@example.com');
  await page.goto('/vendedor');
  await expect(page.getByText('No hay una tienda disponible', { exact: true })).toBeVisible();
  await expect(page.locator('main [aria-busy=true]')).toHaveCount(0);
});

const pdf = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
async function proofDialog(page: Page, contentType: string, body: string, shouldFail: () => boolean = () => false) {
  await signIn(page, 'admin@example.com');
  await page.route('**/rest/v1/payments?*', async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    expect(rows.length).toBeGreaterThan(0);
    await route.fulfill({ response, json: [{ ...rows[0], proof_path: 'fixture/ui-proof' }] });
  });
  await page.route('**/storage/v1/object/**', (route) => shouldFail()
    ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: '403', message: 'fixture: unavailable' }) })
    : route.fulfill({ status: 200, contentType, body }));
  await page.goto('/admin/pagos');
  await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
  return page.getByRole('dialog', { name: /^Pago PG-/ });
}

test('PDF proof recovers a read failure and has a named safe opening link', async ({ page }) => {
  let fail = true;
  const dialog = await proofDialog(page, 'application/pdf', pdf, () => fail);
  await expect(dialog.getByText('No pudimos abrir el comprobante.', { exact: true })).toBeVisible();
  fail = false;
  await dialog.getByRole('button', { name: 'Reintentar comprobante', exact: true }).click();
  const link = dialog.getByRole('link', { name: 'Abrir comprobante PDF', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /^blob:/);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(dialog.locator('img,iframe,object,embed')).toHaveCount(0);
});

test('unknown active document is download-only, never rendered inside the panel origin', async ({ page }) => {
  const dialog = await proofDialog(page, 'text/html', '<!doctype html><script>window.PROOF_EXECUTED=true</script>');
  const link = dialog.getByRole('link', { name: 'Descargar archivo adjunto', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('download', /^comprobante-PG-.*\.bin$/);
  expect(await link.getAttribute('target')).toBeNull();
  await expect(dialog.locator('img,iframe,object,embed')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { PROOF_EXECUTED?: boolean }).PROOF_EXECUTED)).toBeUndefined();
});

for (const theme of ['light', 'dark'] as const) {
  test(`payment review actions fit 320px with readable touch targets in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const dialog = await proofDialog(page, 'application/pdf', pdf);
    await expect(dialog.getByRole('link', { name: 'Abrir comprobante PDF', exact: true })).toBeVisible();
    for (const name of ['Cerrar', 'Rechazar', 'Llegó un monto distinto', 'Confirmar recibido']) {
      const button = dialog.getByRole('button', { name, exact: true });
      const rect = await button.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.width).toBeGreaterThanOrEqual(44);
      expect(rect!.height).toBeGreaterThanOrEqual(44);
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
      const height = await button.evaluate((node) => ({ content: node.scrollHeight, client: node.clientHeight }));
      expect(height.content).toBeLessThanOrEqual(height.client + 1);
    }
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
    const box = await dialog.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });
}

test('push health distinguishes registered devices from provider acceptance and physical delivery', async ({ page }) => {
  await page.route('**/rest/v1/rpc/push_health', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      devices: 3, sent_24h: 4, failed_24h: 1, confirmed_24h: 2, rejected_24h: 1,
      stuck: 1, credentials_error: new Date().toISOString(),
    }),
  }));
  await signIn(page, 'admin@example.com');
  await page.goto('/admin');
  const card = page.getByTestId('push-health');
  await expect(card.getByText('dispositivos registrados', { exact: true })).toBeVisible();
  await expect(card.getByText('Aceptados por Apple o Google', { exact: true })).toBeVisible();
  await expect(card.getByText(/teléfonos? recibe[n]? avisos/)).toHaveCount(0);
  await expect(card.getByText('Credenciales de avisos rechazadas', { exact: true })).toBeVisible();
  await expect(card.getByText(/Ningún teléfono recibe avisos/)).toHaveCount(0);
});

test.describe('before hydration', () => {
  test.use({ javaScriptEnabled: false });
  test('panel login never puts credentials in the URL when JavaScript is unavailable', async ({ page }) => {
    let submitted: { method: string; url: string } | undefined;
    await page.route('**/login', (route) => {
      const request = route.request();
      if (request.method() === 'GET') return route.continue();
      submitted = { method: request.method(), url: request.url() };
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Solicitud interceptada localmente</p>' });
    });
    await page.goto('/login');
    await page.locator('input[name=email]').fill('credential-url-fixture@example.com');
    await page.locator('input[name=password]').fill('Fixture-not-a-real-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect.poll(() => submitted?.method).toBe('POST');
    expect(new URL(submitted!.url).search).toBe('');
    expect(new URL(page.url()).search).toBe('');
  });
});
