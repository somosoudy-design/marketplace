import { expect, test } from '@playwright/test';
import { browseRecommendations, deliveredOrderFor, reviewAs } from '../tests/support/db';
import { signIn } from './helpers';

// Opinions are created by a real delivered purchase (fixture), then handled from both sides of the panel:
// the store answers publicly, the platform hides it with a reason and publishes it again.

test('a store answers a review, and the admin hides it with a reason and publishes it again', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('panel-review');
  const text = `La cuerda llegó con un nudo suelto (prueba ${Date.now()}).`;
  const id = await reviewAs(o.userId, o.orderId, 2, text);

  // Store: unanswered opinions come first; the reply is published under it
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1360, height: 900 }, locale: 'es-VE' });
  const seller = await ctx.newPage();
  await signIn(seller, 'tiendas@example.com');
  await seller.goto('/vendedor/opiniones');
  await seller.getByLabel('Tienda').selectOption({ label: 'Patitas & Co.' }); // this account manages two stores
  await expect(seller.getByText('Calificación de la tienda')).toBeVisible();
  const row = seller.getByTestId(`review-row-${id}`);
  await expect(row).toContainText(text);
  await expect(row).toContainText('Compra verificada');
  await seller.getByTestId(`reply-${id}`).click();
  await expect(seller.getByTestId('reply-save')).toBeDisabled();
  await seller.getByTestId('reply-body').fill('Lamentamos el detalle. Escríbenos por el reclamo del pedido y te enviamos otra.');
  await seller.getByTestId('reply-save').click();
  await expect(seller.getByText('Respuesta publicada')).toBeVisible();
  await expect(row).toHaveCount(0); // answered, so it leaves the "sin responder" list
  await seller.getByLabel('Solo sin responder').uncheck();
  await expect(row).toContainText('Respuesta de la tienda');
  await expect(row).toContainText('te enviamos otra');
  await ctx.close();

  // Platform: hiding needs a reason; the opinion moves to "Ocultas" with it, and can be published again
  await signIn(page, 'admin@example.com');
  await page.goto('/admin/opiniones');
  const adminRow = page.getByTestId(`review-row-${id}`);
  await expect(adminRow).toContainText('Patitas');
  await expect(adminRow).toContainText('Demostración');
  await page.getByTestId(`moderate-${id}`).click();
  await expect(page.getByTestId('moderate-save')).toBeDisabled();
  await page.getByTestId('moderate-reason').selectOption('No habla del producto ni de la compra');
  await page.getByTestId('moderate-save').click();
  await expect(page.getByText('Opinión oculta')).toBeVisible();
  await expect(adminRow).toHaveCount(0);
  await page.getByRole('tab', { name: 'Ocultas' }).click();
  await expect(adminRow).toContainText('No habla del producto ni de la compra');
  await page.getByTestId(`moderate-${id}`).click();
  await page.getByTestId('moderate-save').click();
  await expect(page.getByText('Opinión publicada')).toBeVisible();
  await page.getByRole('tab', { name: 'Publicadas' }).click();
  await expect(adminRow).toContainText(text);
});

test('recommendation metrics name each space, flag demo traffic, and ranking weights are validated', async ({ page }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('panel-recs');
  await browseRecommendations(o.userId, 'home_for_you', ['ugreen-nexode-65w', 'ugreen-power-bank-20000', 'ugreen-cable-usb-c-100w'], 'ugreen-nexode-65w');

  await signIn(page, 'admin@example.com');
  await page.goto('/admin/recomendaciones');
  await expect(page.getByTestId('rec-slot-home_for_you')).toContainText('Inicio · Para ti');
  await expect(page.getByText(/viene de cuentas de demostración/)).toBeVisible();
  await expect(page.getByTestId('rec-top')).toContainText('Nexode');

  const affinity = page.getByTestId('ranking-affinity');
  const save = page.getByTestId('ranking-save');
  await expect(affinity).toHaveValue('3');
  await expect(save).toBeDisabled(); // nothing changed yet
  await affinity.fill('11');
  await expect(page.getByText('Entre 0 y 10.')).toBeVisible();
  await expect(save).toBeDisabled();
  await affinity.fill('2,5');
  await save.click();
  await expect(page.getByText('Pesos guardados')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ranking-affinity')).toHaveValue('2,5');

  // back to the shipped values so other tests see the default ranking
  await page.getByRole('button', { name: 'Valores de fábrica' }).click();
  await page.getByTestId('ranking-save').click();
  await expect(page.getByText('Pesos guardados')).toBeVisible();
  await expect(page.getByTestId('ranking-affinity')).toHaveValue('3');
});
