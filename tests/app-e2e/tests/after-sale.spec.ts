import { expect, test } from '@playwright/test';
import { deliveredOrderFor } from './support/db';

// After the delivery: the buyer rates the item, reports a problem, talks to the store in the claim,
// and the notification center links back to the order. Setup pays and delivers a fresh demo order
// through the same database functions the app and panel use (local stack only).

test('a buyer rates a delivered item, opens a claim and writes to the store', async ({ page }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('ui-after');

  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(o.email);
  await page.getByTestId('sign-in-password').fill(o.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);

  // rate the delivered item
  await page.goto(`/orders/${o.orderId}`);
  await expect(page.getByText(`Pedido ${o.number}`)).toBeVisible();
  await page.locator('[data-testid^="review-"]').first().click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
  await expect(page.getByTestId('review-submit')).toBeDisabled();
  await page.getByTestId('star-4').click();
  await page.getByTestId('review-body').fill('Resistente y a mi perro le encantó (prueba automatizada).');
  await page.getByTestId('review-submit').click();
  await expect(page.getByTestId('review-sheet')).toBeHidden();
  await expect(page.locator('[data-testid^="review-"]').first()).toHaveText('Editar');

  // report a problem: the form becomes the conversation
  await page.getByTestId(`claim-open-${o.fulfillmentId}`).click();
  await expect(page.getByTestId('claim-form')).toBeVisible();
  await page.getByTestId('claim-reason-missing_parts').click();
  await expect(page.getByTestId('claim-submit')).toBeDisabled();
  await page.getByTestId('claim-description').fill('Faltó la segunda cuerda del paquete (prueba automatizada).');
  await page.getByTestId('claim-submit').click();
  await expect(page.getByTestId('claim-thread')).toBeVisible();
  await expect(page.getByTestId('claim-status')).toHaveText('Esperando a la tienda');
  await expect(page.getByText(/tiene hasta el/)).toBeVisible();
  await expect(page.getByTestId('claim-escalate')).toHaveCount(0); // the store still has time to answer

  await page.getByTestId('claim-message').fill('Adjunto más detalles: el empaque venía abierto.');
  await page.getByTestId('claim-send').click();
  await expect(page.getByText('Adjunto más detalles: el empaque venía abierto.')).toBeVisible();
  await expect(page.getByTestId('claim-message')).toHaveValue('');

  // the order now shows the claim instead of the report button
  await page.goto(`/orders/${o.orderId}`);
  await expect(page.getByTestId(`claim-row-${o.fulfillmentId}`)).toContainText('Esperando a la tienda');
  await expect(page.getByTestId(`claim-open-${o.fulfillmentId}`)).toHaveCount(0);

  // notifications: demo notices are announced once, and a payment notice opens its order
  await page.goto('/notifications');
  await expect(page.getByText('Estos avisos vienen de pedidos de demostración', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: /Pago confirmado/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/orders/${o.orderId}`));
});
