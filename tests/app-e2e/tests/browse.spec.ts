import { expect, test } from '@playwright/test';

// Visitor journeys on the exported web build. Needs the local stack with seed data (pnpm stack:start).

test('home shows the editorial catalog to visitors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('home-search')).toBeVisible();
  await expect(page.getByTestId('category-odontologia')).toBeVisible();
  await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible();
  // the VES reference rate is shown with its source, or an honest notice when unavailable
  await expect(page.getByTestId('home-rate')).toContainText(/Bs|tasa/i);
  await expect(page.getByRole('tab', { name: 'Inicio' })).toHaveAttribute('aria-selected', 'true');
});

test('a marketplace with nothing published yet says so instead of an empty featured section', async ({ page }) => {
  // the same answers a brand-new backend gives: an empty home feed and no search results
  await page.route('**/rest/v1/rpc/home_feed*', (r) =>
    r.fulfill({ json: { stores: [], categories: [], collections: [], recommended: [], personalized: false, recently_viewed: [] } }));
  await page.route('**/rest/v1/rpc/search_products*', (r) => r.fulfill({ json: [] }));
  await page.goto('/');
  const empty = page.getByTestId('home-catalog-empty');
  await expect(empty).toContainText('Las tiendas están preparando su catálogo');
  await expect(page.getByText('Una selección para empezar')).toHaveCount(0);
  await expect(page.getByTestId('home-feed-end')).toHaveCount(0);
  await empty.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/sign-up/);
});

test('search and filters survive opening a product and coming back', async ({ page }) => {
  await page.goto('/explore');
  const search = page.getByTestId('catalog-search');
  await search.fill('ugreen');
  const count = page.getByTestId('catalog-count');
  await expect(count).toContainText('producto');
  await page.getByTestId('chip-availability-available').click();
  await expect(page.getByTestId('chip-availability-available')).toHaveAttribute('aria-selected', 'true');
  const cards = page.locator('[data-testid^="product-card-ugreen"]');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(1);

  // let the filtered results settle, scroll the list, then open a card further down
  await page.waitForLoadState('networkidle');
  const list = page.getByTestId('explore-list');
  await list.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  const before = await list.evaluate((el) => el.scrollTop);
  const target = cards.nth(n - 1);
  const slug = (await target.getAttribute('data-testid'))!.replace('product-card-', '');
  await target.click();

  await expect(page).toHaveURL(/\/product\//);
  await expect(page.getByTestId('product-title')).toBeVisible();
  // product pages cover the tab bar
  await expect(page.getByRole('tab', { name: 'Explorar' })).toBeHidden();

  await page.getByTestId('product-back').click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.getByTestId('catalog-search')).toHaveValue('ugreen');
  await expect(page.getByTestId('chip-availability-available')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId(`product-card-${slug}`)).toBeVisible();
  const after = await page.getByTestId('explore-list').evaluate((el) => el.scrollTop);
  expect(Math.abs(after - before)).toBeLessThan(40);
});

test('visitors keep a cart and are asked to sign in to pay', async ({ page }) => {
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await expect(page.getByTestId('product-title')).toContainText('UGREEN');
  await page.getByTestId('product-cta').click();
  await expect(page.getByTestId('added-to-cart')).toBeVisible();
  await page.getByTestId('added-to-cart').click();
  await expect(page.getByTestId('cart-subtotal')).toHaveText(/\$\s?9,00/);
  await expect(page.getByTestId('cart-continue')).toHaveText(/Iniciar sesión/);
  // the cart persists across reloads for visitors
  await page.reload();
  await expect(page.getByTestId('cart-subtotal')).toHaveText(/\$\s?9,00/);
});

test('each availability state shows its own call to action', async ({ page }) => {
  const cases: [string, RegExp][] = [
    ['audifonos-anc-over-ear', /^Encargar/],
    ['sheglam-polvo-sellador', /^Reservar/],
    ['audifonos-deportivos', /Avisarme/],
  ];
  for (const [slug, cta] of cases) {
    await page.goto(`/p/${slug}`);
    await expect(page.getByTestId('product-title')).toBeVisible();
    await expect(page.getByTestId('product-cta')).toHaveText(cta);
  }
  // asking for a restock alert requires an account
  await page.getByTestId('product-cta').click();
  await expect(page).toHaveURL(/sign-in/);
});
