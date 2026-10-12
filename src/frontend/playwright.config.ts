import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. They drive the real Next.js app against the real API and database.
 *
 *   E2E_BASE_URL  frontend under test   (default http://localhost:3005)
 *   E2E_API_URL   API for test setup    (default http://localhost:5000/api/v1)
 *   E2E_CHANNEL   installed browser     (default chrome; "msedge" also works, empty = bundled chromium)
 *
 * Run:  npx playwright test            (all)
 *       npx playwright test --project=mobile
 */
const channel = process.env.E2E_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3005',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel: channel || undefined,
    // Edge/Chrome 132+ removed the old headless mode Playwright 1.48 asks for; the last --headless flag wins.
    launchOptions: channel ? { args: ['--headless=new'] } : undefined,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: channel || undefined },
    },
    {
      // 360px-wide Android phones are the most common screen size in India.
      name: 'small-phone',
      use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 }, channel: channel || undefined },
      testMatch: /smoke.spec.ts/,
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 }, channel: channel || undefined },
      testMatch: /.*\.desktop\.spec\.ts|smoke\.spec\.ts/,
    },
  ],
});
