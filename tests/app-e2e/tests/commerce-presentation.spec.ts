import { expect, test, type Page } from '@playwright/test';
import { formatOfferPrice } from '../../../packages/core/src/commerce-presentation';

// Browser fixtures are restricted to the local stack. No remote product or stock is modified.
const baseProduct = '/p/ugreen-cable-usb-c-100w';
async function product(page: Page) {
  const response = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail_commercial') && r.ok());
  await page.goto(baseProduct);
  return (await response).json();
}
async function localOnly(page: Page) {
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)
      ? r.continue()
      : r.abort();
  });
}
for (const colorScheme of ['light', 'dark'] as const)
  test.describe(`contrato nativo ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 390, height: 892 } });
    test.beforeEach(async ({ page }) => localOnly(page));
    test.afterEach(async ({ page }, info) => {
      await page.screenshot({ path: info.outputPath('pantalla.png'), fullPage: true });
    });
    test('guardar lento impide duplicado y bloquea edición hasta completar', async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as any;
        w.guestWrites = 0;
        const original = Storage.prototype.setItem;
        Object.defineProperty(Storage.prototype, 'setItem', {
          value(this: Storage, key: string, value: string) {
            original.call(this, key, value);
            if (key === 'kora.guest-cart.v1') {
              w.guestWrites++;
              return new Promise<void>((resolve) => {
                w.releaseGuest = resolve;
              });
            }
          },
        });
      });
      const p = await product(page);
      const variant = p.variants.find((v: any) => v.active && v.stock !== 0);
      const other = p.variants.find((v: any) => v.id !== variant.id);
      await page.getByTestId('product-add').evaluate((b) => {
        (b as HTMLElement).click();
        (b as HTMLElement).click();
      });
      try {
        await expect(page.getByTestId(`variant-${other.title}`)).toBeDisabled();
        await expect(page.getByTestId('product-selection-summary')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Aumentar cantidad', exact: true })).toBeDisabled();
        await expect(page.getByTestId('product-cta')).toBeDisabled();
        expect(await page.evaluate(() => (window as any).guestWrites)).toBe(1);
      } finally {
        await page.evaluate(() => (window as any).releaseGuest?.());
      }
      await expect(page.getByTestId('added-to-cart')).toBeVisible();
      await page.getByTestId(`variant-${other.title}`).click();
      await expect(page.getByTestId('added-to-cart')).toHaveCount(0);
    });
    test('carrito visitante refresca precio, conserva exceso y recupera sin cambiar variante', async ({ page }) => {
      const p = await product(page);
      const v = p.variants.find((v: any) => v.active && v.stock !== 0);
      const fresh = { ...p, max_per_order: 2, variants: p.variants.map((x: any) => ({ ...x, stock: 2 })) };
      await page.route('**/rpc/product_detail_commercial', (r) => r.fulfill({ json: fresh }));
      await page.evaluate(
        ({ p, v }) =>
          localStorage.setItem(
            'kora.guest-cart.v1',
            JSON.stringify([
              {
                product_id: p.id,
                variant_id: v.id,
                quantity: 4,
                title: p.title,
                variant_title: v.title,
                image_path: null,
                price_usd: 1,
                availability: p.availability,
              },
            ]),
          ),
        { p, v },
      );
      await page.goto('/cart');
      const row = page.getByTestId(`cart-line-${v.id}`);
      await expect(row.getByText('4', { exact: true })).toBeVisible();
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatOfferPrice(Number(v.price_usd) * 4));
      await expect(row.getByRole('button', { name: 'Aumentar cantidad', exact: true })).toBeDisabled();
      await expect(page.getByTestId('cart-continue')).toBeDisabled();
      await row.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(row.getByText('3', { exact: true })).toBeVisible();
      await expect(page.getByTestId('cart-continue')).toBeDisabled();
      await row.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(row.getByText('2', { exact: true })).toBeVisible();
      await expect(page.getByTestId('cart-continue')).toBeEnabled();
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem('kora.guest-cart.v1') || '[]')[0].variant_id),
      ).toBe(v.id);
      await row.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(row.getByText('1', { exact: true })).toBeVisible();
      await row.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(page.getByTestId('cart-remove-sheet')).toBeVisible();
      await page.getByRole('button', { name: 'Conservar producto', exact: true }).click();
      await expect(row).toBeVisible();
    });
    test('carrito no ofrece precio guardado si falla lectura y conserva selección al recuperar', async ({ page }) => {
      const p = await product(page);
      const v = p.variants.find((v: any) => v.active && v.stock !== 0);
      await page.evaluate(
        ({ p, v }) =>
          localStorage.setItem(
            'kora.guest-cart.v1',
            JSON.stringify([
              {
                product_id: p.id,
                variant_id: v.id,
                quantity: 2,
                title: p.title,
                variant_title: v.title,
                image_path: null,
                price_usd: 1,
                availability: p.availability,
              },
            ]),
          ),
        { p, v },
      );
      let fail = true;
      await page.route('**/rpc/product_detail_commercial', (r) => (fail ? r.abort() : r.continue()));
      await page.goto('/cart');
      await expect(page.getByTestId('cart-subtotal')).toHaveText('Precio pendiente');
      await expect(page.getByTestId('cart-continue')).toBeDisabled();
      await expect(page.getByTestId(`cart-line-${v.id}`).getByText('2', { exact: true })).toBeVisible();
      fail = false;
      await page.reload();
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatOfferPrice(Number(v.price_usd) * 2));
      await expect(page.getByTestId('cart-continue')).toBeEnabled();
    });
    test('baja de existencias conserva cantidad visible y elige variante explícita reinicia a uno', async ({
      page,
    }) => {
      const p = await product(page);
      const first = p.variants.find((v: any) => v.active && v.stock !== 0);
      const other = p.variants.find((v: any) => v.id !== first.id && v.active);
      let stock = 5;
      let calls = 0;
      await page.route('**/rpc/product_detail_commercial', (r) => {
        calls++;
        return r.fulfill({ json: { ...p, max_per_order: 5, variants: p.variants.map((v: any) => ({ ...v, stock })) } });
      });
      await page.reload();
      const selection = page.getByTestId('product-selection');
      for (let i = 1; i < 4; i++)
        await selection.getByRole('button', { name: 'Aumentar cantidad', exact: true }).click();
      await expect(page.getByTestId('product-selected-summary')).toContainText('4 unidades');
      stock = 2;
      const before = calls;
      await page.evaluate(() => {
        const original = Date.now;
        Date.now = () => original() + 60000;
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        window.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        window.dispatchEvent(new Event('visibilitychange'));
      });
      await expect.poll(() => calls).toBeGreaterThan(before);
      await expect(page.getByTestId('product-quantity-issue')).toBeVisible();
      await expect(page.getByTestId('product-selected-summary')).toContainText('4 unidades');
      await expect(page.getByTestId('product-add')).toBeDisabled();
      await expect(page.getByTestId('product-cta')).toBeDisabled();
      await selection.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(page.getByTestId('product-selected-summary')).toContainText('3 unidades');
      await expect(page.getByTestId('product-add')).toBeDisabled();
      await selection.getByRole('button', { name: 'Disminuir cantidad', exact: true }).click();
      await expect(page.getByTestId('product-add')).toBeEnabled();
      await page.getByTestId(`variant-${other.title}`).click();
      await expect(page.getByTestId('product-selected-summary')).toContainText('1 unidad');
      await expect(page.getByTestId('product-selected-price')).toHaveText(formatOfferPrice(other.price_usd));
    });
    test('tarjeta reciente usa precio y opción actuales en vez del resumen heredado', async ({ page }) => {
      const p = await product(page);
      const v = p.variants.find((v: any) => v.active && v.stock !== 0);
      const card = {
        ...p,
        price_usd: 0.01,
        image_path: 'legacy/wrong-color.png',
        brand_name: p.brand?.name ?? null,
        store_id: p.store.id,
        store_name: p.store.name,
      };
      await page.route('**/rpc/home_feed', async (r) => {
        const response = await r.fetch();
        const feed = await response.json();
        return r.fulfill({ json: { ...feed, recently_viewed: [card] } });
      });
      await page.goto('/');
      const mini = page.getByTestId(`mini-card-${p.slug}`);
      await expect(mini.getByTestId('mini-price')).toContainText(formatOfferPrice(v.price_usd));
      expect(await mini.innerHTML()).not.toContain('legacy/wrong-color');
      await mini.scrollIntoViewIfNeeded();
      await mini.click();
      await expect(page).toHaveURL(new RegExp(`variant=${v.id}`));
      await expect(page.getByTestId('product-selected-price')).toHaveText(formatOfferPrice(v.price_usd));
    });
    test('tarjeta reciente permite reintentar metadata sin abrir una oferta indeterminada', async ({ page }) => {
      const p = await product(page);
      const v = p.variants.find((v: any) => v.active && v.stock !== 0);
      const card = {
        ...p,
        price_usd: 0.01,
        image_path: 'legacy/wrong-color.png',
        brand_name: p.brand?.name ?? null,
        store_id: p.store.id,
        store_name: p.store.name,
      };
      await page.route('**/rpc/home_feed', async (r) => {
        const response = await r.fetch();
        const feed = await response.json();
        return r.fulfill({ json: { ...feed, recently_viewed: [card] } });
      });
      let fail = true;
      await page.route('**/rpc/catalog_metadata', (r) => (fail ? r.abort() : r.continue()));
      await page.goto('/');
      const mini = page.getByTestId(`mini-card-${p.slug}`);
      await expect(mini).toContainText('Reintentar información');
      await expect(mini).toHaveAttribute('role', 'button');
      fail = false;
      await mini.click();
      await expect(mini.getByTestId('mini-price')).toContainText(formatOfferPrice(v.price_usd));
      await expect(page).toHaveURL((url) => url.pathname === '/');
    });
  });
