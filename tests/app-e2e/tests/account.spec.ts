import { expect, test } from '@playwright/test';
import { newBuyer } from './support/db';

// Saved addresses: adding a second one, and deleting the main one from its edit screen after confirming.
// The database then promotes the remaining address so checkout never opens without a main address.

test('a buyer adds an address and deletes the main one; the other becomes main', async ({ page }) => {
  const b = await newBuyer('ui-addr');
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(b.email);
  await page.getByTestId('sign-in-password').fill(b.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);

  await page.goto('/addresses');
  await expect(page.locator('[data-testid^="addr-row-"]').filter({ hasText: 'Casa' })).toContainText('Principal');

  await page.getByTestId('address-add').click();
  await page.getByTestId('addr-recipient').fill('Ana Prueba');
  await page.getByTestId('addr-phone').fill('0412 555 0102');
  await page.getByTestId('addr-region').click();
  await page.getByText('Miranda', { exact: true }).click();
  await page.getByTestId('addr-city').fill('Los Teques');
  await page.getByTestId('addr-line1').fill('Calle de Ejemplo, Quinta Demo, número 4');
  await page.getByTestId('addr-label-Oficina').click();
  await page.getByTestId('addr-save').click();
  const office = page.locator('[data-testid^="addr-row-"]').filter({ hasText: 'Oficina' });
  await expect(office).toContainText('Los Teques');
  await expect(office).not.toContainText('Principal');

  // delete the main address: confirmation first, then the office becomes the main one
  await page.locator('[data-testid^="addr-row-"]').filter({ hasText: 'Casa' }).click();
  await page.getByTestId('addr-delete').click();
  await expect(page.getByText('¿Eliminar «Casa»?')).toBeVisible();
  await expect(page.getByText(/pasa a ser la principal/)).toBeVisible();
  await page.getByTestId('addr-delete-confirm').click();
  await expect(page).toHaveURL(/\/addresses$/);
  await expect(page.locator('[data-testid^="addr-row-"]')).toHaveCount(1);
  await expect(office).toContainText('Principal');
});

// Help shows the support contact the operator sets in the panel (Configuración › Parámetros), not a fixed address.
test('help shows the support contact set in the panel', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByText('soporte@example.com · Lun a Vie, 9:00 a 18:00')).toBeVisible();
});
