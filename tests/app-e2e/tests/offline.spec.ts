import { expect, test } from '@playwright/test';
import { deliveredOrderFor, unpaidOrderFor } from './support/db';

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
}

// The buyer's orders stay readable when the server can't be reached, with a notice that they may be outdated;
// screens never saved say so instead of showing an empty or "not found" state; and leaving offline refreshes.

test('saved orders open without the server, and the app says when it is offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('ui-offline');
  await signIn(page, o.email, o.password);
  await page.goto('/orders');
  await page.getByTestId(`order-${o.number}`).click();
  await expect(page.getByTestId('order-number')).toContainText(o.number);
  await page.waitForTimeout(2600); // the saved copy is written at most every 2 s

  // the API stops answering: a fresh start still shows the saved order with its delivery status, and once the
  // periodic refresh (30 s) fails it is marked as possibly outdated
  await page.route('**/rest/v1/**', (r) => r.abort('internetdisconnected'));
  await page.goto(`/orders/${o.orderId}`);
  await expect(page.getByTestId('order-number')).toContainText(o.number);
  await expect(page.getByTestId('fulfillment-status-0')).not.toHaveText('delivered');
  await expect(page.getByTestId('fulfillment-status-0')).toHaveText(/\S/);
  await expect(page.getByText('No pudimos actualizar')).toBeVisible({ timeout: 45_000 });
  await page.unroute('**/rest/v1/**');

  // the device goes offline: a strip says so above the screen, and a screen never loaded explains it instead of
  // looking empty
  await page.goto('/account');
  await expect(page.getByText('Direcciones').first()).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('offline-notice')).toBeVisible();
  await page.getByText('Direcciones').first().click();
  await expect(page.getByText('Esto todavía no está guardado en tu teléfono')).toBeVisible();
  const strip = (await page.getByTestId('offline-notice').boundingBox())!;
  const title = (await page.getByRole('heading', { name: 'Direcciones' }).boundingBox())!;
  expect(title.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);

  // back online: the strip goes away and the screen loads by itself
  await context.setOffline(false);
  await expect(page.getByTestId('offline-notice')).toHaveCount(0);
  await expect(page.locator('[data-testid^="addr-row-"]').first()).toBeVisible();
});

test('cancelling an unpaid order asks first, on every platform', async ({ page }) => {
  const o = await unpaidOrderFor('ui-cancel');
  await signIn(page, o.email, o.password);
  await page.goto(`/orders/${o.orderId}`);
  await page.getByTestId('order-cancel').click();
  await expect(page.getByText(`¿Cancelar el pedido ${o.number}?`)).toBeVisible();
  await page.getByRole('button', { name: 'Conservar el pedido' }).click();
  await expect(page.getByText(`¿Cancelar el pedido ${o.number}?`)).toBeHidden();
  await expect(page.getByTestId('order-cancel')).toBeVisible(); // nothing happened

  await page.getByTestId('order-cancel').click();
  await page.getByTestId('order-cancel-sheet-confirm').click();
  await expect(page.getByText('Cancelado').first()).toBeVisible();
  await expect(page.getByTestId('order-cancel')).toHaveCount(0);
});
