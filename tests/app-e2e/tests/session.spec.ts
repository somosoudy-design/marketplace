import { expect, test } from '@playwright/test';
import { newBuyer } from './support/db';

// On Android the first APK with sealed sessions read its own session back with 16 extra bytes, so the session
// vanished right after signing in: the app still showed the account, the server answered "sign in", and the
// cart said to check the connection. Here the stored session disappears the same way while the app is open.

test('when the stored session is gone, the app says to sign in instead of blaming the connection', async ({ page }) => {
  const b = await newBuyer('ui-session');
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(b.email);
  await page.getByTestId('sign-in-password').fill(b.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/account');
  await expect(page.getByTestId('account-name')).toBeVisible();

  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
  });
  // in-app navigation (a reload would start over from storage): open a product and add it
  await page.getByRole('tab', { name: 'Inicio' }).click();
  await page.locator('[data-testid^="product-card-"]').first().click();
  await expect(page.getByTestId('product-title')).toBeVisible();
  await page.getByTestId('product-cta').click();
  await expect(page.getByText('Inicia sesión para continuar.')).toBeVisible();

  // the app falls back to the visitor's: adding works again, and the account tab offers to sign in
  await page.getByTestId('product-cta').click();
  await expect(page.getByTestId('added-to-cart')).toBeVisible();
  await page.getByTestId('product-back').click();
  await page.getByRole('tab', { name: 'Cuenta' }).click();
  await expect(page.getByTestId('account-sign-in')).toBeVisible();
  await expect(page.getByText(/Revisa tu conexión/)).toHaveCount(0);
});
