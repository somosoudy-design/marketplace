import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Entrega 01 ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 320, height: 780 }, reducedMotion: 'reduce' });

    test('products occupy the first view and search/tools remain reachable after scrolling', async ({ page }) => {
      await page.goto('/explore');
      const first = page.locator('[data-testid^="product-surface-"]').first();
      await expect(first).toBeVisible();
      const firstBox = (await first.boundingBox())!;
      expect(firstBox.y).toBeLessThan(180); // previous actual baseline: 270px
      const secondRow = page.locator('[data-testid^="product-surface-"]').nth(3);
      const rowBox = (await secondRow.boundingBox())!;
      expect(rowBox.y + rowBox.height).toBeLessThan(700); // four complete products above tabs at 320px
      await page.getByTestId('chip-category-belleza').click();
      await expect(page.getByTestId('catalog-count')).toContainText('Belleza');
      const list = page.getByTestId('explore-list');
      await page.waitForLoadState('networkidle');
      await list.hover();
      await page.mouse.wheel(0, 600);
      await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
      await expect(page.getByTestId('catalog-count')).toContainText('Belleza');
      for (const id of ['catalog-search', 'catalog-filter', 'chip-sort']) {
        const control = page.getByTestId(id);
        await expect(control).toBeVisible();
        const box = (await control.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
    });

    test('secondary filters are a cancellable draft and apply together to the existing search RPC', async ({ page }) => {
      let last: Record<string, unknown> = {};
      page.on('request', (request) => { if (request.url().includes('/rpc/search_products')) last = request.postDataJSON(); });
      await page.goto('/explore');
      await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible();
      await page.getByTestId('catalog-filter').click();
      const available = page.getByTestId('chip-availability-available');
      await available.focus();
      await page.keyboard.press('Space');
      await page.getByRole('radio', { name: '15 a 50 USD', exact: true }).click();
      await expect(available).toHaveAttribute('aria-checked', 'true');
      expect(last.p_availability).toBeNull();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('catalog-filters')).toHaveCount(0);
      await page.getByTestId('catalog-filter').click();
      await expect(available).toHaveAttribute('aria-checked', 'false');
      await available.click();
      await page.getByRole('radio', { name: '15 a 50 USD', exact: true }).click();
      await page.getByTestId('catalog-apply-filters').click();
      await expect.poll(() => last.p_availability).toEqual(['available']);
      expect(last.p_min_price).toBe(15);
      expect(last.p_max_price).toBe(50);
      await expect(page.getByTestId('catalog-filter')).toHaveAccessibleName('Filtrar, 2 activos');
      await page.getByTestId('catalog-filter').click();
      await page.getByRole('button', { name: 'Restablecer precio y disponibilidad', exact: true }).click();
      await page.getByTestId('catalog-apply-filters').click();
      await expect(page.getByTestId('catalog-filter')).toHaveAccessibleName('Filtrar');
      await page.getByTestId('catalog-filter').click();
      await expect(available).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('radio', { name: 'Cualquier precio', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Escape');
    });

    test('keyboard sorting announces its current choice and Escape keeps it', async ({ page }) => {
      await page.goto('/explore');
      const sort = page.getByTestId('chip-sort');
      await sort.focus();
      await page.keyboard.press('Space');
      await page.getByRole('radio', { name: 'Menor precio', exact: true }).focus();
      await page.keyboard.press('Space');
      await expect(sort).toHaveAccessibleName('Ordenar: Menor precio');
      await expect(page.getByText('Menor precio', { exact: true })).toBeVisible();
      await sort.click();
      await expect(page.getByRole('radio', { name: 'Menor precio', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.keyboard.press('Escape');
      await expect(sort).toHaveAccessibleName('Ordenar: Menor precio');
    });

    test('commercial states stay visible, favourites are discreet and touchable, titles remain one line', async ({ page }) => {
      // Controlled visual fixtures only: no catalog, financial or remote data is changed.
      await page.route('**/rest/v1/rpc/search_products*', async (route) => {
        const response = await route.fetch();
        const [product] = await response.json();
        await route.fulfill({ json: [
          { ...product, slug: 'visual-normal', is_demo: false, availability: 'available', compare_at_usd: null, stock_total: 100 },
          { ...product, id: '00000000-0000-0000-0000-000000000011', slug: 'visual-offer', is_demo: false, availability: 'available', price_usd: 10, compare_at_usd: 20, stock_total: 2 },
          { ...product, id: '00000000-0000-0000-0000-000000000012', slug: 'visual-empty', is_demo: false, availability: 'sold_out', stock_total: 0 },
          { ...product, id: '00000000-0000-0000-0000-000000000013', slug: 'visual-order', is_demo: false, availability: 'on_order' },
          { ...product, id: '00000000-0000-0000-0000-000000000014', slug: 'visual-demo', is_demo: true, price_usd: 10, compare_at_usd: 20, stock_total: 2 },
        ] });
      });
      await page.goto('/explore');
      const offer = page.getByTestId('product-surface-visual-offer');
      await expect(offer.getByText('−50 %', { exact: true })).toBeVisible();
      await expect(offer.getByText('Quedan 2', { exact: true })).toBeVisible();
      await expect(page.getByTestId('product-surface-visual-empty').getByText('Agotado', { exact: true })).toBeVisible();
      await expect(page.getByTestId('product-surface-visual-order').getByText('Por encargo', { exact: true })).toBeVisible();
      const demo = page.getByTestId('product-surface-visual-demo');
      await expect(demo.getByText('Demo', { exact: true })).toBeVisible();
      await expect(demo.getByText(/−50|Quedan/)).toHaveCount(0);
      const favorite = page.getByTestId('card-favorite-visual-normal');
      const box = (await favorite.boundingBox())!;
      expect(box.width).toBe(44);
      expect(box.height).toBe(44);
      await expect(favorite.locator('svg')).toHaveAttribute('width', '19');
      expect((await offer.getByTestId('card-title').boundingBox())!.height).toBeLessThanOrEqual(18);
      await favorite.click();
      await expect(page).toHaveURL(/sign-in/); // saving a visitor never opens the product
    });

    test('loading uses the card geometry and refreshing keeps the catalog in place', async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let blocked = true;
      await page.route('**/rest/v1/rpc/search_products*', async (route) => { if (blocked) await held; await route.continue(); });
      await page.goto('/explore');
      const skeleton = page.getByTestId('catalog-card-loading').first();
      await expect(skeleton).toBeVisible();
      const skeletonBox = (await skeleton.boundingBox())!;
      blocked = false;
      release();
      const card = page.locator('[data-testid^="product-surface-"]').first();
      await expect(card).toBeVisible();
      const cardBox = (await card.boundingBox())!;
      expect(cardBox.y).toBe(skeletonBox.y);
      expect(cardBox.height).toBe(skeletonBox.height);
      const before = (await page.getByTestId('catalog-controls').boundingBox())!;
      await page.getByTestId('chip-category-belleza').click();
      await expect(page.getByTestId('catalog-controls')).toBeVisible();
      expect((await page.getByTestId('catalog-controls').boundingBox())!.height).toBe(before.height);
    });
  });
}
