import { expect, test } from '@playwright/test';
import { buyerPaysInCash } from './api';
import { signIn } from './helpers';

test('a payment confirmed by the admin unlocks the delivery for the seller', async ({ page, browser, baseURL }) => {
  const { orderNumber } = await buyerPaysInCash('Casa Lumen');

  // Seller: the delivery is visible but locked until the payment is confirmed.
  const sellerContext = await browser.newContext({ baseURL, viewport: { width: 1360, height: 900 }, locale: 'es-VE' });
  const seller = await sellerContext.newPage();
  await signIn(seller, 'tiendas@example.com');
  await seller.goto('/vendedor/pedidos');
  const card = seller.locator('section').filter({ hasText: `Pedido ${orderNumber}` });
  await expect(card.getByText('Esperando pago').first()).toBeVisible();
  await expect(card.getByRole('button', { name: 'Actualizar estado' })).toHaveCount(0);

  // Admin: confirms the cash payment after checking it.
  await signIn(page, 'admin@example.com');
  await page.goto('/admin/pagos');
  const row = page.getByRole('row').filter({ hasText: orderNumber });
  await row.getByRole('button', { name: 'Revisar' }).click();
  await page.getByRole('button', { name: 'Confirmar recibido' }).click();
  await expect(page.getByText(/confirmado$/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: orderNumber })).toHaveCount(0);

  // Seller: now can move it forward.
  await seller.reload();
  await expect(card.getByText('Pago confirmado')).toBeVisible();
  await card.getByRole('button', { name: 'Actualizar estado' }).click();
  await seller.getByLabel('Nuevo estado').selectOption({ label: 'Preparando' });
  await seller.getByLabel('Nota para el cliente (opcional)').fill('Empacando tu pedido.');
  await seller.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByText('Preparando').first()).toBeVisible();
  await expect(card.getByText('Empacando tu pedido.')).toBeVisible();
  await sellerContext.close();
});

test('a seller creates a product that is published right away in a general category', async ({ page, browser, baseURL }) => {
  const title = `Cojín de lino prueba ${Date.now()}`;
  await signIn(page, 'tiendas@example.com');
  await page.goto('/vendedor/productos/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill(title);
  await page.getByLabel('Categoría').selectOption({ label: 'Hogar' });
  await page.getByLabel('Precio de la variante 1').fill('18.50');
  await page.getByLabel('Inventario de la variante 1').fill('4');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(page.getByText('Guardado y publicado.')).toBeVisible();
  await expect(page).toHaveURL(/\/vendedor\/productos\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Publicado').first()).toBeVisible();

  // The admin suspends it (with a reason the store sees) so the demo catalog stays as seeded.
  const admin = await (await browser.newContext({ baseURL, viewport: { width: 1360, height: 900 }, locale: 'es-VE' })).newPage();
  await signIn(admin, 'admin@example.com');
  await admin.goto('/admin/productos');
  await admin.getByRole('tab', { name: /^Publicado/ }).click();
  await admin.getByPlaceholder('Buscar por nombre').fill(title);
  await admin.getByRole('button', { name: title }).click();
  await admin.getByRole('button', { name: 'Suspender' }).click();
  await admin.getByLabel(/Motivo de la suspensión/).fill('Producto creado por una prueba automática.');
  await admin.getByRole('button', { name: 'Suspender' }).last().click();
  await expect(admin.getByRole('button', { name: title })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Producto suspendido')).toBeVisible();
  await expect(page.getByText('Producto creado por una prueba automática.').first()).toBeVisible();
});
