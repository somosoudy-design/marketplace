import { expect, test } from '@playwright/test';
import { canSignIn, emailLink } from './support/auth';
import { newBuyer } from './support/db';
import { emailCode, inbox } from './support/mail';

// Accounts are confirmed, and passwords recovered, with the six-digit code Supabase Auth emails: the buyer never
// leaves the app and no link can land on a page they cannot use. Older emails with links still open app screens.

async function signUpForm(page: import('@playwright/test').Page, email: string) {
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('Ana Prueba');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill('Kora-prueba-2026');
  await page.getByTestId('sign-up-submit').click();
  await expect(page).toHaveURL(/verify-email/);
}

test('a new account is confirmed with the code from the email, and a wrong code is refused', async ({ page }) => {
  const email = `ui-otp-${Date.now()}@example.com`;
  const since = Date.now() - 1000;
  await signUpForm(page, email);
  await expect(page.getByText(email)).toBeVisible();
  const code = await emailCode(email, since);
  const [mail] = await inbox(email);
  expect(mail!.subject).toBe('Tu código de Kora');
  expect(mail!.text).not.toMatch(/localhost|http/);

  // nothing to resend yet: the countdown runs
  await expect(page.getByTestId('code-resend-wait')).toContainText(/Reenviar en 0:5\d|Reenviar en 1:00/);

  const wrong = code === '000000' ? '111111' : '000000';
  await page.getByTestId('code-input').fill(wrong);
  await expect(page.getByTestId('code-error')).toContainText('El código no es válido o ya venció');
  expect(await canSignIn(email, 'Kora-prueba-2026')).toBe(false);

  // pasting the whole email line keeps only the digits and confirms the account
  await page.getByTestId('code-input').fill(`Tu código: ${code.slice(0, 3)} ${code.slice(3)}`);
  await expect(page.getByTestId('verify-done')).toBeVisible();
  await expect(page.getByText('Cuenta confirmada')).toBeVisible();
  expect(await canSignIn(email, 'Kora-prueba-2026')).toBe(true);

  // signed in, and kept after a reload
  await page.goto('/account');
  await page.reload();
  await expect(page.getByText(email).first()).toBeVisible();
});

test('a new code can be asked for after the countdown, and only the newest one works', async ({ page }) => {
  await page.clock.install();
  const email = `ui-resend-${Date.now()}@example.com`;
  const since = Date.now() - 1000;
  await signUpForm(page, email);
  const first = await emailCode(email, since);
  await expect(page.getByTestId('code-resend')).toHaveCount(0);
  await page.clock.fastForward(61_000);
  await page.waitForTimeout(1500); // the server side: the local stack allows one email per second per address
  const again = Date.now();
  await page.getByTestId('code-resend').click();
  await expect(page.getByText('Te enviamos un código nuevo')).toBeVisible();
  await expect(page.getByTestId('code-resend-wait')).toBeVisible();
  const second = await emailCode(email, again);
  expect(second).not.toBe(first);
  await page.getByTestId('code-input').fill(first);
  await expect(page.getByTestId('code-error')).toBeVisible();
  await page.getByTestId('code-input').fill(second);
  await expect(page.getByTestId('verify-done')).toBeVisible();
});

test('signing up again with a confirmed email says the account exists', async ({ page }) => {
  const b = await newBuyer('ui-dup');
  await page.goto('/sign-up');
  await page.getByTestId('sign-up-name').fill('Ana Prueba');
  await page.getByTestId('sign-up-email').fill(b.email);
  await page.getByTestId('sign-up-password').fill('Kora-prueba-2026');
  await page.getByTestId('sign-up-submit').click();
  await expect(page.getByText('Ya existe una cuenta con ese correo')).toBeVisible();
  await expect(page).toHaveURL(/sign-up/);
});

test('signing in before confirming sends a code and finishes the account', async ({ page }) => {
  const email = `ui-unconfirmed-${Date.now()}@example.com`;
  await signUpForm(page, email);
  // the buyer closes the app and comes back later; the first code is gone with the email they deleted
  await page.goto('/sign-in');
  await page.waitForTimeout(1500); // the local stack allows one email per second per address
  const since = Date.now();
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill('Kora-prueba-2026');
  await page.getByTestId('sign-in-submit').click();
  await expect(page).toHaveURL(/verify-email/);
  await expect(page.getByText(/Tu correo aún no está confirmado|Ya te enviamos un código hace poco/)).toBeVisible();
  await page.getByTestId('code-input').fill(await emailCode(email, since));
  await expect(page.getByTestId('verify-done')).toBeVisible();
});

test('a forgotten password is replaced with a code from the email', async ({ page }) => {
  const b = await newBuyer('ui-forgot');
  await page.goto('/forgot-password');
  const since = Date.now() - 1000;
  await page.getByTestId('forgot-email').fill(b.email);
  await page.getByTestId('forgot-submit').click();
  await expect(page.getByText('Revisa tu correo')).toBeVisible();
  const code = await emailCode(b.email, since);
  const [mail] = await inbox(b.email);
  expect(mail!.subject).toBe('Código para cambiar tu contraseña');

  await page.getByTestId('code-input').fill(code);
  await page.getByTestId('reset-password').fill('corta1');
  await expect(page.getByText('Mínimo 8 caracteres').first()).toBeVisible();
  await page.getByTestId('reset-password').fill('Nueva-clave-2026');
  await page.getByTestId('reset-password-repeat').fill('Nueva-clave-2025');
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await page.getByTestId('reset-password-repeat').fill('Nueva-clave-2026');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByTestId('reset-done')).toBeVisible();
  expect(await canSignIn(b.email, 'Nueva-clave-2026')).toBe(true);
  expect(await canSignIn(b.email, b.password)).toBe(false);
});

test('a reset link from an older email still lets the buyer choose a new password, once', async ({ page }) => {
  const b = await newBuyer('ui-reset');
  const link = await emailLink('recovery', b.email, 'http://127.0.0.1:8089/reset-password');

  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByTestId('reset-password').fill('Nueva-clave-2026');
  await page.getByTestId('reset-password-repeat').fill('Nueva-clave-2026');
  await page.getByTestId('reset-submit').click();
  await expect(page.getByTestId('reset-done')).toBeVisible();
  expect(await canSignIn(b.email, 'Nueva-clave-2026')).toBe(true);

  // the same link a second time is refused, and the screen offers a code instead
  await page.goto(link);
  await expect(page.getByTestId('reset-link-invalid')).toBeVisible();
  await page.getByText('Pedir un código').click();
  await expect(page).toHaveURL(/forgot-password/);
});

test('opening the reset screen without a link points to the code', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByTestId('reset-link-invalid')).toBeVisible();
  await expect(page.getByText('pide un código de 6 dígitos')).toBeVisible();
});

test('a confirmation link from an older email signs the buyer in and says the account is ready', async ({ page }) => {
  const b = await newBuyer('ui-confirm');
  await page.goto(await emailLink('magiclink', b.email, 'http://127.0.0.1:8089/auth-callback'));
  await expect(page.getByTestId('confirm-done')).toBeVisible();
  await page.getByText('Empezar a comprar').click();
  await page.goto('/account');
  await expect(page.getByText(b.email).first()).toBeVisible();
});
