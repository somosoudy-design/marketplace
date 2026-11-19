import { expect, test } from '@playwright/test';

test('invalid fields explain the correction and changing access mode preserves checkout', async ({ page }) => {
  await page.goto('/sign-in?returnTo=%2Fcheckout');
  await expect(page.getByRole('heading', { name: 'Inicia sesión', exact: true })).toBeVisible();
  await page.getByTestId('sign-in-submit').click();
  await expect(page.getByTestId('sign-in-email')).toBeFocused();
  await expect(page.getByTestId('sign-in-email')).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await expect(page).toHaveURL(/sign-up\?returnTo=%2Fcheckout/i);
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByTestId('sign-up-name')).toBeFocused();
  await page.getByTestId('sign-up-name').fill('Ana Prueba');
  await page.getByTestId('sign-up-name').press('Enter');
  await expect(page.getByTestId('sign-up-email')).toBeFocused();
  await page.getByTestId('sign-up-email').fill('ana@example.com');
  await page.getByTestId('sign-up-email').press('Enter');
  const password = page.getByTestId('sign-up-password');
  await expect(password).toBeFocused();
  await password.fill('ocho2026');
  await expect(password).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(password).toHaveJSProperty('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(password).toHaveJSProperty('type', 'password');

  await page.getByRole('link', { name: 'Inicia sesión', exact: true }).click();
  await expect(page).toHaveURL(/sign-in\?returnTo=%2Fcheckout/i);
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
  await expect(page).toHaveURL(/forgot-password\?returnTo=%2Fcheckout/i);
});
