import { expect, test, type Page } from '@playwright/test';
import { deliveredOrderFor, newBuyer } from './support/db';

async function signIn(page: Page, buyer: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Front A V2 (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('only the active tab expands, while all four destinations keep accessible targets at 320px', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 780 });
      await page.goto('/');
      const destinations = [['index', 'Inicio', '/'], ['explore', 'Buscar', '/explore'], ['cart', 'Carrito', '/cart'], ['account', 'Cuenta', '/account']] as const;
      for (const [id, name, route] of destinations) {
        const selected = page.getByTestId(`buyer-tab-${id}`);
        await selected.click();
        await expect(page).toHaveURL((url) => url.pathname === route);
        await expect(selected).toHaveAttribute('aria-selected', 'true');
        await expect(selected).toHaveAccessibleName(name);
        await expect(page.getByTestId('active-tab-label')).toHaveCount(1);
        await expect(page.getByTestId('active-tab-label')).toHaveText(name);
        await expect.poll(async () => (await selected.boundingBox())!.width).toBeGreaterThan(90);
        const boxes = await page.getByRole('tab').evaluateAll((tabs) => tabs.map((tab) => {
          const rect = tab.getBoundingClientRect();
          return { width: rect.width, height: rect.height, left: rect.left, right: rect.right, selected: tab.getAttribute('aria-selected') };
        }));
        expect(boxes).toHaveLength(4);
        for (const box of boxes) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(320);
        }
        for (const [otherId, otherName] of destinations.filter(([otherId]) => otherId !== id)) {
          const inactive = page.getByTestId(`buyer-tab-${otherId}`);
          await expect(inactive).toHaveAccessibleName(otherName);
          await expect(inactive.getByTestId('active-tab-label')).toHaveCount(0);
          await expect(inactive).toHaveAttribute('aria-selected', 'false');
        }
      }
      await page.getByTestId('account-favorites').click();
      await expect(page).toHaveURL(/\/favorites$/);
      await expect(page.getByRole('tab')).toHaveCount(0);
      await page.goBack();
      await expect(page.getByTestId('active-tab-label')).toHaveText('Cuenta');
    });

    test('the header and tab show the same real visitor cart without a phantom notification mark', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('home-cart-count')).toHaveCount(0);
      await expect(page.getByTestId('home-unread-indicator')).toHaveCount(0);
      await expect(page.getByTestId('home-favorites')).toHaveCount(0);
      await page.goto('/p/ugreen-cable-usb-c-100w');
      await page.getByTestId('product-cta').click();
      await expect(page).toHaveURL(/\/cart$/);
      await page.getByTestId('buyer-tab-index').click();
      await expect(page.locator('[data-testid="home-cart-count"]:visible')).toHaveText('1');
      await expect(page.getByTestId('tab-cart-count')).toHaveText('1');
      await expect(page.getByTestId('buyer-tab-cart')).toHaveAccessibleName('Carrito, 1 producto');
      await page.locator('[data-testid="home-cart"]:visible').click();
      await expect(page).toHaveURL(/\/cart$/);
      await expect(page.getByTestId('cart-continue')).toHaveText(/Iniciar sesión/);
      await expect(page.getByTestId('active-tab-label')).toHaveText('Carrito');
    });

    test('card favorites remain separate from opening the product in Home, search and collections', async ({ page }) => {
      await signIn(page, await newBuyer(`ui-card-${colorScheme}`));
      await page.goto('/');
      const surface = page.getByTestId('home-recommended').locator('[data-testid^="product-surface-"]').first();
      await expect(surface).toBeVisible();
      const productLink = surface.getByRole('link');
      await expect(productLink.getByTestId('card-title')).toBeVisible();
      const fullName = (await productLink.getAttribute('aria-label'))!;
      expect(fullName).toMatch(/\$/);
      await expect(productLink.getByRole('button')).toHaveCount(0);
      const favorite = surface.getByRole('button', { name: 'Guardar en favoritos', exact: true });
      await favorite.click();
      await expect(page).toHaveURL(/\/$/);
      await expect(surface.getByRole('button', { name: 'Quitar de favoritos', exact: true })).toBeVisible();
      await page.getByTestId('buyer-tab-account').click();
      await expect(page.getByTestId('account-favorites')).toContainText('1 producto guardado');
      await page.getByTestId('account-favorites').click();
      await expect(page.getByTestId('favorites-count')).toHaveText('1 producto guardado');
      await page.goBack();
      await page.getByTestId('buyer-tab-explore').click();
      const catalogCard = page.getByTestId('explore-list').locator('[data-testid^="product-surface-"]').first();
      await expect(catalogCard.getByTestId('card-title')).toBeVisible();
      await expect(catalogCard.getByRole('button')).toHaveCount(1);
      await catalogCard.getByRole('link').click();
      await expect(page.getByTestId('product-title')).toBeVisible();
      await page.getByTestId('product-back').click();
      await expect(page.getByTestId('active-tab-label')).toHaveText('Buscar');
      await page.getByTestId('buyer-tab-index').click();
      await page.locator('[data-testid="home-hero"]:visible').getByRole('link').first().click();
      await expect(page).toHaveURL(/\/catalog\?.*collection=/);
      await expect(page.locator('[data-testid^="product-surface-"]:visible').first().getByTestId('card-title')).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId('active-tab-label')).toHaveText('Inicio');
    });
  });

  test.describe(`Reduced motion (${colorScheme})`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });
    test('the selected tab changes without relying on an animation', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('buyer-tab-explore').click();
      await expect(page.getByTestId('active-tab-label')).toHaveText('Buscar');
      await expect(page.getByTestId('buyer-tab-explore')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('catalog-search')).toBeVisible();
      await page.getByTestId('buyer-tab-cart').click();
      await expect(page.getByTestId('active-tab-label')).toHaveText('Carrito');
    });
  });
}

test('the notification mark is driven by unread data and clears after opening the real local notices', async ({ page }) => {
  await signIn(page, await deliveredOrderFor('ui-header-notices'));
  await page.goto('/');
  await expect(page.getByTestId('home-bell')).toHaveAttribute('aria-label', /^Notificaciones, \d+ sin leer$/);
  await expect(page.getByTestId('home-unread-indicator')).toBeVisible();
  await page.getByTestId('home-bell').click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.locator('[data-testid^="notice-"]').first()).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-testid="home-unread-indicator"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-testid="home-bell"]:visible')).toHaveAttribute('aria-label', 'Notificaciones');
});
