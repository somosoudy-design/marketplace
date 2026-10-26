import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { formatUSD } from '../../../packages/core/src/money';
import { asOn, databaseUrl, newBuyer } from './support/db';

// Proposed location: tests/app-e2e/tests/cart-store-clarity.spec.ts.
// Own additive local buyers only; no seed stock changes, checkout or order creation.
async function ownCart(page: Page, multi: boolean) {
  const buyer = await newBuyer('ui-cart-clarity');
  const c = new pg.Client({ connectionString: databaseUrl() });
  await c.connect();
  const lines: { variant_id: string; price_usd: number; quantity: number }[] = [];
  try {
    for (const [i, slug] of ['ugreen-cable-usb-c-100w', multi ? 'lampara-mesa-lino' : 'ugreen-nexode-30w'].entries()) {
      const { rows } = await c.query('select v.id as variant_id, v.price_usd from public.product_variants v join public.products p on p.id=v.product_id where p.slug=$1 and v.active order by v.sort, v.id limit 1', [slug]);
      const quantity = i === 0 ? 2 : 1;
      const line = rows[0];
      await asOn(c)(buyer.id, 'select public.cart_set_quantity($1, $2)', [line.variant_id, quantity]);
      lines.push({ variant_id: line.variant_id, price_usd: Number(line.price_usd), quantity });
    }
  } finally { await c.end(); }
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/cart');
  await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
  await expect(page.getByTestId('cart-continue')).toBeEnabled();
  return lines;
}

async function largeText(page: Page) {
  await page.evaluate(() => {
    for (const n of document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
      const css = getComputedStyle(n);
      const size = parseFloat(css.fontSize), line = parseFloat(css.lineHeight);
      n.style.fontSize = `${size * 1.6}px`;
      if (line) n.style.lineHeight = `${line * 1.6}px`;
    }
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`carrito y reputación (${colorScheme})`, () => {
    test.use({ colorScheme, viewport: { width: 320, height: 892 }, deviceScaleFactor: 1 });

    test('dos referencias de una tienda conservan unidades e importes tras cambio, error y cancelación', async ({ page }) => {
      const lines = await ownCart(page, false);
      const cable = lines[0]!;
      const row = page.getByTestId(`cart-line-${cable.variant_id}`);
      await expect(page.locator('[data-testid^="cart-group-"]')).toHaveCount(1);
      await expect(page.getByTestId('cart-deliveries')).toHaveText('2 productos · 3 unidades');
      await expect(page.getByTestId(`cart-unit-${cable.variant_id}`)).toHaveText(`${formatUSD(cable.price_usd)} por unidad`);
      await expect(page.getByTestId(`cart-item-total-${cable.variant_id}`)).toHaveText(formatUSD(cable.price_usd * 2));
      const original = lines.reduce((sum, l) => sum + l.price_usd * l.quantity, 0);
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(original));
      await expect(page.getByTestId('buyer-tab-cart')).toHaveAccessibleName('Carrito, 3 unidades');
      await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
      await expect(page.locator('[data-testid="home-cart"]:visible')).toHaveAccessibleName('Carrito, 3 unidades');
      await page.getByTestId('buyer-tab-cart').click();
      let fail = true;
      await page.route('**/rest/v1/rpc/cart_set_quantity', async (r) => fail ? r.abort('failed') : r.continue());
      await row.getByRole('button', { name: 'Aumentar cantidad' }).click();
      await expect(page.getByText('No pudimos actualizar la cantidad. Intenta de nuevo.')).toBeVisible();
      await expect(row.getByText('2', { exact: true })).toBeVisible();
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(original));
      await page.getByTestId(`cart-remove-${cable.variant_id}`).click();
      await expect(page.getByTestId('cart-remove-sheet')).toBeVisible();
      await expect(page.getByText('No pudimos quitarlo. Sigue en tu carrito; intenta de nuevo.', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Quitar producto', exact: true }).click();
      await expect(page.getByText('No pudimos quitarlo. Sigue en tu carrito; intenta de nuevo.', { exact: true })).toBeVisible();
      await expect(page.getByText('No pudimos actualizar la cantidad. Intenta de nuevo.', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Conservar producto', exact: true }).click();
      await page.getByTestId(`cart-remove-${lines[1]!.variant_id}`).click();
      await expect(page.getByText('No pudimos quitarlo. Sigue en tu carrito; intenta de nuevo.', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Conservar producto', exact: true }).click();
      await expect(row.getByText('2', { exact: true })).toBeVisible();
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(original));
      fail = false;
      await row.getByRole('button', { name: 'Aumentar cantidad' }).click();
      await expect(page.getByTestId('cart-deliveries')).toHaveText('2 productos · 4 unidades');
      await expect(page.getByTestId(`cart-unit-${cable.variant_id}`)).toHaveText(`${formatUSD(cable.price_usd)} por unidad`);
      await expect(page.getByTestId(`cart-item-total-${cable.variant_id}`)).toHaveText(formatUSD(cable.price_usd * 3));
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(original + cable.price_usd));
      await page.getByTestId(`cart-remove-${cable.variant_id}`).click();
      await page.getByRole('button', { name: 'Conservar producto', exact: true }).click();
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
      await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(original + cable.price_usd));
    });

    test('dos tiendas mantienen dos entregas, y quitar todas las líneas recupera el vacío', async ({ page }) => {
      const lines = await ownCart(page, true);
      await expect(page.locator('[data-testid^="cart-group-"]')).toHaveCount(2);
      await expect(page.getByTestId('cart-deliveries')).toHaveText('2 productos · 3 unidades · 2 entregas');
      await largeText(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      for (const line of lines) {
        const row = page.getByTestId(`cart-line-${line.variant_id}`);
        await row.scrollIntoViewIfNeeded();
        if (line.quantity > 1) await expect(page.getByTestId(`cart-unit-${line.variant_id}`)).toHaveText(`${formatUSD(line.price_usd)} por unidad`);
        else await expect(page.getByTestId(`cart-unit-${line.variant_id}`)).toHaveCount(0);
        await expect(page.getByTestId(`cart-item-total-${line.variant_id}`)).toHaveText(formatUSD(line.price_usd * line.quantity));
        await page.getByTestId(`cart-remove-${line.variant_id}`).click();
        await page.getByRole('button', { name: 'Quitar producto', exact: true }).click();
        await expect(row).toHaveCount(0);
      }
      await expect(page.getByTestId('cart-empty')).toBeVisible();
      await expect(page.getByText('Tu carrito está vacío', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Explorar', exact: true }).click();
      await expect(page).toHaveURL(/\/explore$/);
    });

    test('reputación real y tienda sin opiniones caben con texto web1,6 a320/412', async ({ page }) => {
      for (const width of [320, 412]) for (const [slug, store] of [['juguete-cuerda-perros', 'patitas'], ['ugreen-cable-usb-c-100w', 'kora']]) {
        await page.setViewportSize({ width, height: 892 });
        await page.goto(`/p/${slug}`);
        const chip = page.getByTestId('product-store').getByTestId(`store-${store}`);
        await expect(chip).toBeAttached();
        await page.evaluate(() => document.fonts.ready);
        await largeText(page);
        await chip.scrollIntoViewIfNeeded();
        const rating = chip.getByText(store === 'kora' ? 'Aún sin opiniones' : /·.*opiniones/);
        const [container, content] = await Promise.all([chip.boundingBox(), rating.boundingBox()]);
        expect(content!.x).toBeGreaterThanOrEqual(container!.x);
        expect(content!.x + content!.width).toBeLessThanOrEqual(container!.x + container!.width - 8);
        expect(content!.y + content!.height).toBeLessThanOrEqual(container!.y + container!.height - 8);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    });
  });
}

test('visitante distingue dos unidades del precio de una y continúa por acceso', async ({ page }) => {
  const response = page.waitForResponse((r) => r.url().endsWith('/rpc/product_detail') && r.ok());
  await page.goto('/p/ugreen-cable-usb-c-100w');
  const product = await (await response).json();
  const first = product.variants.find((v: { active: boolean; stock: number | null }) => v.active && (v.stock == null || v.stock > 0)) ?? product.variants[0];
  await page.getByTestId('product-selection').getByRole('button', { name: 'Aumentar cantidad' }).click();
  await page.getByTestId('product-cta').click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-deliveries')).toHaveText('1 producto · 2 unidades');
  await expect(page.locator('[data-testid^="cart-unit-"]')).toContainText('por unidad');
  await expect(page.locator('[data-testid^="cart-item-total-"]')).toHaveText(formatUSD(Number(first.price_usd) * 2));
  await expect(page.getByTestId('cart-subtotal')).toHaveText(formatUSD(Number(first.price_usd) * 2));
  await expect(page.getByTestId('cart-continue')).toHaveText('Iniciar sesión para continuar');
});
