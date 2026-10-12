import type { HomeFeed } from '@kora/api';
import { expect, test, type Page } from '@playwright/test';

const cards = (page: Page) => page.locator('[data-testid^="home-recommended"] [data-testid^="product-card-"]');

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Home V2 (${colorScheme})`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 } });

    test('one honest editorial destination, four distinct recommendations and every collection remains reachable', async ({ page }) => {
      let feed: HomeFeed;
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); feed = await response.json(); await route.fulfill({ response });
      });
      await page.goto('/');
      await expect(cards(page)).toHaveCount(4);
      const hero = page.getByTestId('home-hero');
      await expect(hero.getByRole('link')).toHaveCount(1);
      await expect(hero).toContainText('Producto mostrado · Demo');
      await expect(hero.getByRole('link').getByRole('button')).toHaveCount(0);
      const featured = feed!.collections.find((c) => c.layout === 'feature')!;
      const shown = featured.products[0]!;
      await expect(hero.getByRole('link')).toHaveAccessibleName(new RegExp(shown.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const identifiers = await cards(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')));
      expect(new Set(identifiers).size).toBe(4);
      expect(identifiers).not.toContain(`product-card-${shown.slug}`);
      for (const collection of feed!.collections.filter((c) => c.products.length && c.id !== featured.id)) {
        await expect(page.getByTestId(`collection-${collection.slug}`)).toHaveCount(1);
      }
      await hero.getByRole('link').click();
      await expect(page).toHaveURL(new RegExp(`collection=${featured.slug}`));
      await expect(page.getByTestId('catalog-filter')).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId('home-hero')).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
    });

    test('categories, focused search, product return and visitor favorite remain independent', async ({ page }) => {
      await page.goto('/');
      const category = page.getByTestId('category-tecnologia');
      const box = await category.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
      await category.click(); await expect(page).toHaveURL(/category=tecnologia/);
      await page.goBack();
      const first = cards(page).first();
      const slug = (await first.getAttribute('data-testid'))!.replace('product-card-', '');
      await first.click(); await expect(page.getByTestId('product-title')).toBeVisible();
      await page.getByTestId('product-back').click(); await expect(cards(page).first()).toBeVisible();
      await page.getByTestId('home-recommended').getByTestId(`card-favorite-${slug}`).click();
      await expect(page.getByTestId('sign-in-submit')).toBeVisible(); await page.goBack();
      await page.getByTestId('home-search').click(); await expect(page.getByTestId('catalog-search')).toBeFocused();
    });

    test('320px keeps editorial text, price, categories and a complete comparison row visible', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 892 }); await page.goto('/');
      await expect(cards(page)).toHaveCount(4);
      await expect(page.getByTestId('home-editorial-price')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const row = page.getByTestId('home-recommended'); const box = await row.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(815);
      await expect(page.getByRole('tab')).toHaveCount(4);
    });

    test('fallback has no empty editorial space or invented products when collections are absent', async ({ page }) => {
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); const feed = await response.json(); await route.fulfill({ json: { ...feed, collections: [] } });
      });
      await page.goto('/'); await expect(cards(page)).toHaveCount(4);
      await expect(page.getByTestId('home-hero')).toHaveCount(0);
      await expect(page.getByTestId('home-catalog-empty')).toHaveCount(0);
      await expect(page.getByTestId('home-recent')).toHaveCount(0);
    });

    test('few recommendations keep real order, a backend personalization flag cannot personalize a visitor', async ({ page }) => {
      let slugs: string[] = [];
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); const feed = await response.json();
        slugs = feed.recommended.slice(0, 2).map((p: { slug: string }) => p.slug);
        await route.fulfill({ json: { ...feed, collections: [], recommended: feed.recommended.slice(0, 2), personalized: true } });
      });
      await page.goto('/'); await expect(cards(page)).toHaveCount(2);
      expect(await cards(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')!.replace('product-card-', '')))).toEqual(slugs);
      await expect(page.getByRole('heading', { name: 'Para empezar', exact: true })).toBeVisible();
      await expect(page.getByText('Elegidos para ti', { exact: true })).toHaveCount(0);
    });

    test('empty recommendations do not mislabel collections as an empty marketplace', async ({ page }) => {
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); const feed = await response.json(); await route.fulfill({ json: { ...feed, recommended: [] } });
      });
      await page.route('**/rest/v1/rpc/search_products*', (route) => route.fulfill({ json: [] }));
      await page.goto('/'); await expect(page.getByTestId('home-hero')).toBeVisible();
      await expect(page.getByTestId('home-catalog-empty')).toHaveCount(0);
    });

    test('editorial exceptional availability is explicit and has only a collection action', async ({ page }) => {
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); const feed = await response.json();
        const first = feed.collections.find((c: { layout: string }) => c.layout === 'feature'); first.products[0] = { ...first.products[0], availability: 'sold_out' };
        await route.fulfill({ json: feed });
      });
      await page.goto('/'); await expect(page.getByTestId('home-hero')).toContainText('Agotado');
      await expect(page.getByTestId('home-hero').getByRole('link')).toHaveCount(1);
    });

    test('larger web text grows the editorial block without clipping or losing its action', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 892 }); await page.goto('/');
      await expect(cards(page)).toHaveCount(4);
      await page.evaluate(() => {
        const nodes = [...document.querySelectorAll<HTMLElement>('[dir="auto"]')];
        const metrics = nodes.map((n) => ({ n, size: parseFloat(getComputedStyle(n).fontSize), line: parseFloat(getComputedStyle(n).lineHeight) }));
        for (const { n, size, line } of metrics) { n.style.fontSize = `${size * 1.6}px`; if (line) n.style.lineHeight = `${line * 1.6}px`; }
      });
      const hero = page.getByTestId('home-hero'); await hero.getByRole('link').scrollIntoViewIfNeeded();
      await expect(hero.getByText('Ver colección', { exact: true })).toBeVisible();
      const limits = await hero.evaluate((root) => [...root.querySelectorAll<HTMLElement>('[dir="auto"]')].map((el) => ({ scroll: el.scrollHeight, height: el.clientHeight })));
      expect(limits.every((l) => l.scroll <= l.height + 1)).toBe(true);
      await page.screenshot({ path: `../../docs/capturas/inicio-v2/after/${colorScheme}-320-texto-ampliado.png` });
    });

    test('real local session waits for profile and measures rows, not their heading, in the correct slot', async ({ page }) => {
      const events: { p_slot: string; p_kind: string; p_product_ids: string[] }[] = [];
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/rest/v1/profiles?*', async (route) => {
        const response = await route.fetch();
        const rows = await response.json();
        expect(rows[0].personalization_enabled).toBe(true);
        await gate; await route.fulfill({ response });
      });
      await page.route('**/rest/v1/rpc/home_feed*', async (route) => {
        const response = await route.fetch(); const feed = await response.json();
        await route.fulfill({ json: { ...feed, personalized: true } });
      });
      await page.route('**/rest/v1/rpc/track_recommendation*', async (route) => {
        events.push(route.request().postDataJSON()); await route.continue();
      });
      await page.setViewportSize({ width: 412, height: 420 });
      await page.goto('/sign-in');
      await page.getByTestId('sign-in-email').fill('comprador@example.com');
      await page.getByTestId('sign-in-password').fill('Demo-1234');
      await page.getByTestId('sign-in-submit').click();
      await expect(page).not.toHaveURL(/sign-in/);
      await page.goto('/'); await expect(cards(page)).toHaveCount(4);
      const row = page.getByTestId('home-recommended');
      const list = page.getByTestId('home-scroll');
      const position = await row.boundingBox(); const viewport = await list.boundingBox();
      await page.mouse.move(150, 100);
      await page.mouse.wheel(0, position!.y - (viewport!.y + viewport!.height) - 2);
      await expect.poll(async () => (await row.boundingBox())!.y).toBeGreaterThan(viewport!.y + viewport!.height);
      await page.waitForTimeout(1400); expect(events.filter((e) => e.p_slot.startsWith('home_'))).toHaveLength(0);
      release();
      await expect(page.getByRole('heading', { name: 'Elegidos para ti', exact: true })).toBeVisible();
      await page.waitForTimeout(1400); expect(events.filter((e) => e.p_slot.startsWith('home_'))).toHaveLength(0);
      await page.mouse.wheel(0, 60);
      await expect.poll(async () => (await row.boundingBox())!.y).toBeLessThan(viewport!.y + viewport!.height);
      await expect.poll(() => events.filter((e) => e.p_kind === 'impression' && e.p_slot === 'home_for_you').flatMap((e) => e.p_product_ids).length).toBe(2);
      const first = cards(page).first(); await first.click();
      await expect(page.getByTestId('product-title')).toBeVisible();
      expect(events.some((e) => e.p_kind === 'click' && e.p_slot === 'home_for_you')).toBe(true);
      expect(events.some((e) => e.p_slot === 'home_featured')).toBe(false);
    });
  });
}
