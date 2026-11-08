import type { HomeFeed, ProductCard } from '@kora/api';
import { expect, test, type Page } from '@playwright/test';

// Opt-in against the preview export. All requests below are public reads; never sign in or create remote data.
const enabled = process.env.KORA_HOME_PUBLISHED_TEST === 'readonly';
const readOnlyRpc = new Set(['home_feed', 'search_products', 'product_detail', 'product_reviews', 'rate_status', 'pricing_today', 'support_info', 'public_support']);

async function readOnly(page: Page) {
  await page.route('**/rest/v1/**', (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname !== 'mimnotafmfasvwrclxan.supabase.co') throw new Error('Only Marketplace preview is allowed');
    // Product navigation emits ordinary analytics. Handle it locally, so this read-only test sends no event.
    if (url.pathname.endsWith('/rpc/track_event')) return route.fulfill({ status: 204, body: '' });
    if (request.method() === 'GET' || (request.method() === 'POST' && readOnlyRpc.has(url.pathname.split('/').at(-1)!))) return route.continue();
    throw new Error(`Unexpected mutation: ${url.pathname}`);
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`published Home opening ${colorScheme}`, () => {
    test.skip(!enabled, 'Requires a private-preview web export and explicit read-only mode');
    test.use({ colorScheme, viewport: { width: 412, height: 892 } });
    test.beforeEach(async ({ page }) => readOnly(page));

    test('opens the actual product, preserves every collection and avoids repeated recommendations', async ({ page }) => {
      const homeResponse = page.waitForResponse((response) => response.url().endsWith('/rpc/home_feed') && response.ok());
      const recentResponse = page.waitForResponse((response) => response.url().endsWith('/rpc/search_products') && response.request().postDataJSON()?.p_sort === 'newest' && response.ok());
      await page.goto('/');
      const feed: HomeFeed = await (await homeResponse).json();
      const recent: ProductCard[] = await (await recentResponse).json();
      const opening = page.getByTestId('home-product-opening'); await expect(opening).toBeVisible();
      const actual = recent.find((p) => !p.is_demo && p.moderation_status === 'published' && p.store_status === 'active')!;
      expect(actual).toBeTruthy();
      await expect(opening).toContainText(actual.title);
      await expect(opening).toContainText('Ver producto');
      await expect(opening).not.toContainText('Ver colección');
      await expect(opening.getByRole('button')).toHaveCount(0);
      await expect(page.locator('[data-testid="catalog-exhibition-notice"]:visible')).toHaveCount(1);
      for (const collection of feed.collections.filter((c) => c.products.length)) await expect(page.getByTestId(`collection-${collection.slug}`)).toHaveCount(1);
      await expect(page.locator(`[data-testid^="home-recommended"] [data-testid="product-card-${actual.slug}"]`)).toHaveCount(0);
      await opening.click();
      await expect(page.getByTestId('product-title')).toHaveText(actual.title);
      await expect(page).toHaveURL(new RegExp(`/product/${actual.id}`));
      await page.getByTestId('product-back').click(); await expect(opening).toBeVisible();
      await page.getByTestId('category-tecnologia').click(); await expect(page).toHaveURL(/category=tecnologia/);
      await page.goBack(); await page.getByTestId('home-search').click(); await expect(page.getByTestId('catalog-search')).toBeFocused();
    });

    test('an unavailable recent request leaves the editorial collection and navigation usable', async ({ page }) => {
      await page.route('**/rpc/search_products', (route) => route.request().postDataJSON().p_sort === 'newest'
        ? route.fulfill({ status: 503, json: { message: 'Controlled read failure' } }) : route.continue());
      await page.goto('/');
      const hero = page.getByTestId('home-hero'); await expect(hero).toBeVisible();
      await expect(page.getByTestId('home-product-opening')).toHaveCount(0);
      await expect(hero.getByText('Ver colección', { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid^="home-recommended"] [data-testid^="product-card-"]')).toHaveCount(4);
      await hero.getByRole('link').click(); await expect(page).toHaveURL(/collection=/);
      await expect(page.getByTestId('catalog-filter')).toBeVisible();
    });

    test('a live opening is not described as an empty catalog when other shelves are empty', async ({ page }) => {
      // Observe the actual browser response first; route.fetch uses Node networking, which is unavailable in
      // some cloud setups even when the configured browser can reach the same read-only API normally.
      const response = page.waitForResponse((response) => response.url().endsWith('/rpc/home_feed') && response.ok());
      await page.goto('/'); const feed: HomeFeed = await (await response).json();
      await page.route('**/rpc/home_feed', (route) => route.fulfill({ json: { ...feed, recommended: [], collections: [], stores: [] } }));
      await page.route('**/rpc/search_products', (route) => route.request().postDataJSON().p_sort === 'newest'
        ? route.continue() : route.fulfill({ json: [] }));
      await page.goto('/'); await expect(page.getByTestId('home-product-opening')).toBeVisible();
      await expect(page.locator('[data-testid^="home-recommended"] [data-testid^="product-card-"]')).toHaveCount(0);
      await expect(page.getByTestId('home-catalog-empty')).toHaveCount(0);
    });

    test('a failed refresh does not keep promoting the old recent price silently', async ({ page }) => {
      let fail = false; let failedRequests = 0;
      await page.route('**/rpc/search_products', (route) => {
        if (fail && route.request().postDataJSON().p_sort === 'newest') {
          failedRequests++;
          return route.fulfill({ status: 503, json: { message: 'Controlled refresh failure' } });
        }
        return route.continue();
      });
      await page.goto('/'); await expect(page.getByTestId('home-product-opening')).toBeVisible();
      await page.clock.install(); await page.clock.fastForward(31_000); fail = true;
      await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
      await expect.poll(() => failedRequests).toBeGreaterThan(0);
      await page.clock.fastForward(10_000);
      await expect(page.getByTestId('home-product-opening')).toHaveCount(0);
      await expect(page.getByTestId('home-hero').getByText('Ver colección', { exact: true })).toBeVisible();
    });

    test('320px and enlarged web text keep title, price and destination readable', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 892 }); await page.goto('/');
      const opening = page.getByTestId('home-product-opening'); await expect(opening).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const band = await page.getByTestId('home-hero').boundingBox(); expect(band!.y + band!.height).toBeLessThanOrEqual(355);
      const row = await page.getByTestId('home-recommended').boundingBox(); expect(row!.y + row!.height).toBeLessThan(815);
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll<HTMLElement>('[data-testid="home-product-opening"] [dir="auto"]')];
        const original = nodes.map((n) => ({ n, size: parseFloat(getComputedStyle(n).fontSize), line: parseFloat(getComputedStyle(n).lineHeight) }));
        for (const { n, size, line } of original) { n.style.fontSize = `${size * 1.6}px`; if (line) n.style.lineHeight = `${line * 1.6}px`; }
      });
      const text = await opening.evaluate((root) => [...root.querySelectorAll<HTMLElement>('[dir="auto"]')].map((n) => ({ width: n.clientWidth, scrollWidth: n.scrollWidth, height: n.clientHeight, scrollHeight: n.scrollHeight })));
      expect(text.every((n) => n.scrollWidth <= n.width + 1 && n.scrollHeight <= n.height + 1)).toBe(true);
      await expect(opening.getByText('Ver producto', { exact: true })).toBeVisible();
    });
  });
}
