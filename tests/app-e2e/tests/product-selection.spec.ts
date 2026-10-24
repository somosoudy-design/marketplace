import { expect, test, type Page } from '@playwright/test';
import type { ProductDetail } from '@kora/api';

const enabled = process.env.KORA_PRODUCT_SELECTION_TEST === 'readonly';
const id = '0d93e509-6738-4d99-88ec-a5a1f5d08fdf';
const rpc = new Set(['home_feed', 'search_products', 'product_detail', 'product_reviews', 'rate_status', 'pricing_today', 'support_info', 'public_support']);
async function readOnly(page: Page) {
  await page.route('**/rest/v1/**', (r) => {
    const q = r.request(), u = new URL(q.url());
    if (u.hostname !== 'mimnotafmfasvwrclxan.supabase.co') throw new Error('Only Marketplace preview');
    if (u.pathname.endsWith('/track_event')) return r.fulfill({ status: 204, body: '' });
    if (q.method() === 'GET' || q.method() === 'POST' && rpc.has(u.pathname.split('/').at(-1)!)) return r.continue();
    throw new Error(`Unexpected remote mutation ${u.pathname}`);
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`purchase selection ${colorScheme}`, () => {
    test.skip(!enabled, 'Read-only preview export required');
    test.use({ colorScheme, viewport: { width: 412, height: 892 }, reducedMotion: 'reduce' });
    test.beforeEach(async ({ page }) => readOnly(page));

    test('persistent summary returns to the measured selection and sends the selected color/quantity to cart', async ({ page }, info) => {
      await page.goto(`/product/${id}`);
      const summary = page.getByTestId('product-selection-summary');
      await expect(summary).toContainText('Salvia · 1 unidad');
      await expect(summary).toContainText('89,00');
      await page.getByTestId('product-description').scrollIntoViewIfNeeded();
      await expect(summary).toBeInViewport(); await summary.focus(); await page.keyboard.press('Enter');
      await expect(page.getByTestId('product-selection-heading')).toBeFocused();
      await page.keyboard.press('Tab'); await expect(page.getByTestId('variant-Salvia')).toBeFocused();
      const selected = page.getByTestId('product-selection');
      await expect(selected).toBeInViewport();
      expect((await selected.boundingBox())!.y).toBeGreaterThanOrEqual(60);
      const selectionBox = (await selected.boundingBox())!;
      expect(selectionBox.y + selectionBox.height).toBeLessThanOrEqual((await page.getByTestId('product-purchase-bar').boundingBox())!.y);
      await page.screenshot({ path: info.outputPath('selector-destino.png') });
      await selected.getByRole('button', { name: 'Aumentar cantidad' }).click();
      await expect(summary).toContainText('2 unidades');
      await expect(page.getByTestId('product-selected-price')).toContainText('89,00'); // unit, not a new client total
      await page.getByTestId('variant-Arena').click(); await expect(summary).toContainText('Arena · 1 unidad');
      await page.getByTestId('product-add').click(); await expect(page.getByTestId('added-to-cart')).toContainText('Arena');
      await page.getByTestId('product-cta').click();
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(1);
      await expect(page.getByTestId('cart-subtotal')).toContainText('89,00');
      await expect(page.getByTestId('cart-line-f984e205-a702-4f95-b0e2-c2249127a4a0')).toContainText('Arena');
    });

    test('a slow local persistence locks editing and rejects rapid duplicate submissions', async ({ page }) => {
      await page.addInitScript(() => {
        const state = window as typeof window & { releaseGuest?: () => void; guestWrites: number };
        state.guestWrites = 0;
        const original = Storage.prototype.setItem;
        Object.defineProperty(Storage.prototype, 'setItem', { value(this: Storage, key: string, value: string) {
          original.call(this, key, value);
          if (key === 'kora.guest-cart.v1') {
            state.guestWrites++;
            return new Promise<void>((resolve) => { state.releaseGuest = resolve; });
          }
        } });
      });
      await page.goto(`/product/${id}`); await expect(page.getByTestId('product-add')).toBeVisible();
      await page.getByTestId('product-add').evaluate((button) => { (button as HTMLElement).click(); (button as HTMLElement).click(); });
      try {
        await expect(page.getByTestId('variant-Arena')).toBeDisabled();
        await expect(page.getByTestId('product-selection-summary')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled();
        await expect(page.getByTestId('product-cta')).toBeDisabled();
        expect(await page.evaluate(() => (window as typeof window & { guestWrites: number }).guestWrites)).toBe(1);
      } finally { await page.evaluate(() => (window as typeof window & { releaseGuest?: () => void }).releaseGuest?.()); }
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId('variant-Arena').click();
      await expect(page.getByTestId('added-to-cart')).toHaveCount(0);
      await expect(page.getByTestId('product-selection-summary')).toContainText('Arena');
    });

    test('320px, long variants and enlarged web text keep selection, unit price and action readable', async ({ page }, info) => {
      await page.setViewportSize({ width: 320, height: 892 });
      const response = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail') && r.ok());
      await page.goto(`/product/${id}`); const actual: ProductDetail = await (await response).json();
      // Controlled rendering stress only. No remote product or commercial price is changed.
      await page.route('**/rpc/product_detail', (r) => r.fulfill({ json: { ...actual, max_per_order: 2, variants: actual.variants.map((v, i) => ({ ...v, title: i ? 'Arena cálida · edición de exposición' : v.title, price_usd: i ? 99.5 : v.price_usd })) } }));
      await page.reload(); await page.getByTestId('variant-Arena cálida · edición de exposición').click();
      const selection = page.getByTestId('product-selection');
      const choice = await page.getByTestId('variant-Arena cálida · edición de exposición').boundingBox();
      expect(choice!.x + choice!.width).toBeLessThanOrEqual(300);
      const choiceText = await page.getByTestId('variant-Arena cálida · edición de exposición').locator('[dir="auto"]').evaluateAll((nodes) => nodes.map((n) => ({ width: n.clientWidth, scrollWidth: n.scrollWidth, height: n.clientHeight, scrollHeight: n.scrollHeight })));
      expect(choiceText.every((b) => b.scrollWidth <= b.width + 1 && b.scrollHeight <= b.height + 1)).toBe(true);
      await selection.getByRole('button', { name: 'Aumentar cantidad' }).click();
      await expect(selection.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled();
      await expect(page.getByTestId('product-selected-price')).toContainText('99,50');
      const bar = page.getByTestId('product-purchase-bar');
      await bar.evaluate((root) => {
        for (const node of root.querySelectorAll<HTMLElement>('[dir="auto"]')) {
          const css = getComputedStyle(node); const size = parseFloat(css.fontSize), line = parseFloat(css.lineHeight);
          node.style.fontSize = `${size * 1.6}px`; if (line) node.style.lineHeight = `${line * 1.6}px`;
        }
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await expect(page.getByTestId('product-cta')).toBeInViewport();
      const boxes = await bar.locator('[dir="auto"]').evaluateAll((nodes) => nodes.map((n) => ({ width: n.clientWidth, scrollWidth: n.scrollWidth, height: n.clientHeight, scrollHeight: n.scrollHeight })));
      expect(boxes.every((b) => b.scrollWidth <= b.width + 1 && b.scrollHeight <= b.height + 1)).toBe(true);
      await page.getByTestId('product-description').scrollIntoViewIfNeeded();
      await page.getByTestId('product-selection-summary').click(); await expect(selection).toBeInViewport();
      const selectedBox = (await selection.boundingBox())!;
      expect(selectedBox.y + selectedBox.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
      await page.screenshot({ path: info.outputPath('seleccion-estres-web.png') });
    });

    test('sold-out product keeps stock alert and never shows a purchasable selection summary', async ({ page }) => {
      await page.goto('/p/audifonos-deportivos');
      await expect(page.getByTestId('product-cta')).toContainText('Avisarme cuando vuelva');
      await expect(page.getByTestId('product-selection-summary')).toHaveCount(0);
      await expect(page.getByTestId('product-add')).toHaveCount(0);
      await page.getByTestId('product-cta').click(); await expect(page.getByTestId('sign-in-submit')).toBeVisible();
    });
  });
}
