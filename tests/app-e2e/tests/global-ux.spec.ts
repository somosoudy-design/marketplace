import { expect, test, type Locator, type Page } from '@playwright/test';
import { newBuyer } from './support/db';
import { sellerFixture } from './support/seller';

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.getByTestId('sign-in-email').fill(user.email);
  await page.getByTestId('sign-in-password').fill(user.password);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function touchTarget(control: Locator) {
  const box = (await control.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`global UX ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 320, height: 780 } });

    test('category reset preserves the query; empty recovery resets editable filters', async ({ page }) => {
      await page.goto('/explore');
      await page.getByTestId('catalog-search').fill('ugreen');
      await page.getByTestId('chip-category-tecnologia').click();
      await expect(page.getByTestId('catalog-reset-filters')).toBeVisible();
      await page.getByTestId('catalog-reset-filters').click();
      await expect(page.getByTestId('catalog-search')).toHaveValue('ugreen');
      await expect(page.getByTestId('chip-category-tecnologia')).toHaveAttribute('aria-pressed', 'false');
      await page.getByTestId('chip-category-belleza').click();
      await page.getByTestId('chip-availability-available').click();
      await page.getByTestId('catalog-search').fill('zzzz-no-existe');
      await page.getByRole('button', { name: 'Restablecer búsqueda', exact: true }).click();
      await expect(page.getByTestId('catalog-search')).toHaveValue('');
      await expect(page.getByTestId('chip-category-belleza')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('chip-availability-available')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible();
      await expect(page.getByTestId('catalog-reset-filters')).toHaveCount(0);
    });

    test('recovery retains category, collection and store contexts defined by the screen', async ({ page }) => {
      let last: Record<string, unknown> = {};
      page.on('request', (request) => { if (request.url().includes('/rpc/search_products')) last = request.postDataJSON(); });
      for (const [route, key, value] of [
        ['/catalog?category=tecnologia', 'p_category', 'tecnologia'],
        ['/catalog?collection=esenciales-tech', 'p_collection', 'esenciales-tech'],
        ['/tienda/kora', 'p_store', 'kora'],
      ]) {
        await page.goto(route!);
        const first = page.locator('[data-testid^="product-card-"]:visible').first();
        await expect(first).toBeVisible();
        const productId = (await first.getAttribute('data-testid'))!;
        await expect.poll(() => last[key!]).toBe(value);
        await page.getByTestId('catalog-search').fill('zzzz-no-existe');
        const recover = page.getByRole('button', { name: 'Restablecer búsqueda', exact: true });
        await expect(recover).toBeVisible();
        expect(last[key!]).toBe(value);
        await recover.click();
        await expect(page.getByTestId('catalog-search')).toHaveValue('');
        // Restoring cached results need not make another network request. Verify the actual screen context.
        await expect(page.getByTestId(productId)).toBeVisible();
        await expect(recover).toHaveCount(0);
      }
    });

    test('filters, password reveal and quantity controls have real touch targets; cart fits 320px', async ({ page }) => {
      await page.goto('/sign-in');
      const reveal = page.getByRole('button', { name: 'Mostrar contraseña', exact: true });
      await touchTarget(reveal);
      await page.getByTestId('sign-in-password').fill('test-password');
      await reveal.click();
      await expect.poll(() => page.getByTestId('sign-in-password').evaluate((el) => (el as HTMLInputElement).type)).toBe('text');
      await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
      await expect(page.getByTestId('sign-in-password')).toHaveAttribute('type', 'password');
      await page.goto('/explore');
      await touchTarget(page.getByTestId('chip-sort'));
      await page.goto('/p/ugreen-cable-usb-c-100w');
      await touchTarget(page.getByRole('button', { name: 'Aumentar cantidad', exact: true }));
      await touchTarget(page.getByRole('button', { name: 'Disminuir cantidad', exact: true }));
      await page.getByTestId('product-cta').click();
      const line = page.locator('[data-testid^="cart-line-"]').first();
      await expect(line).toBeVisible();
      await touchTarget(line.getByRole('button', { name: 'Aumentar cantidad', exact: true }));
      const overflow = await line.evaluate((el) => [...el.querySelectorAll('*')].some((child) => child.getBoundingClientRect().right > 320));
      expect(overflow).toBe(false);
      await line.getByRole('button', { name: 'Aumentar cantidad', exact: true }).click();
      await expect(line.getByLabel('Cantidad 2', { exact: true })).toBeVisible();
    });

    test('sheet options select correctly, close visibly and support keyboard dismissal', async ({ page }) => {
      await page.goto('/explore');
      await page.getByTestId('chip-sort').click();
      const sheet = page.getByTestId('catalog-options');
      await expect(sheet.getByRole('radiogroup', { name: 'Ordenar por' })).toBeVisible();
      await touchTarget(sheet.getByRole('button', { name: 'Cerrar opciones', exact: true }));
      await sheet.getByRole('radio', { name: 'Menor precio', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByTestId('chip-sort')).toHaveText(/Menor precio/);
      await page.getByTestId('chip-sort').click();
      await expect(page.getByRole('dialog')).toBeVisible(); // Modal is active after its opening transition.
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await page.getByTestId('chip-sort').click();
      await sheet.getByRole('button', { name: 'Cerrar opciones', exact: true }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByTestId('chip-sort')).toHaveText(/Menor precio/);
    });

    test('field errors are associated and cleared on edit; loading retains the action label', async ({ page }) => {
      await signIn(page, await newBuyer(`global-fields-${colorScheme}`));
      await page.goto('/addresses/edit');
      await page.getByTestId('addr-save').click();
      const recipient = page.getByTestId('addr-recipient');
      await expect(recipient).toHaveAttribute('aria-invalid', 'true');
      const description = (await recipient.getAttribute('aria-describedby'))!;
      expect(description).toBeTruthy();
      await expect(page.locator(`[id="${description}"]`)).toBeVisible();
      await recipient.fill('Nombre Prueba');
      await expect(recipient).not.toHaveAttribute('aria-invalid', 'true');
      const phone = page.getByTestId('addr-phone');
      await expect(phone).toHaveAttribute('aria-describedby', /message/);
      // Validation rejects locally: no address is persisted by this incomplete form.
      await page.goto('/account');
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await page.goto('/sign-in');
      await page.getByTestId('sign-in-email').fill('missing@example.com');
      await page.getByTestId('sign-in-password').fill('not-a-real-password');
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/auth/v1/token?grant_type=password', async (route) => { await held; await route.abort(); });
      const submit = page.getByTestId('sign-in-submit');
      await submit.click();
      try {
        await expect(submit).toBeDisabled();
        await expect(submit).toHaveAttribute('aria-busy', 'true');
        await expect(submit).toHaveText(/Iniciar sesión/);
      } finally { release(); }
      await expect(submit).toHaveAttribute('aria-busy', 'false');
    });

    test('account separates buying and managing without granting roles; long actions wrap', async ({ page }) => {
      await signIn(page, await newBuyer(`global-account-${colorScheme}`));
      await page.goto('/account');
      await expect(page.getByTestId('account-purchases-heading')).toHaveText('Tus compras');
      await expect(page.getByTestId('account-business-heading')).toHaveCount(0);
      await expect(page.getByTestId('account-orders')).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      const seller = await sellerFixture(`global-seller-${colorScheme}`, { empty: true, admin: true });
      await signIn(page, seller);
      await page.goto('/account');
      await expect(page.getByTestId('account-business-heading')).toHaveText('Tu negocio');
      await expect(page.getByTestId('account-my-store')).toBeVisible();
      await expect(page.getByTestId('account-admin')).toHaveCount(1);
      await expect(page.getByTestId('account-orders')).toBeVisible();
      await page.goto('/settings');
      const action = page.getByRole('button', { name: 'Borrar mi historial de navegación', exact: true });
      await touchTarget(action);
      const text = action.getByText('Borrar mi historial de navegación', { exact: true });
      await expect(text).toBeVisible();
      const box = (await text.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await text.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe('ellipsis');
      // Browser stress test at the app's supported 1.6x text scale; actual Android font scaling stays native QA.
      await text.evaluate((el) => { (el as HTMLElement).style.fontSize = '21px'; (el as HTMLElement).style.lineHeight = '26px'; });
      expect((await action.boundingBox())!.height).toBeGreaterThan(44);
      expect((await text.boundingBox())!.x + (await text.boundingBox())!.width).toBeLessThanOrEqual(320);
    });
  });
}

test.describe('global reduced motion and keyboard', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 320, height: 780 } });
  test('keyboard focus is visible and Escape closes a reduced-motion sheet', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByTestId('sign-in-password').focus();
    await page.keyboard.press('Tab');
    const reveal = page.getByRole('button', { name: 'Mostrar contraseña', exact: true });
    await expect(reveal).toBeFocused();
    await expect.poll(() => reveal.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Ocultar contraseña', exact: true })).toBeFocused();
    await page.goto('/explore');
    await page.getByTestId('chip-sort').click();
    await expect(page.getByTestId('catalog-options')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('catalog-options')).toHaveCount(0);
  });
});
