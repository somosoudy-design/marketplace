import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { asOn, databaseUrl, unpaidOrderFor } from './support/db';

const fixtures: Awaited<ReturnType<typeof unpaidOrderFor>>[] = [];
async function orderFor(label: string) {
  const buyer = await unpaidOrderFor(label);
  fixtures.push(buyer);
  return buyer;
}
// Release only this test's local reservations, so repeated runs do not exhaust the demo item.
test.afterEach(async () => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    for (const buyer of fixtures.splice(0)) await asOn(client)(buyer.userId, 'select public.cancel_order($1, $2)', [buyer.orderId, 'Fin de prueba local de interfaz']);
  } finally { await client.end(); }
});

async function signIn(page: Page, buyer: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`marketplace quality ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 } });

    test('enlace de pago pide sesión y vuelve al mismo pedido', async ({ page }) => {
      const buyer = await orderFor('ui-quality-session');
      await page.goto(`/pay/${buyer.orderId}`);
      await expect(page.getByText('Inicia sesión para ver tu pedido', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
      await page.getByTestId('sign-in-email').fill(buyer.email);
      await page.getByTestId('sign-in-password').fill(buyer.password);
      await page.getByTestId('sign-in-submit').click();
      await expect(page).toHaveURL(new RegExp(`/pay/${buyer.orderId}$`));
      await expect(page.getByTestId('method-pago_movil')).toBeVisible();
    });

    test('pedido inexistente o ajeno termina en estado seguro con salida', async ({ page }) => {
      const buyer = await orderFor('ui-quality-null');
      const other = await orderFor('ui-quality-other');
      await signIn(page, buyer);
      for (const id of ['00000000-0000-4000-a000-000000000099', other.orderId]) {
        await page.goto(`/pay/${id}`);
        await expect(page.getByText('Este pedido no está disponible', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ver mis pedidos', exact: true })).toBeVisible();
        await expect(page.getByTestId('pay-outstanding')).toHaveCount(0);
        await expect(page.getByTestId('pay-quote')).toHaveCount(0);
      }
    });

    test('métodos de pago explican el fallo y permiten recuperar sin crear cotización', async ({ page }, info) => {
      const buyer = await orderFor('ui-quality-methods');
      let fail = true;
      let quotes = 0;
      await page.route('**/rest/v1/payment_methods*', (r) => fail ? r.abort('failed') : r.continue());
      await page.route('**/rest/v1/rpc/create_payment_quote', (r) => { quotes++; return r.abort(); });
      await signIn(page, buyer);
      await page.goto(`/pay/${buyer.orderId}`);
      await expect(page.getByText(/No pudimos cargar los métodos de pago/)).toBeVisible();
      await expect(page.getByTestId('pay-quote')).toBeDisabled();
      await page.screenshot({ path: info.outputPath('payment-methods-error.png') });
      fail = false;
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await expect(page.getByTestId('method-pago_movil')).toBeVisible();
      await page.getByTestId('method-pago_movil').click();
      await expect(page.getByTestId('pay-quote')).toBeEnabled();
      expect(quotes).toBe(0);
    });

    test('confirmación sensible permanece visible al esperar y recupera el error', async ({ page }) => {
      const buyer = await orderFor('ui-quality-confirm');
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let calls = 0;
      await page.route('**/rest/v1/rpc/cancel_order', async (r) => {
        calls++;
        await held;
        await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'No se pudo cancelar. Intenta de nuevo.', hint: 'invalid_state' }) });
      });
      try {
        await signIn(page, buyer);
        await page.goto(`/orders/${buyer.orderId}`);
        await page.getByTestId('order-cancel').click();
        const sheet = page.getByTestId('order-cancel-sheet');
        await sheet.getByTestId('order-cancel-sheet-confirm').click();
        await expect.poll(() => calls).toBe(1);
        await expect(sheet.getByRole('button', { name: 'Conservar el pedido', exact: true })).toBeDisabled();
        await expect(sheet.getByTestId('order-cancel-sheet-close')).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(sheet).toBeVisible();
        release();
        await expect(sheet.getByRole('alert')).toBeVisible();
        await expect(sheet.getByTestId('order-cancel-sheet-close')).toBeEnabled();
        await sheet.getByRole('button', { name: 'Conservar el pedido', exact: true }).click();
        await expect(sheet).not.toBeVisible();
        await expect(page.getByTestId('order-pay')).toBeEnabled();
        expect(calls).toBe(1);
      } finally { release(); }
    });

    test('compartir producto copia un enlace válido y abre la misma ficha', async ({ page, context, baseURL }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
      await page.goto('/p/ugreen-cable-usb-c-100w');
      await expect(page.getByTestId('product-title')).toBeVisible();
      await page.getByTestId('product-share').click();
      const link = `${baseURL}/p/ugreen-cable-usb-c-100w`;
      await expect(page.getByTestId('product-share-link')).toHaveText(link);
      await page.getByTestId('product-share-copy').click();
      await expect(page.getByTestId('product-share-copy')).toHaveText('Enlace copiado');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
      const other = await context.newPage();
      await other.goto(link);
      await expect(other.getByTestId('product-title')).toContainText('UGREEN cable');
    });
  });
}
