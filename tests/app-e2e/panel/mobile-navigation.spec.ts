import { expect, test, type Page } from '@playwright/test';

// Local fixtures only. Keep writes and external destinations blocked during this navigation test.
async function signIn(page: Page, role: 'admin' | 'vendedor') {
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    const panel = url.port === new URL(process.env.PANEL_BASE_URL ?? 'http://127.0.0.1:3100').port;
    const auth = url.pathname === '/auth/v1/token' && request.method() === 'POST';
    const readRpc = request.method() === 'POST' && ['/rest/v1/rpc/admin_dashboard', '/rest/v1/rpc/push_health', '/rest/v1/rpc/seller_dashboard'].includes(url.pathname);
    if (local && (panel || request.method() === 'GET' || auth || readRpc)) return route.continue();
    return route.abort();
  });
  await page.goto('/login');
  await page.locator('input[name=email]').fill(`${role}@example.com`);
  await page.locator('input[name=password]').fill('Demo-1234');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(new RegExp(`/${role}(?:/|$)`));
  await page.goto(role === 'admin' ? '/admin/pedidos' : '/vendedor/productos');
  await expect(page.locator('main h1')).toBeVisible();
}

for (const role of ['admin', 'vendedor'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 390]) {
      test(`${role}: menú móvil, teclado y objetivos en ${theme} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await signIn(page, role);
        const trigger = page.getByRole('button', { name: 'Menú', exact: true });
        const aside = page.locator('#panel-navigation');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
        await trigger.focus();
        await page.keyboard.press('Tab');
        expect(await aside.evaluate((element) => element.contains(document.activeElement))).toBe(false);
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Menú de navegación' });
        const close = dialog.getByRole('button', { name: 'Cerrar menú' });
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(close).toBeFocused();
        await expect(page.locator('main').locator('..')).toHaveAttribute('inert', '');
        await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (process.env.PANEL_SHOTS) await page.screenshot({ path: `${process.env.PANEL_SHOTS}/${role}-${theme}-${width}-abierto.png`, animations: 'disabled' });

        const smallTargets = await dialog.locator('a, button, select').evaluateAll((elements) => elements
          .filter((element) => getComputedStyle(element).display !== 'none')
          .map((element) => ({ name: element.getAttribute('aria-label') || element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
          .filter(({ width: w, height: h }) => w < 44 || h < 44));
        expect(smallTargets).toEqual([]);
        const triggerSize = await trigger.boundingBox();
        expect(triggerSize?.height).toBeGreaterThanOrEqual(44);
        expect(triggerSize?.width).toBeGreaterThanOrEqual(44);

        // Both ends wrap and every Tab remains inside the dialog, including while it scrolls.
        const first = dialog.locator('a[href="/"]');
        const last = dialog.getByRole('button', { name: 'Cerrar sesión' });
        await first.focus();
        await page.keyboard.press('Shift+Tab');
        await expect(last).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(first).toBeFocused();
        const count = await dialog.locator('a, button, select').count();
        for (let n = 0; n < count + 2; n++) {
          await page.keyboard.press('Tab');
          expect(await aside.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
        await expect(page.locator('main').locator('..')).not.toHaveAttribute('inert', '');

        // The explicit close control and the backdrop also restore focus.
        await trigger.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Cerrar menú' }).click();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.mouse.click(width - 10, 450);
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // Choosing an existing destination closes the drawer and keeps the route and current-page marker.
        await trigger.click();
        const destination = role === 'admin' ? '/admin/inventario' : '/vendedor/pedidos';
        await page.locator(`#panel-navigation a[href="${destination}"]`).click();
        await expect(page).toHaveURL(new RegExp(`${destination}$`));
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(page.locator(`#panel-navigation a[href="${destination}"]`)).toHaveAttribute('aria-current', 'page');
      });
    }
    for (const width of [1024, 1280]) {
      test(`${role}: navegación de escritorio en ${theme} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme });
        await signIn(page, role);
        await expect(page.getByRole('button', { name: 'Menú', exact: true })).toHaveCount(0);
        await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        const destination = role === 'admin' ? '/admin/inventario' : '/vendedor/pedidos';
        await page.locator(`#panel-navigation a[href="${destination}"]`).click();
        await expect(page).toHaveURL(new RegExp(`${destination}$`));
        await expect(page.locator(`#panel-navigation a[href="${destination}"]`)).toHaveAttribute('aria-current', 'page');
        await page.evaluate(() => document.fonts.ready);
        if (process.env.PANEL_SHOTS && width === 1024) await page.screenshot({ path: `${process.env.PANEL_SHOTS}/${role}-${theme}-${width}-escritorio.png`, animations: 'disabled' });
      });
    }
  }
  test(`${role}: cambios de ancho repetidos mantienen el foco visible`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await signIn(page, role);
    for (const motion of ['reduce', 'no-preference'] as const) {
      await page.emulateMedia({ reducedMotion: motion });
      for (let n = 0; n < 5; n++) {
        await page.getByRole('button', { name: 'Menú', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.setViewportSize({ width: 1024, height: 900 });
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.locator('#panel-navigation nav a[aria-current="page"]')).toBeFocused();
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(page.getByRole('button', { name: 'Menú', exact: true })).toBeFocused();
      }
    }
    // Moving focus or the pointer into the content must not bring it back to the menu on resize.
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.locator('#panel-navigation nav a[aria-current="page"]').focus();
    await page.locator('main h1').click();
    expect(await page.locator('#panel-navigation').evaluate((element) => element.contains(document.activeElement))).toBe(false);
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.getByRole('button', { name: 'Menú', exact: true })).not.toBeFocused();
  });
  for (const theme of ['light', 'dark'] as const) {
    test(`${role}: puntos intermedios del panel en ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await signIn(page, role);
      for (const width of [768, 1023, 1279, 1360]) {
        await page.setViewportSize({ width, height: 900 });
        if (width < 1024) {
          const trigger = page.getByRole('button', { name: 'Menú', exact: true });
          await trigger.focus();
          await page.keyboard.press('Enter');
          await expect(page.getByRole('dialog', { name: 'Menú de navegación' }).getByRole('button', { name: 'Cerrar menú' })).toBeFocused();
          if (process.env.PANEL_SHOTS) await page.screenshot({ path: `${process.env.PANEL_SHOTS}/${role}-${theme}-${width}-intermedio.png`, animations: 'disabled' });
          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
        } else {
          await expect(page.getByRole('navigation', { name: 'Secciones' })).toBeVisible();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(page.locator('#panel-navigation nav a[aria-current="page"]')).toBeVisible();
          if (process.env.PANEL_SHOTS) await page.screenshot({ path: `${process.env.PANEL_SHOTS}/${role}-${theme}-${width}-intermedio.png`, animations: 'disabled' });
        }
      }
    });
    test(`${role}: texto ampliado mantiene separada la acción de cierre en ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 780 });
      await page.emulateMedia({ colorScheme: theme });
      await signIn(page, role);
      await page.getByRole('button', { name: 'Menú', exact: true }).click();
      const geometry = await page.locator('#panel-navigation').evaluate((panel) => {
        const elements = [panel, ...panel.querySelectorAll('*')].filter((element): element is HTMLElement => element instanceof HTMLElement);
        const sizes = elements.map((element) => ({ element, font: parseFloat(getComputedStyle(element).fontSize), line: parseFloat(getComputedStyle(element).lineHeight) }));
        for (const { element, font, line } of sizes) {
          element.style.fontSize = `${font * 1.6}px`;
          if (Number.isFinite(line)) element.style.lineHeight = `${line * 1.6}px`;
        }
        const title = panel.querySelector('a[href="/"] span:last-child')!.getBoundingClientRect();
        const close = panel.querySelector('button[aria-label="Cerrar menú"]')!.getBoundingClientRect();
        return { textRight: title.right, closeLeft: close.left };
      });
      expect(geometry.textRight).toBeLessThanOrEqual(geometry.closeLeft);
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Cerrar menú' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Menú', exact: true })).toBeFocused();
    });
  }
  test(`${role}: objetivos conservan 44px con tamaño raíz reducido`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await signIn(page, role);
    await page.addStyleTag({ content: 'html { font-size: 12px !important; }' });
    const trigger = page.getByRole('button', { name: 'Menú', exact: true });
    const triggerSize = await trigger.boundingBox();
    expect(triggerSize?.width).toBeGreaterThanOrEqual(44);
    expect(triggerSize?.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const smallTargets = await page.getByRole('dialog').locator('a, button, select').evaluateAll((elements) => elements
      .filter((element) => getComputedStyle(element).display !== 'none')
      .map((element) => ({ name: element.getAttribute('aria-label') || element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
      .filter(({ width, height }) => width < 44 || height < 44));
    expect(smallTargets).toEqual([]);
  });
}

test('cuenta con ambos roles puede cambiar de panel desde el menú móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await page.getByRole('link', { name: 'Ir al panel de vendedor' }).click();
  await expect(page).toHaveURL(/\/vendedor$/);
  const trigger = page.getByRole('button', { name: 'Menú', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Productos', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a administración' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('button', { name: 'Menú', exact: true })).toBeFocused();
});
