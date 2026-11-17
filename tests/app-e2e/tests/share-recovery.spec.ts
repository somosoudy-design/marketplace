import { expect, test } from '@playwright/test';
for (const colorScheme of ['light', 'dark'] as const)
  test(`compartir ${colorScheme}: error recuperable, guardado y cierre protegen la selección`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 390, height: 892 });
    await page.route('**/*', (r) => {
      const u = new URL(r.request().url());
      return ['127.0.0.1', 'localhost'].includes(u.hostname) || ['data:', 'blob:'].includes(u.protocol)
        ? r.continue()
        : r.abort();
    });
    await page.addInitScript(() => {
      const w = window as any;
      w.copyFails = true;
      w.copyWrites = 0;
      w.shares = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            w.copyWrites++;
            if (w.copyFails) throw new Error('denied');
            w.copied = text;
          },
        },
      });
      Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => {
          w.shares++;
          return new Promise((_resolve, reject) => {
            w.rejectShare = reject;
          });
        },
      });
    });
    await page.goto('/p/ugreen-cable-usb-c-100w');
    await page.getByTestId('product-share').click();
    const sheet = page.getByTestId('product-share-sheet');
    const copy = page.getByTestId('product-share-copy');
    await copy.click();
    await expect(sheet).toContainText('No pudimos compartir el enlace');
    await expect(copy).toHaveText('Copiar enlace');
    await page.evaluate(() => ((window as any).copyFails = false));
    await copy.click();
    await expect(copy).toHaveText('Enlace copiado');
    expect(await page.evaluate(() => (window as any).copied)).toContain('/p/ugreen-cable-usb-c-100w');
    await expect(sheet).not.toContainText('No pudimos compartir el enlace');
    const share = page.getByTestId('product-share-native');
    await share.evaluate((b) => {
      (b as HTMLElement).click();
      (b as HTMLElement).click();
    });
    await expect(share).toBeDisabled();
    await expect(copy).toBeDisabled();
    expect(await page.evaluate(() => (window as any).shares)).toBe(1);
    await page.getByTestId('product-share-sheet-close').click();
    await expect(sheet).toHaveCount(0);
    await page.evaluate(() => (window as any).rejectShare(new Error('late')));
    await page.getByTestId('product-share').click();
    await expect(sheet).not.toContainText('No pudimos compartir el enlace');
    await expect(copy).toBeEnabled();
    await page.screenshot({ path: info.outputPath('compartir.png') });
  });
