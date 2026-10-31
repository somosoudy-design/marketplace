import { test, expect, type Page } from '@playwright/test';
import pg from 'pg';
import { databaseUrl, newBuyer, asOn } from '../tests/support/db';
import { testUnpaidOrder, testCartProduct, cleanupCartFixtures } from './fixtures';
test.afterEach(cleanupCartFixtures);
test.beforeEach(async ({ context }) => {
  await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', (route) => route.abort('blockedbyclient'));
});
async function login(page: Page, buyer: { email: string; password: string }) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
}
async function review(page: Page) {
  const buyer = await testCartProduct('web-purchase');
  await login(page, buyer);
  await page.goto('/p/' + buyer.slug);
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
  await page.goto('/carrito');
  await page.getByTestId('cart-checkout').click();
  await expect(page.getByRole('heading', { name: 'Dirección de entrega', exact: true })).toBeVisible();
  for (const next of ['Tus entregas', 'Plan de pago', 'Revisa tu pedido']) {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    await page.getByTestId('checkout-next').click();
    await expect(page.getByRole('heading', { name: next, exact: true })).toBeVisible();
  }
  return buyer;
}
for (const colorScheme of ['light', 'dark'] as const)
  for (const width of [320, 1440])
    test(`compra progresiva y pago manual ${width} ${colorScheme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 960 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const buyer = await review(page);
      await expect(page.getByRole('radio', { name: /Principal/ })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath('revision.png'), fullPage: true });
      await page.getByTestId('checkout-next').dblclick();
      await expect(page).toHaveURL(/\/pagar\//);
      await page.getByRole('radio', { name: /Pago Móvil/ }).check();
      await page.getByRole('button', { name: 'Consultar importe a pagar' }).click();
      await expect(page.getByRole('heading', { name: 'Pago Móvil', exact: true })).toBeVisible();
      await expect(page.getByText('Importe a pagar', { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath('pago.png'), fullPage: true });
      await page.getByLabel('Referencia del pago').fill(String(Date.now()).slice(-10));
      await page.getByRole('button', { name: 'Ya pagué, enviar para verificar' }).click();
      await expect(page.getByRole('heading', { name: /En verificación|Estamos verificando/ })).toBeVisible();
      await page.getByRole('link', { name: 'Ver mi pedido', exact: true }).last().click();
      await expect(page).toHaveURL(/\/pedidos\//);
      await expect(page.getByText('Tu pago está en revisión')).toBeVisible();
      await page.screenshot({ path: info.outputPath('pedido.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const db = new pg.Client({ connectionString: databaseUrl() });
      await db.connect();
      try {
        const { rows } = await db.query(
          'select o.id,o.payment_status,o.paid_usd,p.status from orders o join payments p on p.order_id=o.id where o.buyer_id=$1',
          [buyer.id],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('pending_verification');
        expect(Number(rows[0].paid_usd)).toBe(0);
      } finally {
        await db.end();
      }
      expect(errors).toEqual([]);
    });
test('respuesta perdida recupera mismo pedido incluso después de recargar', async ({ page }) => {
  const buyer = await review(page);
  let placed = '';
  await page.route('**/rpc/place_order', async (r) => {
    const response = await r.fetch();
    expect(response.ok()).toBe(true);
    placed = (await response.json()).order_id;
    await r.abort('failed');
  });
  await page.route('**/rest/v1/orders*', async (r) => {
    if (new URL(r.request().url()).searchParams.has('idempotency_key')) await r.abort('failed');
    else await r.continue();
  });
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('heading', { name: 'Comprobemos tu pedido' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comprobemos tu pedido' })).toBeVisible();
  await page.unroute('**/rest/v1/orders*');
  await page.getByRole('button', { name: 'Comprobar pedido', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/pagar/' + placed));
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    expect((await db.query('select count(*)::int n from orders where buyer_id=$1', [buyer.id])).rows[0].n).toBe(1);
  } finally {
    await db.end();
  }
});
test('preview fallido bloquea avance y permite reintentar', async ({ page }) => {
  const buyer = await testCartProduct('web-preview');
  await login(page, buyer);
  await page.goto('/p/' + buyer.slug);
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
  await page.route('**/rpc/checkout_preview', (r) => r.abort('failed'));
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-next')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Volver a intentar' })).toBeVisible();
  await page.unroute('**/rpc/checkout_preview');
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
});
test('administrador comprador no consulta dirección o pedido ajeno', async ({ page }) => {
  const foreign = await testUnpaidOrder('web-foreign');
  await login(page, { email: 'admin@example.com', password: 'Demo-1234' });
  await page.goto('/pedidos/' + foreign.orderId);
  await expect(page.getByRole('heading', { name: 'Este pedido no está disponible' })).toBeVisible();
  let scoped = '';
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/addresses?')) scoped = r.url();
  });
  await page.goto('/direcciones');
  await expect.poll(() => scoped).toContain('user_id=eq.');
  expect(scoped).not.toContain(foreign.userId);
});
test('crear editar y conservar dirección con error de guardado', async ({ page }) => {
  const buyer = await newBuyer('web-address');
  await login(page, buyer);
  await page.goto('/direcciones');
  await page.getByRole('button', { name: 'Agregar dirección' }).click();
  await page.getByLabel('Nombre de la dirección').fill('Oficina');
  await page.getByLabel('Quien recibe').fill('Ana Prueba');
  await page.getByLabel('Teléfono', { exact: true }).fill('0412 555 0101');
  await page.getByLabel('Estado', { exact: true }).selectOption('A');
  await page.getByLabel('Ciudad', { exact: true }).fill('Caracas');
  await page.getByLabel('Dirección', { exact: true }).fill('Avenida prueba edificio 5');
  await page.route('**/rest/v1/addresses*', (r) =>
    r.request().method() === 'POST' ? r.abort('failed') : r.continue(),
  );
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.locator('.commerce-form [role=alert]')).toBeVisible();
  await expect(page.getByLabel('Nombre de la dirección')).toHaveValue('Oficina');
  await page.unroute('**/rest/v1/addresses*');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await expect(page.getByRole('heading', { name: 'Oficina', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar', exact: true }).last().click();
  await page.getByLabel('Nombre de la dirección').fill('Oficina nueva');
  await page.getByRole('button', { name: 'Guardar dirección' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Oficina nueva' })).toBeVisible();
});

test('registro con código y recuperación real de contraseña', async ({ page }) => {
  const { emailCode } = await import('../tests/support/mail');
  const email = `web-register-${Date.now()}@example.com`;
  await page.goto('/registro');
  await page.getByLabel('Nombre y apellido').fill('Ana Prueba');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Kora-prueba-2026');
  let since = Date.now() - 1000;
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await page.getByLabel('Código de verificación').fill(await emailCode(email, since));
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  const fixtureDb = new pg.Client({ connectionString: databaseUrl() });
  await fixtureDb.connect();
  try {
    await fixtureDb.query('update profiles set is_demo=true where id=(select id from auth.users where email=$1)', [
      email,
    ]);
  } finally {
    await fixtureDb.end();
  }
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.goto('/recuperar');
  await page.getByLabel('Correo electrónico').fill(email);
  since = Date.now() - 1000;
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await page.getByLabel('Código de verificación').fill(await emailCode(email, since));
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page).toHaveURL(/cambiar=1/);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('Nueva-prueba-2026');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, { email, password: 'Nueva-prueba-2026' });
});

test('dos tiendas, volver conserva selección y cambiar dirección reinicia entrega', async ({ page }) => {
  const buyer = await newBuyer('web-two-stores');
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    const as = asOn(db);
    for (const sourceSlug of ['ugreen-cable-usb-c-100w', 'correa-reflectiva']) {
      await testCartProduct('web-multiple', { buyer, sourceSlug, addToCart: true });
    }
    await as(
      buyer.id,
      "insert into addresses(user_id,label,recipient,phone,region_code,city,line1) values(auth.uid(),'Oficina','Ana Prueba','0412 555 0101','A','Caracas','Avenida prueba oficina 5')",
    );
  } finally {
    await db.end();
  }
  await login(page, buyer);
  await page.goto('/checkout');
  await page.getByTestId('checkout-next').click();
  await expect(page.locator('.delivery-block')).toHaveCount(2);
  const radio = page.locator('.delivery-block').first().getByRole('radio').last();
  await radio.check();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('heading', { name: 'Plan de pago', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al paso anterior' }).click();
  await expect(radio).toBeChecked();
  await page.getByRole('button', { name: 'Volver al paso anterior' }).click();
  await page.getByRole('radio', { name: /Oficina/ }).check();
  await expect(page.getByRole('heading', { name: 'Dirección de entrega', exact: true })).toBeVisible();
  await page.getByTestId('checkout-next').click();
  await expect(page.locator('.delivery-block')).toHaveCount(2);
});
test('plan que deja de ser válido exige volver a revisarlo', async ({ page }) => {
  await review(page);
  let intercepts = 0;
  await page.route('**/rpc/checkout_preview', async (r) => {
    if (intercepts++ === 0)
      await r.fulfill({ status: 400, json: { code: 'P0001', message: 'Plan cambiado', hint: 'plan_invalid' } });
    else await r.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('heading', { name: 'Plan de pago', exact: true })).toBeVisible();
  await expect(
    page.getByText('El plan de pago cambió. Revisa el plan y los importes antes de confirmar.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar pedido', exact: true })).toHaveCount(0);
});

test('cambio de opciones de envío obliga a revisar la entrega', async ({ page }) => {
  await review(page);
  await page.getByRole('button', { name: 'Volver al paso anterior' }).click();
  await page.getByRole('button', { name: 'Volver al paso anterior' }).click();
  await page.locator('.delivery-block').first().getByRole('radio').last().check();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await page.getByTestId('checkout-next').click();
  await expect(page.getByRole('heading', { name: 'Revisa tu pedido', exact: true })).toBeVisible();
  let count = 0;
  await page.route('**/rpc/checkout_preview', async (r) => {
    if (count++ === 0)
      await r.fulfill({ status: 400, json: { code: 'P0001', message: 'Envío cambiado', hint: 'shipping_invalid' } });
    else await r.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('heading', { name: 'Tus entregas', exact: true })).toBeVisible();
  await expect(page.getByText('Las opciones de entrega cambiaron. Revísalas antes de continuar.')).toBeVisible();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await expect(page.getByText('Las opciones de entrega cambiaron. Revísalas antes de continuar.')).toHaveCount(0);
});
