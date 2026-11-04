import { expect, type Page } from '@playwright/test';

/** Advance through real delivery decisions; no order is created before the review action. */
export async function checkoutToPlan(page: Page) {
  await expect(page.getByTestId('checkout-stage-address')).toBeVisible();
  const advance = async () => {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    const progress = await page.getByTestId('checkout-progress').textContent();
    await page.getByTestId('checkout-next').click();
    // Wait for the actual decision change, including the transition between two deliveries.
    await expect(page.getByTestId('checkout-progress')).not.toHaveText(progress!);
    await expect(page.getByTestId('checkout-stage-delivery').or(page.getByTestId('checkout-stage-plan'))).toBeVisible();
  };
  await advance();
  for (let i = 0; i < 20; i++) {
    await expect(page.getByTestId('checkout-next')).toBeEnabled();
    if (await page.getByTestId('checkout-stage-plan').isVisible()) return;
    await expect(page.getByTestId('checkout-stage-delivery')).toBeVisible();
    await advance();
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
