import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. They drive the real Next.js app against the real API and database.
 *
 *   E2E_BASE_URL  frontend under test   (default http://localhost:3005)
 *   E2E_API_URL   API for test setup    (default http://localhost:5000/api/v1)
 *   E2E_CHANNEL   installed browser     (default msedge; use "chrome" or leave empty for bundled chromium)
 *
 * Run:  npx playwright test            (all)
 *       npx playwright test --project=mobile
 */
const channel = process.env.E2E_CHANNEL ?? 'msedge';

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
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel: channel || undefined },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 }, channel: channel || undefined },
      testMatch: /.*\.desktop\.spec\.ts|smoke\.spec\.ts/,
    },
  ],
});
