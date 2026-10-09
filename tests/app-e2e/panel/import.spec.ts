import { expect, test } from '@playwright/test';
import { PNG, signIn } from './helpers';

test('admin completes a manual import: rights confirmation is required and the product lands in moderation', async ({ page }) => {
  const ts = Date.now();
  const title = `Lámpara importada de prueba ${ts}`;
  await signIn(page, 'admin@example.com');
  await page.goto('/admin/importar');

  await page.getByLabel('Enlace del producto').fill(`https://www.amazon.com/dp/B0PRUEBA${ts}`);
  await page.getByRole('button', { name: 'Leer página' }).click();
  await expect(page.getByText('Este sitio se carga a mano')).toBeVisible();

  await page.getByLabel('Título', { exact: true }).fill(title);
  await page.getByLabel('Categoría').selectOption({ label: 'Tecnología › Cargadores' });
  await page.getByLabel('Nuestro precio de venta (USD)').fill('19.90');
  await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });

  const create = page.getByRole('button', { name: 'Crear producto en moderación' });
  await create.click();
  await expect(page.getByText('Confirma los derechos de uso de cada imagen incluida')).toBeVisible();

  await page.getByLabel('Confirmo derechos de uso').check();
  await create.click();
  await expect(page.getByText('Producto creado y enviado a moderación')).toBeVisible();
  await expect(page.getByRole('row', { name: /amazon\.com/ }).first().getByText('Producto creado')).toBeVisible();

  // The new product waits in the moderation queue; reject it so the queue stays clean.
  await page.goto('/admin/productos');
  await page.getByPlaceholder('Buscar por nombre').fill(String(ts));
  await page.getByRole('button', { name: title }).click();
  await page.getByRole('button', { name: 'Rechazar' }).click();
  await page.getByLabel(/Motivo del rechazo/).fill('Prueba automática del importador.');
  await page.getByRole('button', { name: /^Rechazar/ }).last().click();
  await expect(page.getByRole('button', { name: title })).toHaveCount(0);
});
