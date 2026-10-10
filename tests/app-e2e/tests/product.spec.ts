import { expect, test } from '@playwright/test';
import { withDayGap } from './support/db';

// The product page: brand over the title, the main price with the special divisas price as a pill and the bolívar
// figure behind the rate details, options with their own price, the seller's card, and "Agregar" next to "Comprar".

test('the product page shows the special price, a price per option and who sells it', async ({ page }) => {
  const expireGap = await withDayGap(); // demo rates: gap 1,5 %
  try {
    await page.goto('/p/ugreen-cable-usb-c-100w');
    await expect(page.getByTestId('product-brand')).toHaveText(/ugreen/i);
    await expect(page.getByTestId('price-divisas')).toHaveText(/^\$\s?8,\d\d con .+·\s?1,\d % menos$/);
    await expect(page.getByTestId('product-demo')).toContainText('no es una oferta real');
    await expect(page.getByTestId('variant-1 m')).toHaveText(/^1 m · \$\s?9,00$/);
    await expect(page.getByTestId('variant-2 m')).toHaveText(/^2 m · \$\s?12,00$/);
    await expect(page.getByTestId('product-store')).toContainText('Vendido por');

    // the bolívar figure is a quiet line that opens where it comes from
    await page.getByTestId('price-ves').click();
    await expect(page.getByTestId('rate-sheet')).toContainText('precio en divisas');
  } finally {
    await expireGap();
  }
});

test('"Agregar" keeps the buyer on the product, and "Comprar" right after opens the cart without adding it twice', async ({ page }) => {
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await page.getByTestId('product-add').click();
  await expect(page.getByTestId('added-to-cart')).toBeVisible();
  await expect(page).toHaveURL(/\/product\//);
  await page.getByTestId('product-cta').click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-subtotal')).toHaveText(/\$\s?9,00/);
});
