import { expect, test } from '@playwright/test';
import { unpaidOrderFor, withDayGap } from './support/db';

// Paying with Zelle while a day's gap is in force: the amount and the saving come first; the gap and its two rates
// stay one tap away ("Ver cálculo"), and the picker links to how amounts are calculated. Formulas: docs/PRECIOS.md.

test('a Zelle quote shows the amount and the saving, with the calculation on demand', async ({ page }) => {
  test.setTimeout(120_000);
  const expireGap = await withDayGap(); // demo rates: gap 1,5 %
  try {
    const o = await unpaidOrderFor('ui-pay-divisas');
    await page.goto('/sign-in');
    await page.getByTestId('sign-in-email').fill(o.email);
    await page.getByTestId('sign-in-password').fill(o.password);
    await page.getByTestId('sign-in-submit').click();
    await expect(page).not.toHaveURL(/sign-in/);

    await page.goto(`/pay/${o.orderId}`);
    await page.getByTestId('pay-rate-info').click();
    await expect(page.getByTestId('rate-sheet')).toContainText('precio en divisas');
    await page.getByRole('button', { name: 'Entendido' }).click();

    await page.getByTestId('method-zelle').click();
    await page.getByTestId('pay-quote').click();
    await expect(page.getByTestId('quote-divisas')).toContainText(/% menos que \$\s?7,00 a tasa BCV/);
    await expect(page.getByTestId('quote-divisas-math')).toHaveCount(0);
    await page.getByTestId('quote-divisas-more').click();
    await expect(page.getByTestId('quote-divisas-math')).toContainText('Brecha del día 1,5');
    await expect(page.getByTestId('quote-expiry')).toContainText(/Monto válido por \d/);
  } finally {
    await expireGap();
  }
});
