import { expect, test } from '@playwright/test';

// A store's link opens that store's catalog (not the home screen), can be copied from its page, and the badges only
// show where the data says so: today the gold one on the marketplace's own store (kind 'platform'), nothing else.

test('a store page shares a link that opens that same store', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await page.goto('/tienda/patitas');
  await expect(page.getByTestId('store-name')).toHaveText('Patitas & Co.');

  await page.getByTestId('store-share').click();
  await expect(page.getByTestId('store-share-link')).toHaveText(`${baseURL}/tienda/patitas`);
  await page.getByTestId('store-share-copy').click();
  await expect(page.getByTestId('store-share-copy')).toContainText('Enlace copiado');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${baseURL}/tienda/patitas`);

  // the copied link, opened fresh, lands on that store with its catalog
  const other = await context.newPage();
  await other.goto(copied);
  await expect(other.getByTestId('store-name')).toHaveText('Patitas & Co.');
  await expect(other.getByTestId('store-catalog')).toBeVisible();
});

test('only the marketplace store has the official badge, and it says what it means', async ({ page }) => {
  await page.goto('/tienda/kora');
  await page.getByTestId('store-catalog').getByTestId('store-badge-official').click();
  await expect(page.getByTestId('store-badge-sheet')).toContainText('La opera directamente');

  for (const slug of ['patitas', 'casa-lumen', 'odontopro']) {
    await page.goto(`/tienda/${slug}`);
    await expect(page.getByTestId('store-name')).toBeVisible();
    // scoped to the store page: Home stays mounted underneath, with its own store chips
    const store = page.getByTestId('store-catalog');
    await expect(store.locator('[data-testid^="store-badge-"]')).toHaveCount(0);
    await expect(store.getByText('Vendedor verificado')).toHaveCount(0);
  }

  // next to the seller's name on a product page too
  await page.goto('/p/ugreen-cable-usb-c-100w');
  await expect(page.getByTestId('product-store').getByTestId('store-badge-official')).toBeVisible();
  await page.goto('/p/juguete-cuerda-perros');
  await expect(page.getByTestId('product-store')).toContainText('Patitas');
  await expect(page.getByTestId('product-store').locator('[data-testid^="store-badge-"]')).toHaveCount(0);
});
