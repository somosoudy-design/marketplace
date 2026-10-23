import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { newBuyer } from './support/db';

const stage = process.env.HAYAZGO_QUALITY_STAGE === 'before' ? 'before' : 'after';
const root = resolve(import.meta.dirname, `../../../.local/ux-20261023/composition/${stage}`);

async function filledCart(page: Page, label: string) {
  const buyer = await newBuyer(label);
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  for (const slug of ['ugreen-cable-usb-c-100w', 'lampara-mesa-lino']) {
    await page.goto(`/p/${slug}`);
    await page.getByTestId('product-cta').click();
    await expect(page).toHaveURL(/\/cart$/);
  }
  await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
}

async function capture(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => {
    const r = image.getBoundingClientRect();
    return r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth || !r.width || !r.height || (image.complete && image.naturalWidth > 0);
  }))).toBe(true);
  await page.screenshot({ path });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`commercial composition ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });

    test('surface snapshots use identical two-product two-delivery local fixtures', async ({ page }) => {
      const folder = `${root}/${colorScheme}`;
      mkdirSync(folder, { recursive: true });
      const measurements: Record<string, unknown> = {};
      await filledCart(page, 'ui-composition');
      for (const width of [412, 320]) {
        await page.setViewportSize({ width, height: 892 });
        await page.goto('/cart');
        await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
        await capture(page, `${folder}/01-cart-${width}.png`);
        measurements[`cart-${width}`] = await page.locator('[data-testid^="cart-line-"] img').first().boundingBox();
        await page.getByTestId('cart-continue').click();
        await expect(page.getByTestId('checkout-place')).toBeEnabled();
        await capture(page, `${folder}/02-checkout-${width}.png`);
        await page.goto('/p/ugreen-cable-usb-c-100w');
        await expect(page.getByTestId('product-title')).toBeVisible();
        await capture(page, `${folder}/03-product-${width}.png`);
        measurements[`gallery-${width}`] = await page.getByTestId('product-gallery').boundingBox();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      writeFileSync(`${folder}/measurements.json`, JSON.stringify(measurements, null, 2));
    });

    test('delivery summaries keep every server option in a sheet and preserve the chosen delivery', async ({ page }) => {
      await filledCart(page, 'ui-delivery-choices');
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      await expect(page.getByTestId('delivery-choice-0')).toBeVisible();
      await expect(page.getByTestId('delivery-choice-1')).toBeVisible();
      await expect(page.getByTestId('delivery-choice-0')).toContainText('Tarifa de ejemplo');
      await page.getByTestId('delivery-choice-0').click();
      const sheet = page.getByTestId('delivery-options-0');
      await expect(sheet.getByRole('radio')).toHaveCount(3);
      const option = sheet.getByRole('radio').last();
      const name = await option.innerText();
      await option.click();
      await expect(sheet).not.toBeVisible();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      await expect(page.getByTestId('delivery-choice-0')).toContainText(name.split('\n')[0]!);
      await page.getByTestId('delivery-choice-0').click();
      await expect(sheet.getByRole('radio').last()).toHaveAttribute('aria-checked', 'true');
      await sheet.getByRole('radio').last().focus();
      await page.keyboard.press('Escape');
      await expect(sheet).not.toBeVisible();
      await expect(page.getByTestId('checkout-scroll')).toContainText('Cantidad: 1');
    });

    test('a failed refresh keeps the summary legible but blocks confirmation until retry', async ({ page, context }) => {
      await filledCart(page, 'ui-checkout-refresh');
      let fail = false;
      let orders = 0;
      await page.route('**/rest/v1/rpc/checkout_preview', (r) => fail ? r.abort('failed') : r.continue());
      await page.route('**/rest/v1/rpc/place_order', (r) => { orders++; return r.abort(); });
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      fail = true;
      await page.clock.setSystemTime(new Date(Date.now() + 31_000));
      await context.setOffline(true);
      await expect(page.getByTestId('offline-notice')).toBeVisible();
      await context.setOffline(false);
      // A reconnect refetches the server summary for this exact cart/address/plan.
      await expect(page.getByTestId('checkout-refresh-error')).toBeVisible();
      await expect(page.getByTestId('checkout-total')).toBeVisible();
      await expect(page.getByTestId('checkout-place')).toBeDisabled();
      fail = false;
      await page.getByRole('button', { name: 'Reintentar actualización', exact: true }).click();
      await expect(page.getByTestId('checkout-refresh-error')).toHaveCount(0);
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      expect(orders).toBe(0);
    });

    test('removal requires confirmation and a failed save keeps the product and retry', async ({ page }) => {
      await filledCart(page, 'ui-cart-remove');
      const first = page.locator('[data-testid^="cart-line-"]').first();
      await first.getByRole('button', { name: /^Quitar / }).click();
      const sheet = page.getByTestId('cart-remove-sheet');
      await sheet.getByRole('button', { name: 'Conservar producto', exact: true }).click();
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
      await first.getByRole('button', { name: /^Quitar / }).click();
      let fail = true;
      await page.route('**/rest/v1/rpc/cart_set_quantity', (r) => fail ? r.abort('failed') : r.continue());
      await sheet.getByTestId('cart-remove-sheet-confirm').click();
      await expect(sheet.getByRole('alert')).toContainText('Sigue en tu carrito');
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
      fail = false;
      await sheet.getByTestId('cart-remove-sheet-confirm').click();
      await expect(sheet).not.toBeVisible();
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(1);
      await expect(page.getByTestId('cart-subtotal')).toContainText('48,00');
    });

    test('320px with enlarged text keeps checkout summary and actions reachable', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 892 });
      await filledCart(page, 'ui-checkout-reflow');
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      await page.evaluate(() => {
        for (const n of document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
          const css = getComputedStyle(n);
          const size = parseFloat(css.fontSize), line = parseFloat(css.lineHeight);
          n.style.fontSize = `${size * 1.6}px`;
          if (line) n.style.lineHeight = `${line * 1.6}px`;
        }
      });
      const total = page.getByTestId('checkout-total');
      await total.scrollIntoViewIfNeeded();
      await expect.poll(async () => {
        const box = await total.boundingBox();
        const bar = await page.getByTestId('checkout-bottom-bar').boundingBox();
        return box!.y + box!.height < bar!.y;
      }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const folder = `${root}/${colorScheme}`;
      mkdirSync(folder, { recursive: true });
      await capture(page, `${folder}/04-checkout-font-160-320.png`);
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
    });

    test('creating an order freezes delivery, address and plan until the request resolves', async ({ page }) => {
      await filledCart(page, 'ui-checkout-freeze');
      await page.getByTestId('cart-continue').click();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let requests = 0;
      await page.route('**/rest/v1/rpc/place_order', async (r) => {
        requests++;
        await held;
        await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Intenta de nuevo.', hint: 'invalid_state' }) });
      });
      try {
        await page.getByTestId('checkout-place').click();
        await expect.poll(() => requests).toBe(1);
        await expect(page.getByTestId('checkout-change-address')).toBeDisabled();
        for (const choice of await page.locator('[data-testid^="delivery-choice-"]').all()) await expect(choice).toBeDisabled();
        for (const plan of await page.locator('[data-testid^="plan-"]').all()) await expect(plan).toBeDisabled();
        await expect(page.getByTestId('checkout-place')).toBeDisabled();
        release();
        await expect(page.getByTestId('checkout-place')).toBeEnabled();
        await expect(page.getByTestId('checkout-change-address')).toBeEnabled();
        expect(requests).toBe(1);
      } finally { release(); }
    });
  });
}
