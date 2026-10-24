import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { newBuyer } from './support/db';

async function filledCart(page: Page, label: string) {
  const buyer = await newBuyer(label);
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await page.getByTestId('product-cta').click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(1);
}

const shots = resolve(import.meta.dirname, '../../../.local/buyer-errors');
mkdirSync(shots, { recursive: true });

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`buyer errors (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('failed addresses show an error and retry restores checkout', async ({ page }) => {
      await filledCart(page, `ui-address-error-${colorScheme}`);
      const route = '**/rest/v1/addresses*';
      await page.route(route, (r) => r.abort('internetdisconnected'));
      let orders = 0;
      page.on('request', (r) => { if (r.url().includes('/rpc/place_order')) orders++; });
      await page.getByTestId('cart-continue').click();
      await expect(page.getByText('No pudimos cargar esto')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
      await expect(page.getByTestId('checkout-place')).toHaveCount(0);
      await page.screenshot({ path: `${shots}/${colorScheme}-checkout-error.png` });
      await page.unroute(route);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await expect(page.getByTestId('checkout-address')).toContainText('Ana Prueba');
      await expect(page.getByTestId('checkout-next')).toBeEnabled();
      await expect(page.getByTestId('checkout-place')).toHaveCount(0);
      expect(orders).toBe(0);
    });

    test('failed quantity changes explain rollback and a new attempt succeeds', async ({ page }) => {
      await filledCart(page, `ui-quantity-error-${colorScheme}`);
      const line = page.locator('[data-testid^="cart-line-"]').first();
      await expect(line.getByLabel('Cantidad 1', { exact: true })).toBeVisible();
      const route = '**/rest/v1/rpc/cart_set_quantity';
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let writes = 0;
      await page.route(route, async (r) => { writes++; await held; await r.abort('internetdisconnected'); });
      await line.getByRole('button', { name: 'Aumentar cantidad' }).click();
      try {
        await expect.poll(() => writes).toBe(1);
        await expect(line.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled();
        await expect(line.getByRole('button', { name: 'Disminuir cantidad' })).toBeDisabled();
        await expect(page.getByTestId('cart-continue')).toBeDisabled();
      } finally {
        release();
      }
      await expect(page.getByText('No pudimos actualizar la cantidad. Intenta de nuevo.')).toBeVisible();
      await expect(line.getByLabel('Cantidad 1', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-cart-error.png` });
      await page.unroute(route);
      await line.getByRole('button', { name: 'Aumentar cantidad' }).click();
      await expect(line.getByLabel('Cantidad 2', { exact: true })).toBeVisible();
      await expect(page.getByText('No pudimos actualizar la cantidad. Intenta de nuevo.')).toHaveCount(0);
    });

    test('web offline strip leaves the header visible and disappears on reconnect', async ({ page, context }) => {
      await page.goto('/sign-in');
      await expect(page.getByTestId('sign-in-email')).toBeVisible();
      await context.setOffline(true);
      const notice = page.getByTestId('offline-notice');
      await expect(notice).toBeVisible();
      const strip = (await notice.boundingBox())!;
      const title = (await page.getByRole('heading', { name: 'Iniciar sesión', exact: true }).boundingBox())!;
      expect(title.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
      await page.screenshot({ path: `${shots}/${colorScheme}-offline-web.png` });
      await context.setOffline(false);
      await expect(notice).toHaveCount(0);
      await expect(page.getByTestId('sign-in-email')).toBeVisible();
    });
  });
}
