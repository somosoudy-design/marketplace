import { test, expect } from '@playwright/test';
import { testUnpaidOrder } from './fixtures';
import { newBuyer } from '../tests/support/db';
test.beforeEach(async ({ context }) => {
  await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', (r) => r.abort('blockedbyclient'));
});
async function login(page: any, b: any) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(b.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(b.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
}
test('retry quote invokes same selected method once and recovers error', async ({ page }) => {
  const b = await testUnpaidOrder('premium-review-retry');
  await login(page, b);
  await page.goto('/pagar/' + b.orderId);
  await page.getByRole('radio', { name: /Pago Móvil/ }).check();
  let requests: any[] = [];
  await page.route('**/rpc/create_payment_quote', async (r) => {
    requests.push(r.request().postDataJSON());
    if (requests.length === 1) await r.abort('failed');
    else await r.continue();
  });
  await page.getByRole('button', { name: 'Consultar importe a pagar' }).click();
  await expect(page.getByRole('button', { name: 'Volver a intentar' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect.poll(() => requests.length, { timeout: 5000 }).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect(page.getByRole('heading', { name: 'Pago Móvil', exact: true })).toBeVisible();
  await expect(page.getByText('Importe a pagar', { exact: true })).toBeVisible();
});
test('retry address deletion confirms the same address again and persists only that deletion', async ({ page }) => {
  const b = await newBuyer('premium-review-delete');
  await login(page, b);
  await page.goto('/direcciones');
  let confirmations = 0;
  page.on('dialog', async (d) => {
    confirmations++;
    await d.accept();
  });
  let attempts = 0;
  await page.route('**/rest/v1/addresses*', async (r) => {
    if (r.request().method() === 'DELETE') {
      attempts++;
      if (attempts === 1) {
        await r.abort('failed');
        return;
      }
    }
    await r.continue();
  });
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Volver a intentar' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a intentar' }).click();
  await expect.poll(() => attempts, { timeout: 5000 }).toBe(2);
  expect(confirmations).toBe(2);
  await expect(page.getByText('Añade una dirección para consultar las opciones de entrega.')).toBeVisible();
});
test('mobile account access retains accessible name', async ({ page }) => {
  await page.goto('/cuenta');
  const nav = page.getByRole('navigation', { name: 'Tu cuenta', exact: true });
  await expect(nav.getByRole('link', { name: 'Ingresar', exact: true })).toBeVisible();
});
for (const surface of ['registro'] as const)
  test(`native form submission ${surface} never puts credentials in URL`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const target = surface === 'panel' ? 'http://127.0.0.1:3100/login' : 'http://127.0.0.1:3200/registro';
    await page.goto(target);
    if (surface === 'panel') {
      await page.getByLabel('Correo', { exact: true }).fill('audit-fake-only@example.com');
      await page.getByLabel('Contraseña', { exact: true }).fill('Audit-Fake-Not-A-Credential');
    } else {
      await page.getByLabel('Nombre y apellido').fill('Fixture Local');
      await page.getByLabel('Correo electrónico').fill('audit-fake-only@example.com');
      await page.getByLabel('Contraseña', { exact: true }).fill('Audit-Fake-Not-A-Credential');
    }
    const form = page.locator('form').filter({ has: page.locator('input[type=password]') });
    await expect(form).toHaveAttribute('method', 'post');
    let submitted = false,
      post = false,
      clean = false;
    await context.route(target + '**', async (r) => {
      submitted = true;
      post = r.request().method() === 'POST';
      const u = new URL(r.request().url());
      clean = u.search === '' && !u.href.includes('audit-fake') && !u.href.includes('Credential');
      await r.fulfill({ status: 200, contentType: 'text/html', body: '<main>Submission intercepted locally</main>' });
    });
    await form.getByRole('button', { name: surface === 'panel' ? 'Entrar' : 'Crear cuenta', exact: true }).click();
    await expect.poll(() => submitted).toBe(true);
    expect(post).toBe(true);
    expect(clean).toBe(true);
    await context.close();
  });
test('storefront account without JS exposes no credential-bearing GET form', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3200/cuenta');
  const unsafe = page.locator('form:not([method=post])').filter({ has: page.locator('input[type=password]') });
  await expect(unsafe).toHaveCount(0);
  await context.close();
});
import { testCartProduct, hideCartProduct } from './fixtures';
test('a second purchase through client navigation opens a fresh checkout', async ({ page }) => {
  const b = await testCartProduct('premium-repeat-buy');
  try {
    await login(page, b);
    await page.goto('/p/' + b.slug);
    await page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
    await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Tu cuenta', exact: true })
      .getByRole('link', { name: /^Carrito/ })
      .click();
    await page.getByTestId('cart-checkout').click();
    for (let n = 0; n < 4; n++) {
      await expect(page.getByTestId('checkout-next')).toBeEnabled();
      await page.getByTestId('checkout-next').click();
    }
    await expect(page).toHaveURL(/\/pagar\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/carrito$/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp('/p/' + b.slug));
    await page.getByRole('button', { name: 'Agregar al carrito', exact: true }).click();
    await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Tu cuenta', exact: true })
      .getByRole('link', { name: /^Carrito/ })
      .click();
    await expect(page.getByTestId('cart-checkout')).toBeVisible();
    await page.getByTestId('cart-checkout').click();
    await expect(page.getByRole('heading', { name: 'Dirección de entrega', exact: true })).toBeVisible();
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    await expect(page.getByRole('heading', { name: /Pedido .* creado/ })).toHaveCount(0);
  } finally {
    await hideCartProduct(b.productId);
  }
});
import pg from 'pg';
import { databaseUrl } from '../tests/support/db';
test('inbox pagination does not duplicate notices when a new notice arrives between pages', async ({ page }) => {
  const buyer = await newBuyer('premium-inbox-concurrent');
  const url = databaseUrl();
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('Exact loopback required');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(
      `insert into notifications(user_id,kind,title,body,is_test,push_status,created_at)
    select $1,'system','Revisión aviso '||n,'Información de tu compra',true,'skipped',now()-n*interval '1 minute'
    from generate_series(1,55) n`,
      [buyer.id],
    );
    await login(page, buyer);
    await page.goto('/notificaciones');
    await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(50);
    await db.query(
      `insert into notifications(user_id,kind,title,body,is_test,push_status)
    values ($1,'system','Aviso recibido durante lectura','Información de tu compra',true,'skipped')`,
      [buyer.id],
    );
    await page.getByRole('button', { name: 'Ver más notificaciones', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ver más notificaciones', exact: true })).toHaveCount(0);
    const ids = await page
      .locator('[data-testid^="notification-"]')
      .evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
    expect(new Set(ids).size).toBe(ids.length);
    await page.getByRole('button', { name: 'Actualizar notificaciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Aviso recibido durante lectura', exact: true })).toBeVisible();
    await expect(page.locator('[data-testid^="notification-"]')).toHaveCount(56);
  } finally {
    await db.end();
  }
});
