import type { Locator, Page } from '@playwright/test';

/** These visual checks must never authenticate or write to a remote backend. */
export async function guardLocalVisualRead(page: Page) {
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return route.abort();
    if (['DELETE', 'PATCH', 'PUT'].includes(request.method())) return route.abort();
    if (request.method() === 'POST') {
      const auth = url.pathname === '/auth/v1/token';
      const readRpc = ['/rest/v1/rpc/admin_dashboard', '/rest/v1/rpc/seller_dashboard', '/rest/v1/rpc/push_health'].includes(url.pathname);
      if (!auth && !readRpc) return route.abort();
    }
    return route.continue();
  });
}

/** Effective text contrast for the opaque controls tested here; includes element opacity. */
export async function controlContrast(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    let parent = element.parentElement!;
    while (parent.parentElement && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
    const under = rgb(getComputedStyle(parent).backgroundColor);
    const opacity = Number(style.opacity);
    const blend = (color: number[]) => color.map((value, i) => value * opacity + under[i]! * (1 - opacity));
    const luminance = (color: number[]) => color.map((v) => v / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const foreground = luminance(blend(rgb(style.color)));
    const background = luminance(blend(rgb(style.backgroundColor)));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}
