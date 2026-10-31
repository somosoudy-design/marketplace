import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { asOn, databaseUrl, newBuyer } from './support/db';
import { checkoutToReview } from './support/checkout';

const buyers: Awaited<ReturnType<typeof newBuyer>>[] = [];
test.afterEach(async () => {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    for (const buyer of buyers.splice(0)) {
      const { rows } = await client.query('select id from public.orders where buyer_id=$1', [buyer.id]);
      for (const row of rows) await asOn(client)(buyer.id, 'select public.cancel_order($1,$2)', [row.id, 'Fin de prueba local de recuperación de compra']);
    }
  } finally { await client.end(); }
});

async function review(page: Page) {
  const buyer = await newBuyer('ui-checkout-recovery'); buyers.push(buyer);
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await page.getByTestId('product-cta').click();
  await page.getByTestId('cart-continue').click();
  await checkoutToReview(page);
  return buyer;
}

async function ownOrderIds(buyerId: string) {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try { return (await client.query('select id from public.orders where buyer_id=$1', [buyerId])).rows.map((row) => row.id as string); }
  finally { await client.end(); }
}

const lookup = (url: string) => {
  const parsed = new URL(url);
  return parsed.pathname.endsWith('/rest/v1/orders') && parsed.searchParams.has('idempotency_key');
};

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`confirmación interrumpida ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 320, height: 780 } });

    test('recupera exactamente el pedido creado aunque se pierda la respuesta y el carrito se vacíe', async ({ page }, info) => {
      const buyer = await review(page);
      const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
      let placedId = ''; let calls = 0; let intent = '';
      const reads: URL[] = [];
      page.on('request', (request) => { if (lookup(request.url())) reads.push(new URL(request.url())); });
      await page.route('**/rpc/place_order', async (route) => {
        calls++; intent = route.request().postDataJSON().p_idempotency_key;
        const response = await route.fetch(); expect(response.ok()).toBe(true);
        placedId = (await response.json()).order_id;
        await route.abort('failed');
      });
      await page.getByTestId('checkout-place').click();
      await expect(page).toHaveURL(/\/pay\//);
      await expect(page.getByTestId('method-pago_movil')).toBeVisible();
      expect(page.url()).toContain(`/pay/${placedId}`);
      expect(calls).toBe(1);
      expect(reads).toHaveLength(1);
      expect(reads[0]!.searchParams.get('buyer_id')).toBe(`eq.${buyer.id}`);
      expect(reads[0]!.searchParams.get('idempotency_key')).toBe(`eq.${intent}`);
      expect(await ownOrderIds(buyer.id)).toEqual([placedId]);
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath('pedido-recuperado-pago.png') });
    });

    test('comprobar sólo consulta; recupera tras fallar la lectura sin volver a crear la compra', async ({ page }, info) => {
      const buyer = await review(page);
      let calls = 0; let unavailable = true; let placedId = '';
      await page.route('**/rpc/place_order', async (route) => {
        calls++; const response = await route.fetch(); placedId = (await response.json()).order_id; await route.abort('failed');
      });
      await page.route('**/rest/v1/orders*', (route) => lookup(route.request().url()) && unavailable ? route.abort('failed') : route.continue());
      await page.getByTestId('checkout-place').click();
      const recovery = page.getByTestId('checkout-recovery');
      await expect(recovery).toBeVisible();
      await expect(page.getByText('Tu carrito está vacío', { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('checkout-retry-confirmation')).toHaveCount(0);
      await page.getByTestId('checkout-check-order').click();
      await expect(recovery).toContainText('No pudimos consultar tu pedido');
      expect(calls).toBe(1);
      await page.screenshot({ path: info.outputPath('confirmacion-sin-conexion.png') });
      unavailable = false;
      await page.getByTestId('checkout-check-order').click();
      await expect(page).toHaveURL(new RegExp(`/pay/${placedId}`));
      await expect(page.getByTestId('method-pago_movil')).toBeVisible();
      expect(calls).toBe(1);
      expect(await ownOrderIds(buyer.id)).toEqual([placedId]);
    });

    test('si no llegó la primera solicitud, reintenta con idéntica intención y selección y crea un solo pedido', async ({ page }) => {
      const buyer = await review(page);
      const attempts: Record<string, unknown>[] = [];
      await page.route('**/rpc/place_order', (route) => {
        attempts.push(route.request().postDataJSON());
        return attempts.length === 1 ? route.abort('failed') : route.continue();
      });
      await page.getByTestId('checkout-place').click();
      await expect(page.getByTestId('checkout-recovery')).toBeVisible();
      await page.getByTestId('checkout-check-order').click();
      await expect(page.getByTestId('checkout-retry-confirmation')).toBeVisible();
      expect(attempts).toHaveLength(1);
      await page.getByTestId('checkout-retry-confirmation').click();
      await expect(page).toHaveURL(/\/pay\//);
      await expect(page.getByTestId('method-pago_movil')).toBeVisible();
      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toEqual(attempts[0]);
      expect(await ownOrderIds(buyer.id)).toHaveLength(1);
    });
  });
}

for (const payload of [null, {}, { order_id: 'not-a-uuid', number: 'P-invalid' }]) {
  test(`una respuesta incompleta ${JSON.stringify(payload)} recupera el pedido real antes de navegar`, async ({ page }) => {
    const buyer = await review(page); let placedId = '';
    await page.route('**/rpc/place_order', async (route) => {
      const response = await route.fetch(); placedId = (await response.json()).order_id;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await page.getByTestId('checkout-place').click();
    await expect(page).toHaveURL(/\/pay\//);
    await expect(page.getByTestId('method-pago_movil')).toBeVisible();
    expect(page.url()).toContain(`/pay/${placedId}`);
    expect(await ownOrderIds(buyer.id)).toEqual([placedId]);
  });
}

test('la recuperación permite consultar mis pedidos sin que el guard de las fases bloquee la salida', async ({ page }) => {
  await review(page);
  await page.route('**/rpc/place_order', async (route) => { await route.fetch(); await route.abort('failed'); });
  await page.route('**/rest/v1/orders*', (route) => lookup(route.request().url()) ? route.abort('failed') : route.continue());
  await page.getByTestId('checkout-place').click();
  await expect(page.getByTestId('checkout-recovery')).toBeVisible();
  await page.getByTestId('checkout-view-orders').click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('[data-testid^="order-P-"]')).toHaveCount(1);
});
