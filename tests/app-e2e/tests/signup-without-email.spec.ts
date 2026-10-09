import { expect, test } from '@playwright/test';
import { signUpWithoutEmail } from './support/auth';
import { inbox } from './support/mail';

// The test environment can run with "Confirm email" off while there is no SMTP (testers outside the Supabase
// organization get no email). Sign-up then returns a session: no code screen, the visitor's cart comes along.
// Runs only against a stack started that way: AUTH_AUTOCONFIRM=true pnpm stack:start (auth.spec covers the code).

test('with confirmation off, a visitor signs up and keeps shopping with the same cart, no email involved', async ({ page }) => {
  test.skip(!(await signUpWithoutEmail()), 'el servidor pide confirmar por correo (flujo con código: auth.spec)');
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await page.getByTestId('product-cta').click();
  await expect(page.getByTestId('added-to-cart')).toBeVisible();

  const email = `ui-sin-correo-${Date.now()}@example.com`;
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('Kevin Prueba');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill('Kora-prueba-2026');
  await page.getByTestId('sign-up-submit').click();
  await expect(page).not.toHaveURL(/sign-up|verify-email/);

  await page.getByRole('tab', { name: 'Carrito' }).click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText(/\$\s?9,00/);
  await expect(page.getByTestId('cart-continue')).not.toHaveText(/Iniciar sesión/);
  await page.getByRole('tab', { name: 'Cuenta' }).click();
  await expect(page.getByTestId('account-name')).toHaveText('Kevin Prueba');
  expect(await inbox(email)).toHaveLength(0);
});
