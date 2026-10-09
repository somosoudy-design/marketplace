import { defineConfig, devices } from '@playwright/test';

// UI tests against the local stack (pnpm stack:start):
//   app   -> the exported web build of the Expo app (phone viewport)
//   panel -> the Next.js admin and seller panel (desktop viewport)
const executablePath = process.env.PW_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    locale: 'es-VE',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'app', testDir: './tests', use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:8089' } },
    { name: 'panel', testDir: './panel', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 }, baseURL: 'http://127.0.0.1:3100' } },
  ],
  webServer: [
    { command: 'node serve.mjs', url: 'http://127.0.0.1:8089', reuseExistingServer: true },
    { command: 'pnpm --filter @kora/admin dev', url: 'http://127.0.0.1:3100/login', reuseExistingServer: true, timeout: 120_000 },
  ],
});
