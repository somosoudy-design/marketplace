import { expect, test } from '@playwright/test';

test('the version line opens a diagnostics screen without keys or tokens', async ({ page }) => {
  await page.goto('/account');
  await page.getByTestId('app-version').click();
  await expect(page).toHaveURL(/diagnostico/);
  await expect(page.getByTestId('diag-Backend')).toContainText('127.0.0.1:54321');
  await expect(page.getByTestId('diag-Conexión')).toContainText('responde');
  // the web keeps the browser's storage; phones seal the session with a keystore key
  await expect(page.getByTestId('diag-Sesión cifrada')).toContainText('no disponible');
  await expect(page.locator('body')).not.toContainText('eyJ');
});
