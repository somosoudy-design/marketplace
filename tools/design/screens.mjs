// Screenshots of the main screens of the web build (pnpm test:ui serves it on 8089) at phone size, for design
// review. Usage: node tools/design/screens.mjs <out-dir> [light|dark]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../tests/app-e2e/package.json', import.meta.url));
const { chromium, devices } = require('@playwright/test');
const out = process.argv[2] ?? 'screens';
const scheme = process.argv[3] ?? 'light';
mkdirSync(out, { recursive: true });

const base = 'http://127.0.0.1:8089';
const executablePath = process.env.PW_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({ ...devices['Pixel 7'], locale: 'es-VE', colorScheme: scheme });

async function shot(name, url, { scroll = 0, wait = 1200, full = false } = {}) {
  if (url) await page.goto(base + url);
  await page.waitForTimeout(wait);
  if (scroll) {
    await page.mouse.move(200, 500);
    await page.mouse.wheel(0, scroll);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
}

await shot('01-home', '/', { wait: 2500 });
await shot('02-home-2', null, { scroll: 900 });
await shot('03-home-3', null, { scroll: 1200 });
await shot('04-explore', '/explore', { wait: 2000 });
await shot('05-product', '/p/ugreen-cable-usb-c-100w', { wait: 2000 });
await shot('06-product-2', null, { scroll: 800 });
await shot('07-store', '/tienda/nova-gadgets', { wait: 2000 });
await shot('08-cart', '/cart', { wait: 1500 });
await shot('09-account', '/account', { wait: 1500 });
await shot('10-sign-in', '/sign-in', { wait: 1200 });
await browser.close();
console.log(`screens in ${out}`);
