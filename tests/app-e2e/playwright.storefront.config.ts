import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './storefront',
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: '../../.local/storefront-20261030/results',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    viewport: { width: 1440, height: 960 },
    locale: 'es-VE',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] }
      : {},
  },
});
