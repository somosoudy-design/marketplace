import { expect, test, type Page } from '@playwright/test';

// All responses are in-memory fixtures. Remote hosts and mutations are blocked.
const product = {
  id: '10000000-0000-4000-8000-000000000001', slug: 'fixture-cargador', title: 'Ejemplo cargador USB-C 45 W',
  brand_name: 'Ejemplo', subtitle: null, store_id: '10000000-0000-4000-8000-000000000002', store_name: 'Tienda local',
  store_slug: 'tienda-local', store_kind: 'platform', store_status: 'active', category_id: '10000000-0000-4000-8000-000000000003',
  category_slug: 'cargadores', category_name: 'Cargadores', tone: 'mist', availability: 'available', origin: 'local',
  price_usd: 9999999999.99, compare_at_usd: null, image_path: null, stock_total: 5, lead_min_days: null, lead_max_days: null,
  popularity: 1, published_at: null, is_demo: false, moderation_status: 'published', rating_avg: null, rating_count: 0,
  max_per_order: 1, weight_kg: null, description: null, highlights: [], option_names: [], images: [], is_favorite: false,
  alert_requested: false, related: [], variants: [{ id: '10000000-0000-4000-8000-000000000004', title: 'Única', options: {}, sku: null, active: true, price_usd: 9999999999.99, stock: 5 }],
  store: { id: '10000000-0000-4000-8000-000000000002', name: 'Tienda local', slug: 'tienda-local', logo_path: null, accent: 'plum', kind: 'platform', shipping_info: null, rating_avg: null, rating_count: 0 },
};
const other = { ...product, id: '10000000-0000-4000-8000-000000000005', slug: 'fixture-otro', title: 'Auriculares genéricos', brand_name: null, price_usd: 20 };
async function fixtureOnly(page: Page) {
  const unexpected: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: { user: null } });
    if (!url.pathname.startsWith('/rest/v1/')) return route.continue();
    const rpc = url.pathname.split('/').at(-1);
    if (rpc === 'track_event' || rpc === 'track_recommendation') return route.fulfill({ status: 204, body: '' });
    if (rpc === 'search_products') return route.fulfill({ json: [] });
    if (rpc === 'home_feed') return route.fulfill({ json: { stores: [], categories: [], collections: [], recommended: [product, other], recently_viewed: [product, other], personalized: false } });
    if (rpc === 'product_detail') return route.fulfill({ json: product });
    if (rpc === 'product_reviews') return route.fulfill({ json: { summary: { count: 0, avg: null, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } }, items: [] } });
    if (rpc === 'rate_status') return route.fulfill({ json: { pair: 'USD/VES', available: false, reason: 'stale_or_missing', last: null } });
    if (rpc === 'pricing_today') return route.fulfill({ json: { available: false, reason: 'disabled' } });
    if (request.method() === 'GET') return route.fulfill({ json: [] });
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.abort();
  });
  return unexpected;
}
for (const colorScheme of ['light', 'dark'] as const) {
  test(`vistos recientemente conserva nombre, precio y acciones (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const unexpected = await fixtureOnly(page);
    for (const width of [280, 320, 412]) {
      await page.setViewportSize({ width, height: 892 });
      await page.goto('/');
      const shelf = page.getByTestId('home-recent'); await expect(shelf).toBeAttached(); await shelf.scrollIntoViewIfNeeded();
      const card = shelf.getByTestId(`mini-card-${product.slug}`), favorite = shelf.getByTestId(`card-favorite-${product.slug}`);
      await expect(card.getByTestId('mini-title')).toHaveText('cargador USB-C 45 W');
      await expect(card.getByTestId('mini-brand')).toHaveText('Ejemplo');
      await expect(card.getByTestId('mini-price')).toHaveText('$9.999.999.999,99');
      await expect(card).toHaveAccessibleName(/Ejemplo cargador USB-C 45 W.*\$9\.999\.999\.999,99/);
      await expect(shelf.getByTestId('mini-card-fixture-otro').getByTestId('mini-brand')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      if (width <= 320) await shelf.evaluate((root) => {
        for (const node of root.querySelectorAll<HTMLElement>('[dir="auto"]')) {
          const style = getComputedStyle(node); node.style.fontSize = `${parseFloat(style.fontSize) * 1.6}px`;
          if (parseFloat(style.lineHeight)) node.style.lineHeight = `${parseFloat(style.lineHeight) * 1.6}px`;
        }
      });
      const [priceBox, cardBox, favBox] = await Promise.all([card.getByTestId('mini-price').boundingBox(), card.boundingBox(), favorite.boundingBox()]);
      expect(priceBox!.x + priceBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 0.5);
      expect(priceBox!.y).toBeGreaterThanOrEqual(favBox!.y + favBox!.height - 0.5);
      expect(favBox!.width).toBeGreaterThanOrEqual(44); expect(favBox!.height).toBeGreaterThanOrEqual(44);
      const amount = await card.getByTestId('mini-price').evaluate((element) => {
        const range = document.createRange(); range.selectNodeContents(element);
        return { width: element.clientWidth, scroll: element.scrollWidth, lines: range.getClientRects().length };
      });
      expect(amount.scroll).toBeLessThanOrEqual(amount.width + 1); expect(amount.lines).toBe(1);
    }
    await page.setViewportSize({ width: 320, height: 892 }); await page.goto('/');
    const shelf = page.getByTestId('home-recent'), card = shelf.getByTestId(`mini-card-${product.slug}`);
    await shelf.scrollIntoViewIfNeeded(); await card.focus(); await expect(card).toBeFocused(); await page.keyboard.press('Enter');
    await expect(page.getByTestId('product-title')).toHaveText(product.title); await page.goBack(); await shelf.scrollIntoViewIfNeeded();
    const favorite = shelf.getByTestId(`card-favorite-${product.slug}`);
    await favorite.focus(); await expect(favorite).toBeFocused(); await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/sign-in/);
    expect(unexpected).toEqual([]);
  });
}
