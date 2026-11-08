import { expect, test } from '@playwright/test';
import { withDayGap } from './support/db';

// The product page: brand over the title, one main price (what Zelle, USDT or bolívares cost shows when the buyer
// picks a method at payment), options with their own price, the seller's card, and "Agregar" next to "Comprar".
// "Disponible" goes unsaid; a sold-out product says so.

test('the product page shows one price, a price per option and who sells it', async ({ page }) => {
  const expireGap = await withDayGap(); // demo rates: gap 1,5 %, which payment shows (pay-divisas.spec)
  try {
    await page.goto('/p/ugreen-cable-usb-c-100w');
    await expect(page.getByTestId('product-brand')).toHaveText(/ugreen/i);
    await expect(page.getByTestId('product-demo')).toContainText('no es una oferta real');
    await expect(page.getByTestId('variant-1 m')).toHaveText(/^1 m · \$\s?9,00$/);
    await expect(page.getByTestId('variant-2 m')).toHaveText(/^2 m · \$\s?12,00$/);
    await expect(page.getByTestId('product-store')).toContainText('Vendido por');
    await expect(page.getByTestId('price-divisas')).toHaveCount(0);
    await expect(page.getByTestId('price-ves')).toHaveCount(0);
    await expect(page.getByTestId('product-status')).toHaveCount(0);
    await expect(page.getByTestId('product-lead')).toHaveText(/^Listo para despacho/);
  } finally {
    await expireGap();
  }
});

test('a sold-out product says so next to its price', async ({ page }) => {
  await page.goto('/p/audifonos-deportivos');
  await expect(page.getByTestId('product-status')).toHaveText('Agotado');
  await expect(page.getByTestId('product-cta')).toContainText('Avisarme cuando vuelva');
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
