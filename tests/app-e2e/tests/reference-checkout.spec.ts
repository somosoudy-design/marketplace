import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import type { CheckoutSummary } from '../../../packages/api/src/types';
import { formatUSD } from '../../../packages/core/src/money';
import { asOn, databaseUrl, newBuyer } from './support/db';
import { checkoutToPlan, checkoutToReview } from './support/checkout';

// Real local backend only. The optional captures document both visual states without real purchases.
const shots = process.env.DESIGN_SHOTS;

for (const theme of ['light', 'dark'] as const) {
  test(`revisión de productos y métodos de pago ${theme}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    const buyer = await newBuyer(`ui-reference-${theme}`);
    let summary: CheckoutSummary | undefined;
    let orderId: string | undefined;
    page.on('response', async (response) => {
      if (response.url().endsWith('/rpc/checkout_preview') && response.ok()) summary = await response.json();
    });
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
    await page.getByTestId('cart-continue').click();
    await checkoutToReview(page);
    await expect.poll(() => summary?.groups.length).toBe(2);
    const snapshot = summary!;
    await expect(page.getByTestId('checkout-total')).toHaveText(formatUSD(snapshot.total_usd));
    for (const group of snapshot.groups) for (const line of group.lines) {
      const row = page.getByTestId(`checkout-review-line-${line.variant_id}`);
      await expect(row).toContainText(line.title);
      await expect(row).toContainText(formatUSD(line.line_total_usd));
      await expect(row).toContainText(`Cantidad: ${line.quantity}`);
    }
    await expect(page.getByTestId('checkout-bottom-bar').getByTestId('checkout-total')).toBeVisible();
    for (const width of [320, 412]) {
      await page.setViewportSize({ width, height: 892 });
      await page.evaluate(() => document.fonts.ready);
      if (shots) {
        const dir = resolve(shots); mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/checkout-${theme}-${width}.png` });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.getByTestId('checkout-place').click();
    await expect(page).toHaveURL(/\/pay\//);
    orderId = page.url().split('/pay/')[1]!.split(/[?#]/)[0];
    try {
      const method = page.getByTestId('method-pago_movil');
      await expect(method).toBeVisible();
      const firstDue = snapshot.schedule.find((item) => item.due_in_days === 0) ?? snapshot.schedule[0];
      await expect(page.getByTestId('pay-base-amount')).toContainText(formatUSD(firstDue!.amount_usd));
      await expect(page.getByTestId('pay-quote')).toBeDisabled();
      await method.click();
      await expect(method).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('method-detail')).toBeVisible();
      await expect(page.getByTestId('pay-quote')).toBeEnabled();
      for (const width of [320, 412]) {
        await page.setViewportSize({ width, height: 892 });
        await page.getByTestId('pay-scroll').evaluate((node: HTMLElement) => { node.scrollTop = 0; });
        await page.evaluate(() => document.fonts.ready);
        if (shots) await page.screenshot({ path: `${resolve(shots)}/pago-${theme}-${width}.png` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      await info.attach('order-summary-local', { body: `Productos: ${snapshot.groups.flatMap((g) => g.lines).length}; total del servidor: ${formatUSD(snapshot.total_usd)}`, contentType: 'text/plain' });
    } finally {
      // Release only the local order created by this test.
      const client = new pg.Client({ connectionString: databaseUrl() });
      await client.connect();
      try { if (orderId) await asOn(client)(buyer.id, 'select public.cancel_order($1,$2)', [orderId, 'Fin de prueba local de interfaz']); }
      finally { await client.end(); }
    }
  });
}

for (const theme of ['light', 'dark'] as const) test(`el resumen con cuotas deja contenido y acción visibles en pantalla pequeña con texto ampliado (${theme})`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: theme });
  const buyer = await newBuyer('ui-reference-large-text');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto('/p/ugreen-nexode-100w');
  await page.getByTestId('product-cta').click();
  await page.getByTestId('cart-continue').click();
  await checkoutToPlan(page);
  await page.getByTestId('plan-three_parts').click();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await page.evaluate(() => {
    const enlarge = () => {
      for (const node of document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
        if (node.dataset.referenceFontChecked) continue;
        node.dataset.referenceFontChecked = '1';
        const css = getComputedStyle(node);
        node.style.fontSize = `${parseFloat(css.fontSize) * 1.6}px`;
        const line = parseFloat(css.lineHeight);
        if (line) node.style.lineHeight = `${line * 1.6}px`;
      }
    };
    enlarge();
    new MutationObserver(enlarge).observe(document.body, { childList: true, subtree: true });
  });
  await expect(page.getByTestId('checkout-place')).toBeVisible();
  await expect(page.getByTestId('checkout-bottom-bar')).toContainText('Pagas hoy');
  const bar = (await page.getByTestId('checkout-bottom-bar').boundingBox())!;
  const action = (await page.getByTestId('checkout-place').boundingBox())!;
  expect(bar.y).toBeGreaterThan(300);
  expect(action.y + action.height).toBeLessThanOrEqual(640);
  const item = page.locator('[data-testid^="checkout-review-line-"]').first();
  await page.getByTestId('checkout-scroll').evaluate((node: HTMLElement) => { node.scrollTop += 180; });
  await expect.poll(async () => {
    const itemBox = (await item.boundingBox())!;
    return itemBox.y + itemBox.height < bar.y && itemBox.y >= 56;
  }).toBe(true);
  await expect(page.getByTestId('checkout-summary-detail')).toContainText('Productos');
  if (shots) await page.screenshot({ path: `${resolve(shots)}/checkout-cuotas-texto-160-${theme}-320.png` });
});
