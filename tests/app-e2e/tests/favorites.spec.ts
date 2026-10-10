import { expect, test } from '@playwright/test';
import { newBuyer } from './support/db';

// Favorites live outside the tab bar: saved from the product heart, opened from the heart next to notifications on
// Home and from Account. The tab bar keeps four destinations.

test('a buyer saves a product and finds it from Home and from Account', async ({ page }) => {
  const b = await newBuyer('ui-fav');
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(b.email);
  await page.getByTestId('sign-in-password').fill(b.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);

  // four tabs, no Favoritos among them
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveText(['Inicio', 'Buscar', 'Carrito', 'Cuenta']);

  await page.goto('/p/ugreen-cable-usb-c-100w');
  await expect(page.getByTestId('product-title')).toBeVisible();
  await page.getByTestId('product-favorite').click();
  await expect(page.getByTestId('product-favorite')).toHaveAttribute('aria-label', 'Quitar de favoritos');

  // from the heart on Home
  await page.goto('/');
  await page.getByTestId('home-favorites').click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByTestId('favorites-count')).toHaveText('1 producto guardado');
  await expect(page.getByTestId('favorites-list').getByText('UGREEN cable USB-C a USB-C')).toBeVisible();

  // and from Account, which says how many are saved
  await page.goto('/account');
  await expect(page.getByTestId('account-favorites')).toContainText('1 producto guardado');
  await page.getByTestId('account-favorites').click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByTestId('favorites-list').getByText('UGREEN cable USB-C a USB-C')).toBeVisible();
});

test('a visitor opening Favoritos is invited to sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-favorites').click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByText('Guarda lo que te gusta')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/sign-in/);
});
