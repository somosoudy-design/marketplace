import { expect, test, type Page } from '@playwright/test';

async function localRoutes(page: Page, optedOut = false) {
  const events: { p_slot: string; p_kind: string; p_product_ids: string[] }[] = [], blocked: string[] = [];
  let recentIds: string[] = [];
  let recentProducts: unknown[] | undefined;
  await page.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) { blocked.push(`${req.method()} ${u.pathname}`); return route.abort(); }
    if (u.port !== '54321') return route.continue();
    if (u.pathname.endsWith('/rpc/track_recommendation')) { events.push(req.postDataJSON()); return route.fulfill({ json: null }); }
    if (u.pathname.endsWith('/rpc/track_event')) return route.fulfill({ status: 204, body: '' });
    if (u.pathname.endsWith('/rpc/home_feed')) {
      const response = await route.fetch(), feed = await response.json();
      if (!Array.isArray(feed.recommended) || feed.recommended.length < 4) throw Error('Local seed must have four recommendations');
      // Keep the mocked recent shelf stable across background feed refreshes: recommendation
      // ranking can change between requests and is unrelated to this visibility assertion.
      recentProducts ??= feed.recommended.slice(0, 4);
      feed.recently_viewed = recentProducts; recentIds = feed.recently_viewed.map((p: { id: string }) => p.id);
      return route.fulfill({ response, json: feed });
    }
    if (optedOut && u.pathname.startsWith('/rest/v1/profiles') && req.method() === 'GET') {
      const response = await route.fetch(); const rows = await response.json();
      const value = Array.isArray(rows) ? rows.map((r) => ({ ...r, personalization_enabled: false })) : { ...rows, personalization_enabled: false };
      return route.fulfill({ response, json: value });
    }
    const readRpc = ['/rpc/search_products','/rpc/rate_status','/rpc/pricing_today','/rpc/product_detail','/rpc/product_reviews','/rpc/cart_summary'].some((suffix) => u.pathname.endsWith(suffix));
    if (req.method() === 'GET' || req.method() === 'OPTIONS' || u.pathname === '/auth/v1/token' || readRpc) return route.continue();
    blocked.push(`${req.method()} ${u.pathname}`); return route.abort();
  });
  return { events, blocked, getIds: () => recentIds };
}
async function signIn(page: Page) {
  await page.goto('/sign-in'); await page.getByTestId('sign-in-email').fill('comprador@example.com');
  await page.getByTestId('sign-in-password').fill('Demo-1234'); await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}
function impressions(state: Awaited<ReturnType<typeof localRoutes>>) {
  return state.events.filter((e) => e.p_slot === 'home_recent' && e.p_kind === 'impression').flatMap((e) => e.p_product_ids);
}
test('el anaquel reciente no cuenta al montarse ni incluye tarjetas <60% visibles', async ({ page }) => {
  const state = await localRoutes(page); await page.setViewportSize({ width: 320, height: 400 }); await signIn(page);
  for (const [width, expected] of [[280, 1], [320, 1], [412, 1], [720, 2]] as const) {
    state.events.length = 0; await page.setViewportSize({ width, height: 400 }); await page.goto('/');
    const shelf = page.getByTestId('home-recent'); await expect(shelf).toBeAttached();
    await page.waitForTimeout(1500); expect(impressions(state)).toEqual([]);
    await shelf.scrollIntoViewIfNeeded(); await expect.poll(() => impressions(state).length, { timeout: 5000 }).toBe(expected);
    expect(impressions(state)).toEqual(state.getIds().slice(0, expected));
    await page.waitForTimeout(1400); expect(impressions(state)).toEqual(state.getIds().slice(0, expected));
  }
  expect(state.blocked).toEqual([]);
});
test('sin personalización no se registran impresiones del anaquel', async ({ page }) => {
  const state = await localRoutes(page, true); await page.setViewportSize({ width: 320, height: 400 }); await signIn(page); await page.goto('/');
  const shelf = page.getByTestId('home-recent'); await expect(shelf).toBeAttached(); await shelf.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800); expect(impressions(state)).toEqual([]); expect(state.blocked).toEqual([]);
});
