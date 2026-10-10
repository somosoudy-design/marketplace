import { expect, test } from '@playwright/test';
import { deliveredOrderFor, replyAsStore } from './support/db';

// Verified reviews on the product page: always visible (with a plain empty state), rated from the page itself by a
// buyer whose purchase was delivered, and the store's answer shown under the review. The order screen offers the
// same rating from its top. Only delivered purchases can be rated (enforced by submit_review).

const signIn = async (page: import('@playwright/test').Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(email);
  await page.getByTestId('sign-in-password').fill(password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
};

test('a product without reviews says so, and visitors are not offered to rate it', async ({ page }) => {
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await expect(page.getByTestId('product-reviews')).toContainText('Solo opinan quienes compraron y recibieron este producto.');
  await expect(page.getByTestId('product-reviews-empty')).toHaveText('Aún no hay opiniones de este producto.');
  await expect(page.getByTestId('product-rate')).toHaveCount(0);
});

test('a buyer rates a delivered purchase from the product page and sees the store answer', async ({ page }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('ui-rev');
  await signIn(page, o.email, o.password);

  await page.goto('/p/juguete-cuerda-perros');
  await page.getByTestId('product-rate').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
  await page.getByTestId('star-5').click();
  const body = `Llegó bien y es resistente (prueba automatizada ${Date.now()}).`;
  await page.getByTestId('review-body').fill(body);
  await page.getByTestId('review-submit').click();
  await expect(page.getByTestId('review-sheet')).toBeHidden();
  await expect(page.getByTestId('product-rate')).toHaveCount(0);
  const review = page.getByTestId('product-reviews').locator('[data-testid^="review-"]').filter({ hasText: body });
  await expect(review).toContainText('Compra verificada');

  // the store answers from its panel; the answer shows under the review with the store's name
  const reviewId = (await review.getAttribute('data-testid'))!.replace('review-', '');
  await replyAsStore(reviewId, 'Gracias por tu compra, ¡que lo disfrute!');
  await page.reload();
  await expect(page.getByTestId(`review-reply-${reviewId}`)).toContainText('Respuesta de Patitas');
  await expect(page.getByTestId(`review-reply-${reviewId}`)).toContainText('Gracias por tu compra');
});

test('a delivered order invites the buyer to rate it from the top', async ({ page }) => {
  test.setTimeout(120_000);
  const o = await deliveredOrderFor('ui-rev-order');
  await signIn(page, o.email, o.password);
  await page.goto(`/orders/${o.orderId}`);
  await page.getByTestId('order-rate').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
  await page.getByTestId('star-4').click();
  await page.getByTestId('review-submit').click();
  await expect(page.getByTestId('review-sheet')).toBeHidden();
  await expect(page.getByTestId('order-rate')).toHaveCount(0);
});
