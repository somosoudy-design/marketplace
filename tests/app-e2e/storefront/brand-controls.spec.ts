import { test, expect } from '@playwright/test';
import { newBuyer, databaseUrl } from '../tests/support/db';
import { controlContrast, guardLocalVisualRead } from '../tests/support/visual-controls';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`header reflow, keyboard and secondary hover contrast: ${colorScheme}`, async ({ page }) => {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl()).hostname)) throw new Error('Exact loopback database required');
    const buyer = await newBuyer('brand-controls'); // Generated locally, no stored credential fixture.
    await guardLocalVisualRead(page);
    await page.setViewportSize({ width: 320, height: 960 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Ir al contenido' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();
    const search = page.getByRole('button', { name: 'Buscar', exact: true });
    await search.focus();
    const target = await search.evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, outline: getComputedStyle(node).outlineWidth }));
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(parseFloat(target.outline)).toBeGreaterThan(0);
    const reflow = await page.locator('header').evaluate((header) => {
      const elements = [header, ...header.querySelectorAll('*')].filter((e): e is HTMLElement => e instanceof HTMLElement);
      const sizes = elements.map((e) => ({ e, font: parseFloat(getComputedStyle(e).fontSize), line: parseFloat(getComputedStyle(e).lineHeight) }));
      for (const { e, font, line } of sizes) {
        e.style.fontSize = `${font * 1.6}px`;
        if (Number.isFinite(line)) e.style.lineHeight = `${line * 1.6}px`;
      }
      return { scrollWidth: document.documentElement.scrollWidth, brandRight: header.querySelector('.wordmark')!.getBoundingClientRect().right, actionsLeft: header.querySelector('.account-nav')!.getBoundingClientRect().left };
    });
    expect(reflow.scrollWidth).toBeLessThanOrEqual(320);
    expect(reflow.brandRight).toBeLessThanOrEqual(reflow.actionsLeft);

    await page.goto('/cuenta'); // Resets the temporary text-size adaptation above.
    await page.getByLabel('Correo electrónico').fill(buyer.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(buyer.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
    const secondary = page.getByRole('button', { name: 'Cerrar sesión', exact: true });
    await secondary.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    expect(await controlContrast(secondary)).toBeGreaterThanOrEqual(4.5);
    await secondary.hover();
    expect(await controlContrast(secondary)).toBeGreaterThanOrEqual(4.5);

    // Purchase CSS must keep the original wordmark and all three account actions on one row.
    // The nonexistent local payment exercises its shell without creating an order or a payment.
    for (const path of ['/checkout', '/pagar/00000000-0000-0000-0000-000000000000']) {
      await page.goto(path);
      const header = page.locator('header.header-focused');
      await expect(header).toBeVisible();
      await expect(header.locator('.account-nav a:visible')).toHaveCount(3);
      const fit = await header.evaluate((node) => {
        const logo = node.querySelector('.wordmark')!.getBoundingClientRect();
        const actions = [...node.querySelectorAll<HTMLElement>('.account-nav a')]
          .filter((link) => getComputedStyle(link).display !== 'none')
          .map((link) => { const r = link.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        return { logo: { right: logo.right, y: logo.y, width: logo.width }, actions, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(fit.scrollWidth).toBe(320);
      expect(fit.logo.width).toBeGreaterThanOrEqual(144);
      expect(fit.actions[0]!.x - fit.logo.right).toBeGreaterThanOrEqual(6);
      for (const action of fit.actions) {
        expect(Math.abs(action.y - fit.logo.y)).toBeLessThan(1);
        expect(action.width).toBeGreaterThanOrEqual(44);
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.x + action.width).toBeLessThanOrEqual(320);
      }
    }
  });
}
