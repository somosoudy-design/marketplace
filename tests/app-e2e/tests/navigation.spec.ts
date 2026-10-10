import { expect, test } from '@playwright/test';

// UX-04: the existing catalog is the single Search destination. Keep navigation, saved context and the cart
// usable in both themes; these checks run against the real local backend and the exported Expo app.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`buyer navigation (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('four destinations separate discovery from search without a second filter shortcut', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('tab')).toHaveText(['Inicio', 'Buscar', 'Carrito', 'Cuenta']);
      await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(page.getByTestId('home-filters')).toHaveCount(0);

      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await expect(page).toHaveURL(/\/explore$/);
      await expect(page.getByRole('heading', { name: 'Buscar', exact: true })).toBeVisible();
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await expect(page.getByTestId('chip-category-tecnologia')).toBeVisible();
      await expect(page.getByTestId('chip-sort')).toBeVisible();
      await expect(page.getByTestId('chip-availability-available')).toBeVisible();

      await page.getByRole('tab', { name: 'Cuenta', exact: true }).click();
      await expect(page.getByTestId('account-sign-in')).toBeVisible();
      await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(page.getByTestId('home-favorites')).toBeVisible();
    });

    test('the Home search focuses the same catalog and keeps filters across tabs and product details', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('home-search').click();
      const search = page.getByTestId('catalog-search');
      await expect(search).toBeFocused();
      await search.fill('ugreen');
      await page.getByTestId('chip-availability-available').click();
      const products = page.getByTestId('explore-list').locator('[data-testid^="product-card-ugreen"]');
      await expect(products.first()).toBeVisible();

      await page.getByRole('tab', { name: 'Carrito', exact: true }).click();
      await expect(page).toHaveURL(/\/cart$/);
      await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
      await expect(search).toHaveValue('ugreen');
      await expect(page.getByTestId('chip-availability-available')).toHaveAttribute('aria-selected', 'true');
      await products.first().click();
      await expect(page.getByTestId('product-title')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Buscar', exact: true })).toBeHidden();
      await page.getByTestId('product-back').click();
      await expect(search).toHaveValue('ugreen');
      await expect(page.getByTestId('chip-availability-available')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Buscar', exact: true })).toHaveAttribute('aria-selected', 'true');
    });

    test('the cart badge and selected destination survive returning to discovery', async ({ page }) => {
      await page.goto('/p/ugreen-cable-usb-c-100w');
      await expect(page.getByTestId('product-title')).toBeVisible();
      await page.getByTestId('product-cta').click();
      await expect(page).toHaveURL(/\/cart$/);
      const cart = page.getByRole('tab', { name: 'Carrito', exact: true });
      await expect(cart).toHaveAttribute('aria-selected', 'true');
      await expect(cart).toContainText('1');
      await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
      // A direct product link can leave an inactive Home mounted behind the current tabs.
      await expect(page.locator('[data-testid="home-search"]:visible')).toHaveCount(1);
      await expect(cart).toContainText('1');
      await expect(cart).toHaveAttribute('aria-selected', 'false');
      await cart.click();
      await expect(page.getByTestId('cart-continue')).toHaveText(/Iniciar sesión/);
    });
  });
}
