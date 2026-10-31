import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import type { CheckoutSummary } from '../../../packages/api/src/types';
import { formatUSD } from '../../../packages/core/src/money';
import { asOn, databaseUrl, newBuyer } from './support/db';
import { checkoutToPlan, checkoutToReview } from './support/checkout';

const root = process.env.CHECKOUT_EVIDENCE_DIR
  ? resolve(process.env.CHECKOUT_EVIDENCE_DIR)
  : resolve(import.meta.dirname, '../../../.local/checkout-progresivo-20261024/after');

async function filledCart(page: Page, slugs = ['ugreen-cable-usb-c-100w', 'lampara-mesa-lino']) {
  const buyer = await newBuyer('ui-progressive');
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(buyer.email);
  await page.getByTestId('sign-in-password').fill(buyer.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  for (const slug of slugs) {
    await page.goto(`/p/${slug}`);
    await page.getByTestId('product-cta').click();
    await expect(page).toHaveURL(/\/cart$/);
  }
  await page.getByTestId('cart-continue').click();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  return buyer;
}

async function capture(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

async function onlyStage(page: Page, name: string) {
  for (const stage of ['address', 'delivery', 'plan', 'review']) {
    await expect(page.getByTestId(`checkout-stage-${stage}`)).toHaveCount(stage === name ? 1 : 0);
  }
  await expect(page.getByTestId('checkout-place')).toHaveCount(name === 'review' ? 1 : 0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`checkout progresivo ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });

    test('una decisión por fase, dos entregas, selección conservada y capturas comparables', async ({ page }) => {
      let orders = 0;
      page.on('request', (r) => { if (r.url().endsWith('/rpc/place_order')) orders++; });
      await filledCart(page);
      const folder = `${root}/${colorScheme}`;
      mkdirSync(folder, { recursive: true });
      const measurements: Record<string, unknown> = {};
      for (const width of [412, 320]) {
        await page.setViewportSize({ width, height: 892 });
        await onlyStage(page, 'address');
        await capture(page, `${folder}/01-direccion-${width}.png`);
        measurements[`address-${width}`] = await page.getByTestId('checkout-scroll').evaluate((n) => ({ height: n.clientHeight, content: n.scrollHeight }));
        await page.getByTestId('checkout-next').click();
        await onlyStage(page, 'delivery');
        await expect(page.getByTestId('checkout-progress')).toContainText('Entrega 1 de 2');
        await expect(page.getByTestId('delivery-choice-1')).toHaveCount(0);
        await capture(page, `${folder}/02-entrega-1-${width}.png`);
        await page.getByTestId('delivery-choice-0').click();
        const options = page.getByTestId('delivery-options-0');
        await expect(options.getByRole('radio')).toHaveCount(3);
        const originalOption = await options.locator('[aria-checked="true"]').getAttribute('data-testid');
        await options.getByRole('radio').last().click();
        await expect(page.getByTestId('checkout-next')).toBeEnabled();
        const choice = await page.getByTestId('delivery-choice-0').innerText();
        await page.getByTestId('checkout-next').click();
        await expect(page.getByTestId('checkout-progress')).toContainText('Entrega 2 de 2');
        await expect(page.getByTestId('delivery-choice-0')).toHaveCount(0);
        await capture(page, `${folder}/03-entrega-2-${width}.png`);
        await page.getByTestId('checkout-next').click();
        await onlyStage(page, 'plan');
        await capture(page, `${folder}/04-plan-${width}.png`);
        await page.goBack();
        await expect(page).toHaveURL(/\/checkout$/);
        await expect(page.getByTestId('checkout-progress')).toContainText('Entrega 2 de 2');
        await page.getByTestId('checkout-back').click();
        await expect(page.getByTestId('delivery-choice-0')).toHaveText(choice, { useInnerText: true });
        await page.getByTestId('delivery-choice-0').click();
        await options.getByTestId(originalOption!).click();
        await expect(page.getByTestId('checkout-next')).toBeEnabled();
        await page.getByTestId('checkout-next').click();
        await page.getByTestId('checkout-next').click();
        await page.getByTestId('checkout-next').click();
        await onlyStage(page, 'review');
        await expect(page.getByTestId('checkout-total')).toContainText('$');
        await expect(page.getByTestId('checkout-scroll')).toContainText('UGREEN cable');
        await expect(page.getByTestId('checkout-scroll')).toContainText('Lámpara de mesa');
        await capture(page, `${folder}/05-revision-${width}.png`);
        await expect(page.getByTestId('checkout-bottom-bar').getByTestId('checkout-total')).toBeVisible();
        await expect.poll(async () => {
          const total = await page.getByTestId('checkout-total').boundingBox();
          const action = await page.getByTestId('checkout-place').boundingBox();
          return total!.y + total!.height <= action!.y;
        }).toBe(true);
        await capture(page, `${folder}/06-total-${width}.png`);
        await page.getByTestId('checkout-edit-address').click();
      }
      writeFileSync(`${folder}/measurements.json`, JSON.stringify(measurements, null, 2));
      expect(orders).toBe(0);
      await page.getByTestId('checkout-back').click();
      await expect(page).toHaveURL(/\/cart$/);
      await expect(page.locator('[data-testid^="cart-line-"]')).toHaveCount(2);
    });

    test('otra dirección descarta el envío anterior y obliga a revisar las fases siguientes', async ({ page }) => {
      await filledCart(page);
      await page.getByTestId('checkout-next').click();
      await page.getByTestId('delivery-choice-0').click();
      await page.getByTestId('delivery-options-0').getByRole('radio').last().click();
      await expect(page.getByTestId('checkout-next')).toBeEnabled();
      await page.getByTestId('checkout-next').click();
      await page.getByTestId('checkout-next').click();
      await page.getByTestId('checkout-next').click();
      await expect(page.getByTestId('checkout-place')).toBeEnabled();
      await page.getByTestId('checkout-edit-address').click();
      await page.getByTestId('checkout-change-address').click();
      await page.getByTestId('checkout-add-address').click();
      await page.getByTestId('addr-recipient').fill('Ana Prueba');
      await page.getByTestId('addr-phone').fill('0412 555 0101');
      await page.getByTestId('addr-region').click();
      await page.getByRole('radio', { name: 'Zulia', exact: true }).click();
      await page.getByTestId('addr-city').fill('Maracaibo');
      await page.getByTestId('addr-line1').fill('Av. Oficina de pruebas');
      await page.getByTestId('addr-save').click();
      await expect(page).toHaveURL(/\/checkout$/);
      const request = page.waitForRequest((r) => r.url().endsWith('/rpc/checkout_preview') && r.postDataJSON().p_shipping && Object.keys(r.postDataJSON().p_shipping).length === 0);
      await page.getByRole('radio').filter({ hasText: 'Av. Oficina de pruebas' }).click();
      expect((await request).postDataJSON().p_shipping).toEqual({});
      await expect(page.getByTestId('checkout-address')).toContainText('Maracaibo');
      await expect(page.getByTestId('checkout-next')).toBeEnabled();
      await onlyStage(page, 'address');
      await checkoutToReview(page);
      await expect(page.getByTestId('checkout-review-address')).toContainText('Maracaibo');
    });

    test('recalcular un envío bloquea el avance y un error se recupera sin crear un pedido', async ({ page }) => {
      await filledCart(page);
      await page.getByTestId('checkout-next').click();
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let fail = true;
      let calls = 0;
      let orders = 0;
      page.on('request', (r) => { if (r.url().endsWith('/rpc/place_order')) orders++; });
      await page.route('**/rest/v1/rpc/checkout_preview', async (r) => {
        calls++;
        if (fail) { await held; await r.abort('failed'); }
        else await r.continue();
      });
      try {
        await page.getByTestId('delivery-choice-0').click();
        await page.getByTestId('delivery-options-0').getByRole('radio').last().click();
        await expect.poll(() => calls).toBe(1);
        await expect(page.getByTestId('checkout-next')).toBeDisabled();
        release();
        await expect(page.getByTestId('checkout-refresh-error')).toBeVisible();
        await expect(page.getByTestId('checkout-next')).toBeDisabled();
        await onlyStage(page, 'delivery');
        fail = false;
        await page.getByRole('button', { name: 'Reintentar actualización', exact: true }).click();
        await expect(page.getByTestId('checkout-refresh-error')).toHaveCount(0);
        await expect(page.getByTestId('checkout-next')).toBeEnabled();
        await expect(page.getByTestId('delivery-choice-0')).toContainText('Zoom · retiro en oficina');
        expect(orders).toBe(0);
      } finally { release(); }
    });

    test('320px y texto ampliado mantienen cada fase, el foco y la acción alcanzables', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 892 });
      await filledCart(page);
      await page.evaluate(() => {
        const enlarge = () => {
          for (const n of document.querySelectorAll<HTMLElement>('[dir="auto"]')) {
            if (n.dataset.fontChecked) continue;
            n.dataset.fontChecked = '1';
            const css = getComputedStyle(n);
            const size = parseFloat(css.fontSize), line = parseFloat(css.lineHeight);
            n.style.fontSize = `${size * 1.6}px`;
            if (line) n.style.lineHeight = `${line * 1.6}px`;
          }
        };
        enlarge();
        new MutationObserver(enlarge).observe(document.body, { childList: true, subtree: true });
      });
      const folder = `${root}/${colorScheme}`;
      mkdirSync(folder, { recursive: true });
      for (const phase of ['direccion', 'entrega-1', 'entrega-2', 'plan', 'revision']) {
        const action = page.getByTestId(phase === 'revision' ? 'checkout-place' : 'checkout-next');
        await expect(action).toBeEnabled();
        await expect(page.getByTestId('checkout-stage-heading')).toBeFocused();
        await capture(page, `${folder}/font-160-${phase}-320.png`);
        if (phase !== 'revision') await action.click();
      }
      await expect(page.getByTestId('checkout-bottom-bar').getByTestId('checkout-total')).toBeVisible();
      await expect.poll(async () => {
        const total = await page.getByTestId('checkout-total').boundingBox();
        const action = await page.getByTestId('checkout-place').boundingBox();
        return total!.y + total!.height <= action!.y;
      }).toBe(true);
      await capture(page, `${folder}/font-160-total-320.png`);
    });
  });
}

test('una tarifa retirada se recupera con opciones actuales y exige revisar las entregas', async ({ page }) => {
  await filledCart(page);
  await page.getByTestId('checkout-next').click();
  let rejected = false;
  let reset = false;
  await page.route('**/rest/v1/rpc/checkout_preview', async (r) => {
    const body = r.request().postDataJSON();
    if (!rejected && Object.keys(body.p_shipping).length) {
      rejected = true;
      await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'shipping unavailable', hint: 'shipping_invalid' }) });
    } else { if (rejected && !Object.keys(body.p_shipping).length) reset = true; await r.continue(); }
  });
  await page.getByTestId('delivery-choice-0').click();
  await page.getByTestId('delivery-options-0').getByRole('radio').last().click();
  await expect(page.getByText('Las opciones de envío cambiaron. Revisa cada entrega antes de continuar.')).toBeVisible();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await onlyStage(page, 'delivery');
  expect(rejected && reset).toBe(true);
  await expect(page.getByTestId('checkout-progress')).toContainText('Entrega 1 de 2');
});

test('un plan retirado consulta los planes del servidor y espera un calendario elegible', async ({ page }) => {
  await filledCart(page, ['ugreen-nexode-100w']);
  await checkoutToPlan(page);
  let rejected = false;
  let queriedEligible = false;
  await page.route('**/rest/v1/rpc/checkout_preview', async (r) => {
    const body = r.request().postDataJSON();
    if (body.p_plan_code === 'three_parts') {
      rejected = true;
      await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'plan unavailable', hint: 'plan_invalid' }) });
    } else if (body.p_plan_code === null) {
      queriedEligible = true;
      const response = await r.fetch();
      const s = await response.json();
      await r.fulfill({ response, json: { ...s, plans: s.plans.filter((p: { code: string }) => p.code !== 'three_parts') } });
    } else await r.continue();
  });
  await page.getByTestId('plan-three_parts').click();
  await expect(page.getByTestId('plan-full')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await onlyStage(page, 'plan');
  expect(rejected && queriedEligible).toBe(true);
  await page.getByTestId('checkout-next').click();
  await expect(page.getByTestId('checkout-place')).toBeEnabled();
});

test('plan rechazado al confirmar explica la recuperación y conserva la misma intención al reintentar', async ({ page }) => {
  await filledCart(page, ['ugreen-nexode-100w']);
  await checkoutToReview(page);
  const intents: string[] = [];
  await page.route('**/rest/v1/rpc/place_order', async (r) => {
    intents.push(r.request().postDataJSON().p_idempotency_key);
    await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'plan unavailable', hint: intents.length === 1 ? 'plan_invalid' : 'invalid_state' }) });
  });
  await page.getByTestId('checkout-place').click();
  await onlyStage(page, 'plan');
  await expect(page.getByRole('alert')).toContainText('El plan cambió');
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await page.getByTestId('checkout-next').click();
  await expect(page.getByTestId('checkout-place')).toBeEnabled();
  await page.getByTestId('checkout-place').click();
  await expect.poll(() => intents.length).toBe(2);
  expect(intents[1]).toBe(intents[0]);
});

test('un envío predeterminado retirado al confirmar también exige revisar entregas', async ({ page }) => {
  await filledCart(page);
  await checkoutToReview(page);
  let calls = 0;
  await page.route('**/rest/v1/rpc/place_order', async (r) => {
    calls++;
    expect(Object.keys(r.request().postDataJSON().p_shipping)).toHaveLength(2);
    await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'shipping unavailable', hint: 'shipping_invalid' }) });
  });
  await page.getByTestId('checkout-place').click();
  await onlyStage(page, 'delivery');
  await expect(page.getByText('Las opciones de envío cambiaron. Revisa cada entrega antes de continuar.')).toBeVisible();
  await expect(page.getByTestId('checkout-progress')).toContainText('Entrega 1 de 2');
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  expect(calls).toBe(1);
});

test('plan, dirección y envío revisados se guardan una sola vez; atrás y edición se bloquean durante confirmación', async ({ page }) => {
  let latest: CheckoutSummary | undefined;
  page.on('response', async (r) => { if (r.url().endsWith('/rpc/checkout_preview') && r.ok()) latest = await r.json(); });
  const buyer = await filledCart(page, ['ugreen-nexode-100w']);
  await checkoutToPlan(page);
  await page.getByTestId('plan-three_parts').click();
  await expect(page.getByTestId('checkout-next')).toBeEnabled();
  await expect(page.getByTestId('plan-three_parts')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('checkout-scroll')).toContainText('Calendario de pagos');
  await page.getByTestId('checkout-next').click();
  await onlyStage(page, 'review');
  await expect(page.getByTestId('checkout-scroll')).toContainText('Calendario de pagos');
  await expect.poll(() => latest?.plan?.code).toBe('three_parts');
  const reviewed = latest!;
  await expect(page.getByTestId('checkout-total')).toHaveText(formatUSD(reviewed.total_usd));
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requests: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/place_order', async (r) => { requests.push(r.request().postDataJSON()); await held; await r.continue(); });
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await page.getByTestId('checkout-place').evaluate((button: HTMLElement) => { button.click(); button.click(); });
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.getByTestId('checkout-confirming')).toBeVisible();
    await expect(page.getByTestId('checkout-back')).toBeDisabled();
    await expect(page.getByTestId('checkout-edit-address')).toHaveCount(0);
    await expect(page.getByTestId('checkout-edit-plan')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    release();
    await expect(page).toHaveURL(/\/pay\//);
    const { rows } = await client.query('select id, plan_code, total_usd from public.orders where buyer_id=$1', [buyer.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].plan_code).toBe('three_parts');
    expect(Number(rows[0].total_usd)).toBe(Number(reviewed.total_usd));
    expect(requests[0]!.p_address_id).toBe(reviewed.address!.id);
    expect(requests[0]!.p_plan_code).toBe('three_parts');
    expect(Object.keys(requests[0]!.p_shipping as object)).toHaveLength(1);
    expect(requests[0]!.p_shipping).toEqual(Object.fromEntries(reviewed.groups.map((g) => [g.key, g.selected_shipping!.method_id])));
  } finally {
    release();
    const { rows } = await client.query('select id from public.orders where buyer_id=$1', [buyer.id]);
    for (const order of rows) await asOn(client)(buyer.id, 'select public.cancel_order($1,$2)', [order.id, 'Fin de prueba local de checkout progresivo']);
    await client.end();
  }
});
