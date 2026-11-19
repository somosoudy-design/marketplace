// Only isolated loopback fixtures; no payment-method writes or remote provider calls.
import { test, expect, type Page, type Route } from '@playwright/test';
import pg from 'pg';
import { databaseUrl } from '../tests/support/db';
import { testCartProduct, testUnpaidOrder, cleanupCartFixtures } from './fixtures';

test.afterEach(cleanupCartFixtures);
test.beforeEach(async ({ context }) => {
  await context.route('https://*.supabase.co/**', (route) => route.abort('blockedbyclient'));
});

function localMethodRead(route: Route) {
  const url = new URL(route.request().url());
  return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && route.request().method() === 'GET';
}
async function emptyMethods(route: Route) {
  if (!localMethodRead(route)) return route.abort('blockedbyclient');
  return route.fulfill({ status: 200, json: [] });
}
async function login(page: Page, buyer: { email: string; password: string }) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible();
}
async function review(page: Page) {
  const buyer = await testCartProduct('web-method-availability', { addToCart: true });
  await login(page, buyer);
  await page.goto('/checkout');
  for (const heading of ['Tus entregas', 'Plan de pago', 'Revisa tu pedido']) {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    await page.getByTestId('checkout-next').click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  return buyer;
}
function creationCalls(page: Page) {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/rpc/place_order')) calls.push(request.url());
  });
  return calls;
}
async function expectCartRetained(buyer: Awaited<ReturnType<typeof testCartProduct>>) {
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select (select count(*)::int from orders where buyer_id=$1) as orders,
              (select quantity from cart_items where user_id=$1 and variant_id=$2) as quantity`,
      [buyer.id, buyer.variantId],
    );
    expect(rows[0]).toEqual({ orders: 0, quantity: 1 });
  } finally {
    await db.end();
  }
}

test('sin métodos activos no confirma ni vacía el carrito', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 320, height: 960 });
  await page.route('**/rest/v1/payment_methods*', emptyMethods);
  const calls = creationCalls(page);
  const buyer = await review(page);
  await expect(page.getByTestId('checkout-methods-unavailable')).toContainText('Tu carrito se conserva');
  await expect(page.getByTestId('checkout-next')).toBeDisabled();
  // A DOM click on a disabled button must still not start the mutation.
  await page.getByTestId('checkout-next').evaluate((button: HTMLButtonElement) => button.click());
  expect(calls).toEqual([]);
  await expectCartRetained(buyer);
  await page.screenshot({ path: info.outputPath('checkout-sin-metodos-dark-320.png'), fullPage: true });
});

test('métodos pendientes o fallidos bloquean confirmar y permiten comprobar de nuevo', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/rest/v1/payment_methods*', async (route) => {
    if (!localMethodRead(route)) return route.abort('blockedbyclient');
    await held;
    await route.abort('failed');
  });
  const calls = creationCalls(page);
  const buyer = await review(page);
  try {
    await expect(page.getByTestId('checkout-next')).toBeDisabled();
    await expect(page.getByTestId('checkout-methods-unavailable')).toContainText('Comprobando métodos');
  } finally {
    release();
  }
  await expect(page.getByTestId('checkout-methods-unavailable')).toContainText('No pudimos comprobar');
  await expect(page.getByTestId('checkout-next')).toBeDisabled();
  expect(calls).toEqual([]);
  await expectCartRetained(buyer);
  await page.unroute('**/rest/v1/payment_methods*');
  await page.getByRole('button', { name: 'Actualizar métodos', exact: true }).click();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  expect(calls).toEqual([]);
});

test('métodos que desaparecen justo antes de confirmar no crean el pedido', async ({ page }, info) => {
  const buyer = await review(page);
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  const calls = creationCalls(page);
  await page.route('**/rest/v1/payment_methods*', emptyMethods);
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('alert').filter({ hasText: 'No podemos confirmar el pedido' })).toContainText('No podemos confirmar el pedido sin un método de pago disponible');
  await expect(page.getByRole('heading', { name: 'Revisa tu pedido', exact: true })).toBeVisible();
  await expect(page.getByTestId('checkout-next')).toBeDisabled();
  expect(calls).toEqual([]);
  await expectCartRetained(buyer);
  expect(await page.evaluate((id) => sessionStorage.getItem(`checkout-intent:${id}`), buyer.id)).toBeNull();
  await page.screenshot({ path: info.outputPath('metodo-desactivado-antes-confirmacion-light.png'), fullPage: true });
});

test('cotización de método desactivado oculta instrucciones y no registra pago', async ({ page }, info) => {
  const buyer = await testUnpaidOrder('web-disabled-quote');
  await login(page, buyer);
  await page.goto('/pagar/' + buyer.orderId);
  await page.getByRole('radio', { name: /Pago Móvil/ }).check();
  await page.getByRole('button', { name: 'Consultar importe a pagar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Datos para pagar', exact: true })).toBeVisible();
  await page.getByLabel('Referencia del pago').fill('TEST-UNAVAILABLE-1234');
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' &&
        (/\/rpc\/submit_payment(?:\?|$)/.test(request.url()) ||
         request.url().includes('/functions/v1/payments-start') ||
         request.url().includes('/storage/v1/object/payment-proofs/'))) writes.push(request.url());
  });
  await page.route('**/rest/v1/payment_methods*', emptyMethods);
  await page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true }).click();
  await expect(page.getByTestId('payment-method-unavailable')).toContainText('Tu pedido se conserva');
  await expect(page.getByRole('heading', { name: 'Datos para pagar', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Referencia del pago')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ya pagué, enviar para verificar', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const { rows } = await db.query(
      `select o.paid_usd, (select count(*)::int from payments p where p.order_id=o.id) as payments
         from orders o where o.id=$1`, [buyer.orderId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].paid_usd)).toBe(0);
    expect(rows[0].payments).toBe(0);
  } finally {
    await db.end();
  }
  await page.screenshot({ path: info.outputPath('cotizacion-metodo-desactivado-light.png'), fullPage: true });
});

// Insertar en payment-availability.spec.ts: reutiliza review, creationCalls,
// emptyMethods, localMethodRead y expectCartRetained. Sólo stack local.
test('primer intento sin métodos y lectura de pedido fallida no finge un pedido incierto', async ({ page }) => {
  const buyer = await review(page);
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  const writes = creationCalls(page);
  const lookups: string[] = [];
  await page.route('**/rest/v1/payment_methods*', emptyMethods);
  await page.route('**/rest/v1/orders*', async (route) => {
    if (!localMethodRead(route)) return route.abort('blockedbyclient');
    lookups.push(route.request().url());
    return route.abort('failed');
  });
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('alert').filter({ hasText: 'No podemos confirmar el pedido' })).toContainText('No podemos confirmar el pedido sin un método de pago disponible');
  await expect(page.getByRole('heading', { name: 'Revisa tu pedido', exact: true })).toBeVisible();
  await expect(page.getByTestId('checkout-recovery')).toHaveCount(0);
  await expect(page.getByTestId('checkout-next')).toBeDisabled();
  expect(writes).toEqual([]);
  expect(lookups).toEqual([]);
  await expectCartRetained(buyer);
  expect(await page.evaluate((id) => sessionStorage.getItem(`checkout-intent:${id}`), buyer.id)).toBeNull();
});

test('intento restaurado conserva clave y recuperación si métodos desaparecen y lookup aún no encuentra el pedido', async ({ page }) => {
  const buyer = await review(page);
  let placed = '';
  const writes = creationCalls(page);
  let lookupMode: 'failed' | 'empty' | 'real' = 'failed';
  await page.route('**/rpc/place_order', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return route.abort('blockedbyclient');
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    placed = (await response.json()).order_id;
    await route.abort('failed');
  });
  await page.route('**/rest/v1/orders*', async (route) => {
    if (!localMethodRead(route)) return route.abort('blockedbyclient');
    if (!new URL(route.request().url()).searchParams.has('idempotency_key')) return route.continue();
    if (lookupMode === 'failed') return route.abort('failed');
    if (lookupMode === 'empty') return route.fulfill({ status: 200, json: null });
    return route.continue();
  });
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('heading', { name: 'Comprobemos tu pedido', exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  const original = await page.evaluate((id) => sessionStorage.getItem(`checkout-intent:${id}`), buyer.id);
  expect(original).not.toBeNull();
  expect(JSON.parse(original!)).not.toHaveProperty('newAttempt');

  // The server read can lag or be temporarily incomplete after a transmitted RPC.
  // An empty read cannot authorize deleting the previous idempotency key.
  lookupMode = 'empty';
  await page.route('**/rest/v1/payment_methods*', emptyMethods);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comprobemos tu pedido', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar pedido', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reintentar confirmación', exact: true })).toBeEnabled();
  const retryLookup = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/rest/v1/orders') && url.searchParams.has('idempotency_key');
  });
  await page.getByRole('button', { name: 'Reintentar confirmación', exact: true }).click();
  await retryLookup;
  await expect(page.getByRole('heading', { name: 'Comprobemos tu pedido', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Comprobar pedido', exact: true })).toBeEnabled();
  expect(await page.evaluate((id) => sessionStorage.getItem(`checkout-intent:${id}`), buyer.id)).toBe(original);
  expect(writes).toHaveLength(1);

  // Once the recorded order becomes readable it must recover even with methods[].
  lookupMode = 'real';
  await page.getByRole('button', { name: 'Comprobar pedido', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/pagar/' + placed));
  expect(writes).toHaveLength(1);
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const { rows } = await db.query('select count(*)::int as orders from orders where buyer_id=$1', [buyer.id]);
    expect(rows[0].orders).toBe(1);
  } finally {
    await db.end();
  }
});
