/** Local Expo app regression for the approved mobile direction. */
import { expect, test, type Locator, type Page } from '@playwright/test';

const destinations = [
  ['index', 'Inicio'], ['explore', 'Buscar'], ['cart', 'Carrito'], ['account', 'Cuenta'],
] as const;

async function expectRenderedLabel(label: Locator) {
  await expect(label).toBeVisible();
  const result = await label.evaluate((node) => {
    const el = node as HTMLElement;
    let opacity = 1;
    let ancestor: HTMLElement | null = el;
    while (ancestor) {
      const css = getComputedStyle(ancestor);
      opacity *= Number(css.opacity);
      if (css.visibility === 'hidden' || css.display === 'none') opacity = 0;
      ancestor = ancestor.parentElement;
    }
    const rect = el.getBoundingClientRect();
    const tab = el.closest('[role="tab"]')?.getBoundingClientRect();
    return {
      opacity,
      fitsSelf: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
      fitsTab: !!tab && rect.left >= tab.left - 1 && rect.right <= tab.right + 1 && rect.top >= tab.top - 1 && rect.bottom <= tab.bottom + 1,
    };
  });
  expect(result.opacity).toBeGreaterThan(0.9);
  expect(result.fitsSelf).toBe(true);
  expect(result.fitsTab).toBe(true);
}

async function expectFourLabels(page: Page) {
  for (const [name, text] of destinations) {
    const tab = page.getByTestId(`buyer-tab-${name}`);
    await expectRenderedLabel(tab.getByText(text, { exact: true }));
    const rect = await tab.boundingBox();
    expect(rect?.width).toBeGreaterThanOrEqual(44);
    expect(rect?.height).toBeGreaterThanOrEqual(44);
  }
}

test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  expect(['127.0.0.1', 'localhost', '[::1]']).toContain(new URL(baseURL!).hostname);
  // Guard against accidentally running a local build configured for remote Supabase.
  await page.route('https://*.supabase.co/**', route => route.abort('blockedbyclient'));
});

for (const width of [360, 390, 412]) {
  test(`referencia móvil a ${width}px: etiquetas, foto y cuatro categorías`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('home-hero-surface')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.getByTestId('home-hero-media').locator('img').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.waitForTimeout(250); // Existing photo transition is 180 ms.
    await page.screenshot({path: test.info().outputPath(`home-${width}.png`)});
    await expectFourLabels(page);

    const card = await page.getByTestId('home-hero-surface').boundingBox();
    const media = await page.getByTestId('home-hero-media').boundingBox();
    expect(card).not.toBeNull();
    expect(media).not.toBeNull();
    expect(media!.width / card!.width).toBeGreaterThanOrEqual(0.44);
    expect(media!.width / card!.width).toBeLessThanOrEqual(0.53);
    await expect(page.getByTestId('home-editorial-name')).toBeVisible();
    await expect(page.getByTestId('home-editorial-price')).toBeVisible();

    await page.getByTestId('home-categories-scroll').scrollIntoViewIfNeeded();
    const rail = await page.getByTestId('home-categories-scroll').boundingBox();
    for (const slug of ['tecnologia', 'audio', 'belleza', 'hogar']) {
      const tile = page.getByTestId(`category-${slug}`);
      const box = await tile.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(Math.max(rail!.x, 0) - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(Math.min(rail!.x + rail!.width, width) + 1);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    for (const [name] of destinations) {
      await page.getByTestId(`buyer-tab-${name}`).click();
      await expect(page.getByTestId(`buyer-tab-${name}`)).toHaveAttribute('aria-selected', 'true');
      await expectFourLabels(page);
    }
  });
}

test('la barra fija usa la M y recupera el logo al volver arriba', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('home-hero-surface')).toBeVisible();
  await expect(page.getByTestId('home-editorial-price')).not.toContainText(/Cargando|no disponible/);
  await page.evaluate(() => document.fonts.ready);
  const sticky = page.getByTestId('home-sticky-bar');
  await expect(sticky).toHaveAttribute('aria-hidden', 'true');
  const scroll = page.getByTestId('home-scroll');
  await scroll.hover();
  await page.mouse.wheel(0, 700);
  await expect(sticky).not.toHaveAttribute('aria-hidden', 'true');
  await expect(sticky.getByTestId('brand-symbol')).toBeVisible();
  await page.screenshot({path:test.info().outputPath('home-scrolled-M.png')});
  await expect(sticky.getByTestId('brand-mark')).toHaveCount(0);
  await expect(page.getByTestId('home-search-sticky')).toHaveAttribute('tabindex', '0');
  await scroll.evaluate(node => { node.scrollTop = 0; });
  await expect(sticky).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByTestId('home-masthead').getByTestId('brand-mark')).toBeVisible();
});

test('texto web 1.6 a 360 px no recorta las cuatro etiquetas', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('home-hero-surface')).toBeVisible();
  // Approximation only: this does not change RN useWindowDimensions().fontScale.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[dir="auto"]').forEach(el => {
      const css = getComputedStyle(el);
      el.style.fontSize = `${parseFloat(css.fontSize) * 1.6}px`;
      if (css.lineHeight !== 'normal') el.style.lineHeight = `${parseFloat(css.lineHeight) * 1.6}px`;
    });
  });
  await expectFourLabels(page);
  for (const id of ['home-editorial-name', 'home-editorial-price']) {
    const element = page.getByTestId(id);
    await expect(element).toBeVisible();
    const fits = await element.evaluate((node) => {
      const el = node as HTMLElement;
      return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
    });
    expect(fits).toBe(true);
  }
});

test('section actions align with their headings without shrinking touch targets', async({page})=>{
 await page.goto('/');await expect(page.getByTestId('home-hero-surface')).toBeVisible();
 for(const [title,action] of [['Explora por categoría','Ver todas'],['Productos destacados','Ver todo']]){
  const h=await page.getByRole('heading',{name:title,exact:true}).boundingBox();
  const a=await page.getByRole('link',{name:`${action}: ${title}`,exact:true}).boundingBox();
  expect(Math.abs(h!.y+h!.height/2-a!.y-a!.height/2)).toBeLessThanOrEqual(2);
  expect(a!.height).toBeGreaterThanOrEqual(44);
 }
});
