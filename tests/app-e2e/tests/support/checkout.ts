import { expect, type Page } from '@playwright/test';

/** Advance through real delivery decisions; no order is created before the review action. */
export async function checkoutToPlan(page: Page) {
  await expect(page.getByTestId('checkout-stage-address')).toBeVisible();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  for (let i = 0; i < 20; i++) {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    if (await page.getByTestId('checkout-stage-plan').isVisible()) return;
    await expect(page.getByTestId('checkout-stage-delivery')).toBeVisible();
    await page.getByTestId('checkout-next').click();
  }
  throw new Error('Checkout did not finish its delivery decisions');
}

export async function checkoutToReview(page: Page) {
  await checkoutToPlan(page);
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await expect(page.getByTestId('checkout-stage-review')).toBeVisible();
  await expect(page.getByTestId('checkout-place')).toBeEnabled();
}
