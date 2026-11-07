import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

for (const width of [320, 360, 390, 412]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`Mayami Android ${width} ${colorScheme}`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: { width, height: 892 }, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(page.getByTestId('home-hero')).toBeVisible();
      await expect(page.getByTestId('category-tecnologia')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Explora por categoría' })).toBeVisible();
      await expect(page.getByTestId('category-tecnologia')).toHaveCount(1);
      await expect(page.locator('[data-testid^="home-recommended"] [data-testid="card-title"]').first()).toBeVisible();
      const category = await page.getByTestId('category-tecnologia').boundingBox();
      expect(category!.height).toBeGreaterThanOrEqual(44);
      const titles = page.locator('[data-testid^="home-recommended"] [data-testid="card-title"]');
      expect(await titles.evaluateAll((nodes) => nodes.every((node) => node.scrollHeight <= node.clientHeight + 1))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect.poll(() => page.locator('img:visible').evaluateAll((images) => images.every((image) => {
        const box = image.getBoundingClientRect();
        return box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth || !box.width || !box.height || (image.complete && image.naturalWidth > 0);
      }))).toBe(true);
      await page.screenshot({ path: info.outputPath('inicio.png') });
      const scroll = page.getByTestId('home-scroll');
      await scroll.evaluate((node) => { node.scrollTop = 100; });
      await expect(page.getByTestId('home-search-sticky')).toBeVisible();
      await expect(page.getByTestId('brand-symbol')).toBeVisible();
      await page.screenshot({ path: info.outputPath('inicio-scroll.png') });
      await scroll.evaluate((node) => { node.scrollTop = 0; });
      await expect(page.getByTestId('home-search')).toBeVisible();
      await expect(page.getByTestId('home-sticky-bar')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.getByTestId('home-search-sticky')).toHaveAttribute('tabindex', '-1');
      await page.getByTestId('home-search').click();
      await expect(page.getByTestId('catalog-search')).toBeFocused();
      await expect(page.locator('[data-testid^="product-card-"]:visible').first()).toBeVisible();
      await page.screenshot({ path: info.outputPath('catalogo.png') });
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test('category photos and missing photos use truthful destinations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 892 });
  await page.route('**/storage/v1/object/public/catalog/products/fixture-published-image.webp*', (route) => route.fulfill({
    path: resolve(import.meta.dirname, '../../../supabase/seed-assets/catalog/demo/ugreen-nexode-30w-1.webp'),
    contentType: 'image/webp',
  }));
  await page.route('**/storage/v1/object/public/catalog/products/fixture-broken-image.webp*', (route) => route.fulfill({ status: 404 }));
  await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
    const response = await route.fetch();
    const feed = await response.json();
    const technology = feed.categories.find((item: { slug: string }) => item.slug === 'tecnologia');
    const audio = feed.categories.find((item: { slug: string }) => item.slug === 'audio');
    const beauty = feed.categories.find((item: { slug: string }) => item.slug === 'belleza');
    technology.image_path = 'products/fixture-published-image.webp';
    audio.image_path = null;
    beauty.image_path = 'products/fixture-broken-image.webp';
    await route.fulfill({ json: feed });
  });
  await page.goto('/');
  await expect(page.getByTestId('category-photo-tecnologia')).toHaveCount(1);
  await expect.poll(() => page.getByTestId('category-photo-tecnologia').locator('img').evaluateAll((images) => images.some((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(page.getByTestId('category-art-audio')).toBeVisible();
  await expect(page.getByTestId('category-art-belleza')).toBeVisible();
  await expect(page.getByText('Algunas imágenes pueden ser ilustrativas.')).toBeVisible();
  const rail = page.getByTestId('home-categories-scroll');
  await rail.scrollIntoViewIfNeeded();
  expect(await rail.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  const labels = await rail.locator('[data-testid^="category-"]').evaluateAll((nodes) => nodes.filter((node) => node.getAttribute('role') === 'link').slice(0, 4).map((node) => node.getAttribute('aria-label')));
  expect(labels).toEqual(['Tecnología', 'Audio', 'Belleza', 'Hogar']);
  await rail.hover(); await page.mouse.wheel(320, 0);
  await expect.poll(() => rail.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await rail.evaluate((node) => { node.scrollLeft = 0; });
  await page.getByTestId('category-tecnologia').click();
  await expect(page).toHaveURL(/category=tecnologia/);
  await page.goBack();
  await page.getByRole('link', { name: 'Ver todas: Explora por categoría' }).click();
  await expect(page.getByTestId('catalog-search')).toBeVisible();
});

test('a failed next page keeps existing products and retries the failed page', async ({ page }) => {
  let fail = true;
  const nextOffsets: number[] = [];
  await page.route('**/rest/v1/rpc/search_products*', async (route) => {
    const body = route.request().postDataJSON();
    if (body.p_sort === 'popular' && body.p_offset === 0) {
      const response = await route.fetch();
      const original = await response.json();
      const template = original[0];
      const items = Array.from({ length: 20 }, (_, index) => ({ ...template, id: `local-feed-${index}`, slug: `local-feed-${index}`, title: `Producto local ${index}` }));
      return route.fulfill({ json: items });
    }
    if (body.p_sort === 'popular' && body.p_offset > 0) {
      nextOffsets.push(body.p_offset);
      if (fail) return route.fulfill({ status: 503, json: { message: 'Controlled local pagination error' } });
      return route.fulfill({ json: [] });
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByTestId('product-card-local-feed-0')).toBeVisible();
  const scroll = page.getByTestId('home-scroll');
  await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const error = page.getByTestId('home-feed-error');
  await expect(error).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('product-card-local-feed-19')).toBeVisible();
  await expect(page.getByTestId('home-feed-end')).toHaveCount(0);
  const previousAttempts = nextOffsets.length;
  fail = false;
  await error.getByRole('button', { name: 'Reintentar' }).click();
  await expect.poll(() => nextOffsets.length).toBeGreaterThan(previousAttempts);
  expect(nextOffsets.every((offset) => offset === 20)).toBe(true);
  await expect(error).toHaveCount(0);
});

test('the all-categories action opens a clean catalog without erasing the Search tab', async ({ page }) => {
  await page.goto('/explore');
  const search = page.getByTestId('catalog-search');
  await search.fill('ugreen');
  await expect(search).toHaveValue('ugreen');
  await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
  await page.getByRole('link', { name: 'Ver todas: Explora por categoría' }).click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId('catalog-search').last()).toHaveValue('');
  await page.goBack();
  await page.getByRole('tab', { name: 'Buscar', exact: true }).click();
  await expect(page.getByTestId('catalog-search').last()).toHaveValue('ugreen');
});

test('a failed catalog feed offers retry instead of claiming everything was seen', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/rpc/search_products*', (route) => {
    const body = route.request().postDataJSON();
    return fail && body.p_sort === 'popular' ? route.fulfill({ status: 503, json: { message: 'Controlled local error' } }) : route.continue();
  });
  await page.goto('/');
  const error = page.getByTestId('home-feed-error');
  await expect(error).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('home-feed-end')).toHaveCount(0);
  fail = false;
  await error.getByRole('button', { name: 'Reintentar' }).click();
  await expect(error).toHaveCount(0);
});

for (const colorScheme of ['light', 'dark'] as const) test(`the legacy Mayami store avatar uses the current mark ${colorScheme}`, async ({ page }, info) => {
  await page.emulateMedia({ colorScheme });
  await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
    const response = await route.fetch();
    const feed = await response.json();
    const store = feed.stores.find((item: { slug: string }) => item.slug === 'kora');
    store.id = '5afbabbf-0678-40ee-a5d8-540f53efe114';
    store.name = 'Mayami';
    store.logo_path = 'demo/kora-logo.webp';
    await route.fulfill({ json: feed });
  });
  await page.goto('/');
  const logo = page.getByTestId('mayami-store-logo');
  await expect(logo).toBeVisible();
  await logo.scrollIntoViewIfNeeded();
  await expect.poll(() => logo.evaluate((node) => {
    const image = node instanceof HTMLImageElement ? node : node.querySelector('img');
    return !!image && image.complete && image.naturalWidth > 0;
  })).toBe(true);
  // Allow neighboring remote images to finish their 150 ms presentation transition.
  await page.waitForTimeout(350);
  await page.screenshot({ path: info.outputPath('tienda-mayami.png') });
});
