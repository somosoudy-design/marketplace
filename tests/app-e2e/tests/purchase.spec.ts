import { expect, test } from '@playwright/test';

// Full buyer journey: visitor cart -> sign up -> cart merge -> checkout with a new address ->
// double tap on "Confirmar" -> Pago Móvil quote in Bs -> reference -> payment stays in verification.
// Uses fictitious example.com accounts against the local stack only.

test('a new buyer completes checkout and submits a Pago Móvil payment for verification', async ({ page }) => {
  test.setTimeout(120_000);
  const email = `ui-${Date.now()}@example.com`;

  // 1. visitor adds a product
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await page.getByTestId('product-cta').click();
  await expect(page.getByTestId('added-to-cart')).toBeVisible();
  await page.getByTestId('added-to-cart').click();
  await page.getByTestId('cart-continue').click();

  // 2. sign up from the sign-in sheet
  await expect(page).toHaveURL(/sign-in/);
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await page.getByTestId('sign-up-name').fill('Ana Prueba');
  await page.getByTestId('sign-up-email').fill(email);
  await page.getByTestId('sign-up-password').fill('Kora-prueba-2026');
  await page.getByTestId('sign-up-submit').click();

  // 3. back in the cart, the visitor line now lives in the account cart
  await expect(page.getByTestId('cart-continue')).toHaveText('Continuar');
  await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(1);
  await page.getByTestId('cart-continue').click();

  // 4. checkout asks for an address
  await expect(page).toHaveURL(/checkout/);
  await page.getByTestId('checkout-add-address').click();
  await page.getByTestId('addr-recipient').fill('Ana Prueba');
  await page.getByTestId('addr-phone').fill('0412 555 0101');
  await page.getByTestId('addr-region').click();
  await page.getByRole('radio', { name: 'Distrito Capital' }).click();
  await page.getByTestId('addr-city').fill('Caracas');
  await page.getByTestId('addr-line1').fill('Av. Principal de Ejemplo, Edif. Demo, piso 2');
  await page.getByTestId('addr-save').click();

  await expect(page.getByTestId('checkout-address')).toContainText('Ana Prueba');
  await expect(page.getByTestId('checkout-total')).toContainText('$');
  const place = page.getByTestId('checkout-place');
  await expect(place).toBeEnabled();

  // 5. double tap: both taps resolve to the same order
  await place.dblclick();
  await expect(page).toHaveURL(/\/pay\//);
  await expect(page.getByText(/Pedido P-\d+ creado/)).toBeVisible();

  // 6. Pago Móvil quote in bolívares with its rate and expiry
  await page.getByTestId('method-pago_movil').click();
  await expect(page.getByTestId('method-pago_movil')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('pay-quote').click();
  await expect(page.getByTestId('quote-amount')).toContainText('Bs');
  await expect(page.getByTestId('quote-rate')).toContainText(/Bs/);
  await expect(page.getByTestId('quote-expiry')).toBeVisible();
  // references are unique per method: a reused one is rejected as a possible duplicate payment
  await page.getByTestId('pay-reference').fill(String(Date.now()).slice(-10));
  await page.getByTestId('pay-submit').click();

  // 7. the payment waits for verification; nothing is marked as paid
  await expect(page.getByTestId('payment-submitted')).toContainText('Recibimos tu pago');
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await expect(page.getByTestId('order-number')).toContainText('P-');
  await expect(page.getByText('En verificación').first()).toBeVisible();

  // 8. exactly one order exists for this account
  await page.goto('/orders');
  await expect(page.locator('[data-testid^="order-P-"]')).toHaveCount(1);
});
