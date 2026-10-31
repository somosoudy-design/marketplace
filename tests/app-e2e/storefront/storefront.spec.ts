import { test, expect } from '@playwright/test';
import pg from 'pg';

// These mutation tests are local only; never send account/cart writes to the shared Marketplace.
test.beforeEach(async ({ context }) => {
  await context.route('https://mimnotafmfasvwrclxan.supabase.co/**', (route) => route.abort('blockedbyclient'));
});
import { databaseUrl, newBuyer } from '../tests/support/db';

const noOverflow = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
for (const colorScheme of ['light', 'dark'] as const)
  for (const width of [1440, 412, 320]) {
    test(`catálogo y ficha ${width} ${colorScheme}`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Buenos hallazgos. Todos los días.' })).toBeVisible();
      await expect(page.getByTestId('product-card').first()).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath('inicio.png'), fullPage: true });
      const category = page.getByRole('navigation', { name: 'Categorías' }).getByRole('link').first();
      await category.click();
      await expect(page).toHaveURL(/category=/);
      await expect(page.getByTestId('product-card').first()).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: info.outputPath('buscar.png'), fullPage: true });
      const searchUrl = page.url();
      await page.getByTestId('product-card').first().locator('a').first().click();
      await expect(page.getByRole('heading', { name: 'Sobre este producto' })).toBeVisible();
      await noOverflow(page);
      const images = page.locator('.product-gallery>.product-photo img');
      await expect(images).toBeVisible();
      expect(await images.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      await page.screenshot({ path: info.outputPath('ficha.png'), fullPage: true });
      await page.goBack();
      await expect(page).toHaveURL(searchUrl);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

test('búsqueda, filtros, orden y paginación mantienen URL compartible', async ({ page }) => {
  await page.goto('/buscar');
  if (await page.getByRole('button', { name: 'Filtrar y ordenar' }).isVisible())
    await page.getByRole('button', { name: 'Filtrar y ordenar' }).click();
  await page.locator('.filter-form input[name=q]').fill('UGREEN');
  await page.locator('select[name=sort]').selectOption('price_asc');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/q=UGREEN/);
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  const prices = await page.locator('.product-price strong:visible').allTextContents();
  const nums = prices.map((p) => Number(p.replace(/[^\d,]/g, '').replace(',', '.')));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
  await page.goto('/buscar?availability=on_order');
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  await expect(page.locator('.product-card:visible .availability').filter({ hasText: /^Por encargo$/ })).toHaveCount(
    await page.locator('.product-card:visible').count(),
  );
  await page.goto('/buscar');
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});

test('vacío, ficha inexistente y acceso invitado tienen salida', async ({ page }) => {
  await page.goto('/buscar?q=zzzinexistente83976');
  await expect(page.getByRole('heading', { name: 'No encontramos productos' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver todo el catálogo' }).click();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  const missing = await page.goto('/p/no-existe-1234');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no está disponible' })).toBeVisible();
  await page.goto('/carrito');
  await expect(page.getByRole('link', { name: 'Iniciar sesión', exact: true })).toBeVisible();
});

test('sesión real, favoritos, carrito persistido e aislamiento al cerrar sesión', async ({ page, browser }) => {
  const buyer = await newBuyer('storefront-buyer');
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await page.goto('/p/ugreen-cable-usb-c-100w');
  const favorite = page.locator('.detail-title .favorite:visible');
  await expect(favorite).toBeEnabled();
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Ver carrito', exact: false }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: /Aumentar cantidad/ }).click();
  await expect(page.locator('.quantity span')).toHaveText('2');
  const db = new pg.Client({ connectionString: databaseUrl() });
  await db.connect();
  try {
    expect(
      (await db.query('select quantity from public.cart_items where user_id=$1', [buyer.id])).rows[0].quantity,
    ).toBe(2);
    expect(
      (await db.query('select count(*)::int n from public.favorites where user_id=$1', [buyer.id])).rows[0].n,
    ).toBe(1);
  } finally {
    await db.end();
  }
  await page.reload();
  await expect(page.locator('.quantity span')).toHaveText('2');
  // Independent session on a second browser proves backend persistence, not just React state.
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto('/cuenta');
  await other.getByLabel('Correo electrónico').fill(buyer.email);
  await other.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await other.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await other.goto('/favoritos');
  await expect(other.getByTestId('product-card')).toHaveCount(1);
  await other.goto('/carrito');
  await expect(other.locator('.quantity span')).toHaveText('2');
  await context.close();
  await page.goto('/favoritos');
  await expect(page.getByTestId('product-card')).toHaveCount(1);
  await page.locator('.favorite').click();
  await expect(page.getByRole('heading', { name: 'Tus favoritos empiezan aquí' })).toBeVisible();
  await page.goto('/carrito');
  await page.getByRole('button', { name: /Eliminar/ }).click();
  await page.getByRole('button', { name: 'Conservar', exact: true }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await page.getByRole('button', { name: /Eliminar/ }).click();
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu próximo hallazgo te espera' })).toBeVisible();
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.goto('/favoritos');
  await expect(page.getByRole('heading', { name: 'Guarda tus próximos hallazgos' })).toBeVisible();
  const second = await newBuyer('storefront-isolation');
  await page.goto('/cuenta');
  await page.getByLabel('Correo electrónico').fill(second.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(second.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await page.goto('/favoritos');
  await expect(page.getByRole('heading', { name: 'Tus favoritos empiezan aquí' })).toBeVisible();
  await page.goto('/carrito');
  await expect(page.getByRole('heading', { name: 'Tu próximo hallazgo te espera' })).toBeVisible();
});

test('errores del backend no simulan guardado y permiten reintentar', async ({ page }) => {
  const buyer = await newBuyer('storefront-errors');
  await page.goto('/cuenta?volver=/p/ugreen-cable-usb-c-100w');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Agregar al carrito' })).toBeEnabled();
  await page.route('**/rpc/cart_add', (r) => r.abort('failed'));
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.locator('.product-information [role=alert]')).toBeVisible();
  await expect(page.getByText('Agregado al carrito', { exact: false })).toHaveCount(0);
  await page.unroute('**/rpc/cart_add');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByText('Agregado al carrito', { exact: false })).toBeVisible();
});

test('teclado, movimiento reducido y filtros colapsados en móvil', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/buscar');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir al contenido' })).toBeFocused();
  const toggle = page.getByRole('button', { name: 'Filtrar y ordenar' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  expect((await page.getByTestId('product-card').first().boundingBox())!.y).toBeLessThan(500);
  await toggle.click();
  await expect(page.getByLabel('Ordenar por')).toBeVisible();
  await toggle.click();
  await expect(page.getByLabel('Ordenar por')).not.toBeVisible();
  await noOverflow(page);
});

test('redirección de login externa rechazada y SSR contiene catálogo sin JS', async ({ page, browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('/');
  await expect(staticPage.getByTestId('product-card').first()).toBeVisible();
  await staticPage.goto('/p/ugreen-cable-usb-c-100w');
  await expect(staticPage.getByRole('heading', { name: 'Sobre este producto' })).toBeVisible();
  await context.close();
  const buyer = await newBuyer('storefront-redirect');
  await page.goto('/cuenta?volver=//example.com');
  await page.getByLabel('Correo electrónico').fill(buyer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
});
