import { test, expect } from '@playwright/test';
import pg from 'pg';
import { newBuyer, databaseUrl, asOn } from '../tests/support/db';
import { testCartProduct, cleanupCartFixtures } from './fixtures';
test.afterEach(cleanupCartFixtures);

test('carrito distingue referencias, unidades y entregas; bloquea continuar durante cambio pendiente', async ({
  page,
}) => {
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  const buyer = await newBuyer('web-cart-interactions');
  const products = [];
  for (const sourceSlug of ['ugreen-cable-usb-c-100w', 'ugreen-nexode-30w', 'lampara-mesa-lino']) {
    products.push(await testCartProduct('web-count', { buyer, sourceSlug, addToCart: true, stock: 5 }));
  }
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    await asOn(db)(buyer.id, 'select public.cart_set_quantity($1, 2)', [products[0]!.variantId]);
  } finally {
    await db.end();
  }
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await page.goto('/carrito');
  await expect(page.locator('.section-heading')).toContainText('3 productos · 4 unidades');
  await expect(page.locator('.cart-group')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Carrito, 4 unidades' })).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let writes = 0;
  await page.route('**/rpc/cart_set_quantity', async (r) => {
    writes++;
    await held;
    await r.continue();
  });
  const row = page.getByTestId(`cart-line-${products[0]!.variantId}`);
  const action = page.getByTestId('cart-checkout');
  try {
    await row.getByRole('button', { name: /Aumentar cantidad/ }).click();
    await expect(action).toHaveAttribute('aria-disabled', 'true');
    await action.evaluate((n: HTMLElement) => n.click());
    await expect(page).toHaveURL(/\/carrito$/);
    expect(writes).toBe(1);
  } finally {
    release();
  }
  await expect(page.locator('.section-heading')).toContainText('3 productos · 5 unidades');
  await expect(action).toHaveAttribute('aria-disabled', 'false');
  await action.click();
  for (const title of ['Tus entregas', 'Plan de pago', 'Revisa tu pedido']) {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    await page.getByTestId('checkout-next').click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(page.locator('.checkout-products')).toHaveCount(1);
  await expect(page.locator('.checkout-products')).toContainText('3 productos · 5 unidades');
  await expect(page.locator('.checkout-products .review-line')).toHaveCount(3);
  await expect(page.locator('.checkout-products .delivery-block')).toHaveCount(2);
});
