import { test, expect } from '@playwright/test';
import { signIn } from './helpers';
import { controlContrast, guardLocalVisualRead } from '../tests/support/visual-controls';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`editor mobile layout and destructive control contrast: ${colorScheme}`, async ({ page }) => {
    await guardLocalVisualRead(page);
    await page.setViewportSize({ width: 320, height: 960 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await signIn(page, 'admin@example.com'); // Existing local seed only.
    await page.goto('/admin/contenido');
    await expect(page.getByRole('heading', { name: 'Datos de la colección' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const smallTargets = await page.locator('main button[aria-label]').evaluateAll((buttons) => buttons
      .filter((b) => /^(Subir|Bajar|Quitar)/.test(b.getAttribute('aria-label') ?? ''))
      .map((b) => ({ name: b.getAttribute('aria-label'), width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height }))
      .filter((b) => b.width < 44 || b.height < 44));
    expect(smallTargets).toEqual([]);

    await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); // Opens confirmation only.
    const dialog = page.getByRole('dialog', { name: 'Eliminar colección' });
    const danger = dialog.getByRole('button', { name: 'Eliminar', exact: true });
    await expect(danger).toBeVisible();
    await page.mouse.move(0, 0);
    expect(await controlContrast(danger)).toBeGreaterThanOrEqual(4.5);
    await danger.hover();
    expect(await controlContrast(danger)).toBeGreaterThanOrEqual(4.5);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}
