import { expect, test } from '@playwright/test';
import { canSignIn, emailLink } from './support/auth';
import { newBuyer } from './support/db';

// The links in Supabase Auth emails open screens of the app (kora://reset-password, kora://auth-callback on a
// phone; the same paths on the web build), instead of ending on a page the buyer cannot use.

test('the reset-password email lets the buyer choose a new password, once', async ({ page }) => {
  const b = await newBuyer('ui-reset');
  const link = await emailLink('recovery', b.email, 'http://127.0.0.1:8089/reset-password');

  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByTestId('reset-password').fill('corta1');
  await expect(page.getByText('Mínimo 8 caracteres').first()).toBeVisible();
  await page.getByTestId('reset-password').fill('Nueva-clave-2026');
  await page.getByTestId('reset-password-repeat').fill('Nueva-clave-2025');
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await page.getByTestId('reset-password-repeat').fill('Nueva-clave-2026');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByTestId('reset-done')).toBeVisible();
  await expect(page.getByText('Contraseña actualizada')).toBeVisible();

  expect(await canSignIn(b.email, 'Nueva-clave-2026')).toBe(true);
  expect(await canSignIn(b.email, b.password)).toBe(false);

  // the same link a second time is refused, and the screen offers a new one
  await page.goto(link);
  await expect(page.getByTestId('reset-link-invalid')).toBeVisible();
  await page.getByText('Pedir otro enlace').click();
  await expect(page).toHaveURL(/forgot-password/);
});

test('opening the reset screen without a link explains where to open it', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByTestId('reset-link-invalid')).toBeVisible();
  await expect(page.getByText('Abre el enlace del correo en este teléfono')).toBeVisible();
});

test('the confirmation link signs the buyer in and says the account is ready', async ({ page }) => {
  const b = await newBuyer('ui-confirm');
  await page.goto(await emailLink('magiclink', b.email, 'http://127.0.0.1:8089/auth-callback'));
  await expect(page.getByTestId('confirm-done')).toBeVisible();
  await page.getByText('Empezar a comprar').click();
  await page.goto('/account');
  await expect(page.getByText(b.email).first()).toBeVisible();
});
