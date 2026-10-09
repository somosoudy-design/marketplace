import { expect, test } from '@playwright/test';
import { forgetImports, settingsSnapshot } from '../tests/support/db';
import { signIn } from './helpers';

// Parameters are edited with forms that say what each value means and refuse what the database would refuse;
// the import pricing rule feeds a suggested price in the importer only once an operator marks it as reviewed.

test('parameters are edited with forms that explain each value and refuse invalid ones', async ({ page }) => {
  const restore = await settingsSnapshot(['claims.seller_response_hours', 'orders.number_prefix']);
  try {
    await signIn(page, 'admin@example.com');
    await page.goto('/admin/configuracion?tab=settings');
    const sellers = page.getByTestId('settings-sellers');
    const hours = page.getByTestId('setting-claims');
    await expect(hours).toHaveValue('48');
    await expect(sellers.getByText('Si la tienda no responde en 2 días')).toBeVisible();

    await hours.fill('48 horas');
    await expect(sellers.getByText('Escribe un número entero, sin decimales.')).toBeVisible();
    await expect(page.getByTestId('settings-save-sellers')).toBeDisabled();
    await hours.fill('900');
    await expect(sellers.getByText('Entre 1 y 720.')).toBeVisible();
    await hours.fill('72');
    await expect(sellers.getByText('Si la tienda no responde en 3 días')).toBeVisible();
    await expect(sellers.getByText('1 cambio sin guardar')).toBeVisible();
    await page.getByTestId('settings-save-sellers').click();
    await expect(page.getByText('Vendedores y reclamos: cambios guardados')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('setting-claims')).toHaveValue('72');

    // the order prefix is typed in capitals, previewed, and can be discarded
    const orders = page.getByTestId('settings-orders');
    await page.getByTestId('setting-prefix').fill('kr');
    await expect(page.getByTestId('setting-prefix')).toHaveValue('KR');
    await expect(orders.getByText('KR-100245')).toBeVisible();
    await orders.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByTestId('setting-prefix')).toHaveValue('P');
  } finally {
    await restore();
  }
});

test('the importer suggests a price only after the pricing rule is reviewed', async ({ page }) => {
  const restore = await settingsSnapshot(['pricing.import']);
  const base = `https://www.amazon.com/dp/B0SUGERIDO${Date.now()}`;
  try {
    await signIn(page, 'admin@example.com');
    const openDraft = async (n: number) => {
      await page.goto('/admin/importar');
      await page.getByLabel('Enlace del producto').fill(`${base}${n}`);
      await page.getByRole('button', { name: 'Leer página' }).click();
      await expect(page.getByText('Este sitio se carga a mano')).toBeVisible();
    };
    await openDraft(1);
    await expect(page.getByTestId('import-suggestion')).toContainText('la regla de precio aún no está revisada');

    // the operator reviews the rule: 30 % margin, 10 USD per kg, 2 USD handling, prices ending in ,99
    await page.goto('/admin/configuracion?tab=settings');
    await page.getByTestId('setting-per-kg').fill('10');
    await page.getByTestId('setting-fixed').fill('2');
    await page.getByRole('switch', { name: 'Regla revisada y lista para usar' }).click();
    await expect(page.getByTestId('pricing-preview')).toContainText('$33,99');
    await page.getByTestId('settings-save-pricing').click();
    await expect(page.getByText('Precio sugerido para importaciones: cambios guardados')).toBeVisible();

    await openDraft(2);
    await expect(page.getByTestId('import-suggestion')).toContainText('Escribe el costo');
    await page.getByTestId('import-cost').fill('40');
    // 40 + 12 margin + 5 freight (0,5 kg) + 2 handling = 59 -> 59,99
    await expect(page.getByTestId('import-suggestion')).toContainText('$59,99');
    await page.getByTestId('import-use-suggestion').click();
    await expect(page.getByLabel('Nuestro precio de venta (USD)')).toHaveValue('59.99');
    await expect(page.getByTestId('import-suggestion')).toContainText('En uso');
  } finally {
    await restore();
    await forgetImports(base);
  }
});
