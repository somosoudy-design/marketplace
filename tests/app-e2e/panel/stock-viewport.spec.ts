import { expect, test } from '@playwright/test';

// Local stack only: editing the input is in-memory; no inventory writes leave the browser.
for (const role of ['admin', 'vendedor'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${role}: guardar inventario sigue visible en ${colorScheme} a 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.emulateMedia({ colorScheme });
      let writes = 0;
      await page.route('**/*', (route) => {
        const request = route.request(), url = new URL(request.url());
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return route.abort();
        const readRpc = request.method() === 'POST' && ['/rest/v1/rpc/admin_dashboard', '/rest/v1/rpc/push_health', '/rest/v1/rpc/seller_dashboard'].includes(url.pathname);
        if (url.pathname.startsWith('/rest/v1/') && !['GET', 'HEAD'].includes(request.method()) && !readRpc) {
          writes++;
          return route.abort();
        }
        return route.continue();
      });
      await page.goto('/login');
      await page.locator('input[name=email]').fill(`${role}@example.com`);
      await page.locator('input[name=password]').fill('Demo-1234');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${role}(?:/|$)`));
      await page.goto(role === 'admin' ? '/admin/inventario' : '/vendedor/productos');
      if (role === 'vendedor') await page.getByRole('tab', { name: 'Inventario', exact: true }).click();
      await page.getByRole('tab', { name: 'Todo el inventario', exact: true }).click();
      const table = page.locator('main table').first();
      const scroll = table.locator('..');
      const input = table.locator('input[type=number]').first();
      await expect(input).toBeVisible();
      await scroll.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      const before = await scroll.evaluate((el) => ({ width: el.scrollWidth, left: el.scrollLeft }));
      const value = await input.inputValue();
      await input.fill(String(Number(value) + 1));
      const save = table.getByRole('button', { name: 'Guardar', exact: true }).first();
      await expect(save).toBeVisible();
      const after = await scroll.evaluate((el) => ({ width: el.scrollWidth, left: el.scrollLeft }));
      const [viewport, action, field] = await Promise.all([scroll.boundingBox(), save.boundingBox(), input.boundingBox()]);
      expect(after.width).toBe(before.width);
      expect(action!.width).toBeGreaterThanOrEqual(44);
      expect(action!.height).toBeGreaterThanOrEqual(44);
      expect(field!.x).toBeGreaterThanOrEqual(viewport!.x);
      expect(field!.x + field!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width);
      expect(action!.x).toBeGreaterThanOrEqual(viewport!.x);
      expect(action!.x + action!.width).toBeLessThanOrEqual(viewport!.x + viewport!.width);
      expect(writes).toBe(0);
    });
  }
}
