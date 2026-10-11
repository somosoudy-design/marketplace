import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { newBuyer } from './support/db';
import { adminFixture, sellerFixture } from './support/seller';

const shots = resolve(import.meta.dirname, '../../../.local/ven01a/screens');
mkdirSync(shots, { recursive: true });
async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(account.email);
  await page.getByTestId('sign-in-password').fill(account.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.getByTestId('buyer-tab-account').click();
}
async function openStore(page: Page) {
  await page.getByTestId('account-my-store').click();
  await expect(page.getByTestId('seller-store-name')).toBeVisible();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`VEN-01A (${colorScheme})`, () => {
    test.use({ colorScheme });
    let seller: Awaited<ReturnType<typeof sellerFixture>>;
    let empty: Awaited<ReturnType<typeof sellerFixture>>;
    test.beforeAll(async () => {
      seller = await sellerFixture(`ven-ui-${colorScheme}`, { multi: true });
      empty = await sellerFixture(`ven-empty-${colorScheme}`, { empty: true });
    });

    test('guest routes require login and never request privileged data', async ({ page }) => {
      let privateReads = 0;
      page.on('request', (r) => { if (/rpc\/seller_|rest\/v1\/store_members/.test(r.url())) privateReads++; });
      await page.goto('/account');
      await expect(page.getByTestId('account-sign-in')).toBeVisible();
      await expect(page.getByTestId('account-my-store')).toHaveCount(0);
      for (const path of ['/my-store', '/my-store/products', '/my-store/orders', '/my-store/settings']) {
        await page.goto(path);
        await expect(page.getByText('Entra a tu cuenta', { exact: true })).toBeVisible();
      }
      expect(privateReads).toBe(0);
    });

    test('ordinary buyer retains purchases and cannot enter the seller area', async ({ page }) => {
      await signIn(page, await newBuyer(`ven-buyer-${colorScheme}`));
      await expect(page.getByTestId('account-orders')).toBeVisible();
      // Wait for the real membership check to finish; absence before it finishes is not proof.
      const membership = page.waitForResponse((r) => r.url().includes('/rest/v1/store_members') && r.ok());
      await page.reload(); await membership;
      await expect(page.getByTestId('account-my-store')).toHaveCount(0);
      await expect(page.getByTestId('account-admin')).toHaveCount(0);
      await page.goto('/my-store');
      await expect(page.getByText('No tienes una tienda asignada', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Volver a Cuenta', exact: true }).last().click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('account-orders')).toBeVisible();
    });

    test('admin keeps administration without an assigned seller store', async ({ page }) => {
      const admin = await adminFixture(`ven-admin-${colorScheme}`, { purchase: true });
      const orders = page.waitForResponse((r) => r.url().includes('/rest/v1/orders?') && r.ok());
      await signIn(page, admin);
      const purchases = await (await orders).json();
      expect(purchases.map((o: { id: string }) => o.id)).toEqual([admin.order!.orderId]);
      await expect(page.getByTestId('account-orders')).toContainText('1 en curso');
      await expect(page.getByTestId('account-admin')).toBeVisible();
      await expect(page.getByTestId('account-my-store')).toHaveCount(0);
      await expect(page.getByTestId('account-orders')).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-account-admin.png` });
      await page.getByTestId('account-orders').click();
      await expect(page.getByTestId(`order-${admin.order!.number}`)).toBeVisible();
      await expect(page.locator('[data-testid^="order-"]:visible')).toHaveCount(1);
    });

    test('multiple roles keep buying, seller and administration in one session', async ({ page }) => {
      const mixed = await sellerFixture(`ven-mixed-${colorScheme}`, { admin: true, empty: true });
      const orders = page.waitForResponse((r) => r.url().includes('/rest/v1/orders?') && r.ok());
      await signIn(page, mixed);
      expect(await (await orders).json()).toEqual([]);
      await expect(page.getByTestId('account-admin')).toBeVisible();
      await expect(page.getByTestId('account-orders')).toBeVisible();
      await openStore(page);
      await expect(page.getByTestId('seller-store-name')).toHaveText(mixed.name);
      await page.getByTestId('seller-account-back').click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('account-admin')).toBeVisible();
      await expect(page.getByTestId('account-my-store')).toBeVisible();
    });

    test('native store reads real summaries, private products, received orders and configuration; back preserves buying', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 780 });
      await signIn(page, seller);
      await expect(page.getByTestId('account-admin')).toHaveCount(0);
      await page.screenshot({ path: `${shots}/${colorScheme}-account-seller.png` });
      await openStore(page);
      await expect(page.getByTestId('seller-product-count')).toHaveText('32');
      await expect(page.getByTestId('seller-prepare-count')).toHaveText('1');
      await expect(page.getByTestId('seller-transit-count')).toHaveText('0');
      await expect(page.getByText('Tienda de demostración')).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-store.png`, fullPage: true });
      await page.getByTestId('seller-products-link').click();
      await expect(page.locator('[data-testid^="seller-product-"]:visible')).toHaveCount(30);
      await page.getByTestId('seller-products-more').click();
      await expect(page.locator('[data-testid^="seller-product-"]:visible')).toHaveCount(32);
      await expect(page.getByTestId(`seller-product-${seller.privateProductId}`)).toContainText('Pendiente');
      await page.screenshot({ path: `${shots}/${colorScheme}-products.png` });
      await page.goBack();
      await page.getByTestId('seller-orders-link').click();
      await expect(page.locator('[data-testid^="seller-order-"]:visible')).toHaveCount(1);
      await expect(page.getByText(`Pedido ${seller.orderNumber} · entrega 1`, { exact: true })).toBeVisible();
      await expect(page.getByText('Esperando pago', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-orders.png`, fullPage: true });
      await page.getByTestId('seller-orders-done').click();
      await expect(page.getByText('Sin entregas cerradas', { exact: true })).toBeVisible();
      await page.goBack();
      await page.getByTestId('seller-settings-link').click();
      await expect(page.getByText(seller.email, { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(page.getByText('Consulta las condiciones en el panel.', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-settings.png`, fullPage: true });
      await page.goBack();
      await page.getByTestId(`seller-store-${seller.secondStoreId}`).click();
      await expect(page.getByTestId('seller-product-count')).toHaveText('0');
      await page.getByTestId('seller-orders-link').click();
      await expect(page.getByText('No hay entregas pendientes', { exact: true })).toBeVisible();
      await expect(page.getByText(new RegExp(seller.orderNumber!))).toHaveCount(0);
      await page.goBack();
      await page.getByTestId('seller-buy').click();
      await expect(page).toHaveURL(/\/account$/);
      await expect(page.getByTestId('account-name')).toHaveText('Ana Prueba');
      await expect(page.getByRole('tab')).toHaveCount(4);
      await expect(page.getByTestId('account-favorites')).toBeVisible();
    });

    test('empty catalogue, deliveries and store policies show useful states', async ({ page }) => {
      await signIn(page, empty); await openStore(page);
      await expect(page.getByTestId('seller-product-count')).toHaveText('0');
      await page.screenshot({ path: `${shots}/${colorScheme}-empty-store.png`, fullPage: true });
      await page.getByTestId('seller-products-link').click();
      await expect(page.getByText('Aún no tienes productos', { exact: true })).toBeVisible();
      await page.goBack(); await page.getByTestId('seller-orders-link').click();
      await expect(page.getByText('No hay entregas pendientes', { exact: true })).toBeVisible();
      await page.goBack(); await page.getByTestId('seller-settings-link').click();
      await expect(page.getByText('Sin registrar', { exact: true })).toBeVisible();
    });

    test('summary loading never invents zeros; a failed request retries and restores real counts', async ({ page }) => {
      await signIn(page, seller);
      const route = '**/rest/v1/rpc/seller_dashboard';
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route(route, async (r) => { await held; await r.abort('internetdisconnected'); });
      await openStore(page);
      try {
        await expect(page.getByTestId('seller-loading')).toBeVisible();
        await expect(page.getByTestId('seller-product-count')).toHaveCount(0);
      } finally { release(); }
      await expect(page.getByText('No pudimos cargar esto', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${shots}/${colorScheme}-summary-error.png` });
      await page.unroute(route);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await expect(page.getByTestId('seller-product-count')).toHaveText('32');
    });

    test('membership errors fail closed and retry; offline entry recovers on reconnect', async ({ page, context }) => {
      await signIn(page, seller);
      const route = '**/rest/v1/store_members*';
      await page.route(route, (r) => r.abort('internetdisconnected'));
      await page.goto('/my-store');
      await expect(page.getByText('No pudimos cargar esto', { exact: true })).toBeVisible();
      await expect(page.getByTestId('seller-store-name')).toHaveCount(0);
      await page.unroute(route);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
      await expect(page.getByTestId('seller-product-count')).toHaveText('32');
      await context.setOffline(true);
      await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
      await expect(page.getByTestId('seller-store-name')).toHaveCount(0);
      await page.screenshot({ path: `${shots}/${colorScheme}-offline.png` });
      await context.setOffline(false);
      await expect(page.getByTestId('seller-product-count')).toHaveText('32');
      await page.getByTestId('seller-account-back').click();
      await expect(page).toHaveURL(/\/account$/);
    });

    test('product and delivery failures offer retry without actions that modify orders', async ({ page }) => {
      await signIn(page, seller); await openStore(page);
      for (const [id, route] of [['seller-products-link', '**/rest/v1/products?*'], ['seller-orders-link', '**/rest/v1/rpc/seller_fulfillments']] as const) {
        await page.route(route, (r) => r.abort('internetdisconnected'));
        await page.getByTestId(id).click();
        await expect(page.getByText('No pudimos cargar esto', { exact: true })).toBeVisible();
        await page.unroute(route);
        await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
        await expect(page.getByText('No pudimos cargar esto', { exact: true })).toHaveCount(0);
        await page.goBack();
      }
    });

    test('advanced panel opens a real destination without changing mobile session', async ({ page, context }) => {
      await signIn(page, seller); await openStore(page);
      await page.getByTestId('seller-settings-link').click();
      // Exercise browser navigation without depending on an unrelated Next server compiling in the popup.
      // This is only the external destination; all mobile store data above comes from the real local backend.
      await context.route('**/vendedor/tienda', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Panel de pruebas</title>' }));
      const opened = context.waitForEvent('page');
      await page.getByTestId('seller-panel').filter({ visible: true }).tap();
      const panel = await opened;
      await expect.poll(() => panel.url()).toContain('/vendedor/tienda');
      await panel.close();
      await expect(page).toHaveURL(/\/my-store\/settings$/);
      await expect(page.getByText(seller.email, { exact: true }).filter({ visible: true })).toBeVisible();
    });

    test('signing out removes seller access and another buyer never sees cached store data', async ({ page }) => {
      await signIn(page, seller); await openStore(page);
      await expect(page.getByTestId('seller-product-count')).toHaveText('32');
      await page.getByTestId('seller-account-back').click();
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await expect(page.getByTestId('account-sign-in')).toBeVisible();
      await expect(page.getByTestId('account-my-store')).toHaveCount(0);
      await page.goto('/my-store');
      await expect(page.getByText('Entra a tu cuenta', { exact: true })).toBeVisible();
      await signIn(page, await newBuyer(`ven-after-logout-${colorScheme}`));
      await page.goto('/my-store');
      await expect(page.getByText('No tienes una tienda asignada', { exact: true })).toBeVisible();
      await expect(page.getByTestId('seller-store-name')).toHaveCount(0);
      await expect(page.getByTestId('seller-product-count')).toHaveCount(0);
    });
  });
}
