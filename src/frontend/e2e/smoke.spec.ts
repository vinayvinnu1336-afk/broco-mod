import { test, expect } from '@playwright/test';
import { signIn, expectNoHorizontalOverflow, Role } from './helpers';

/**
 * Visits every static page of every portal and checks that it renders real content, does not crash,
 * logs no console errors, shows no dollar amounts and has no sideways scrolling.
 */
const PAGES: Record<Role, string[]> = {
  customer: [
    '/customer/dashboard',
    '/customer/requests',
    '/customer/requests/new',
    '/customer/quotes',
    '/customer/vehicles',
    '/customer/payments',
    '/customer/invoices',
    '/customer/profile',
  ],
  garage: [
    '/garage/dashboard',
    '/garage/requests',
    '/garage/quotes',
    '/garage/jobs',
    '/garage/finance',
    '/garage/profile',
  ],
  advisor: [
    '/advisor/dashboard',
    '/advisor/work-queue',
    '/advisor/requests',
    '/advisor/quotes',
    '/advisor/assignments',
    '/advisor/jobs',
    '/advisor/profile',
  ],
  admin: [
    '/admin/dashboard',
    '/admin/attention',
    '/admin/requests',
    '/admin/quotes',
    '/admin/customer-quotations',
    '/admin/assignments',
    '/admin/jobs',
    '/admin/finance',
    '/admin/payments',
    '/admin/garages',
    '/admin/advisors',
    '/admin/customers',
    '/admin/vehicle-master',
    '/admin/notifications',
    '/admin/system-health',
    '/admin/audit',
    '/admin/settings',
  ],
};

const PUBLIC_PAGES = ['/', '/login', '/register', '/forgot-password'];

const IGNORED_CONSOLE = [/Download the React DevTools/, /\[Fast Refresh\]/, /\[HMR\]/, /favicon/];

for (const path of PUBLIC_PAGES) {
  test(`public ${path} renders cleanly`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED_CONSOLE.some((r) => r.test(m.text()))) errors.push(m.text());
    });

    const res = await page.goto(path);
    expect(res?.status(), `${path} status`).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page, path);
    expect(await page.locator('body').innerText()).not.toMatch(/\$\s?\d/);
    expect(errors, `${path} console errors`).toEqual([]);
  });
}

for (const [role, paths] of Object.entries(PAGES) as [Role, string[]][]) {
  test.describe(`${role} portal`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, role);
    });

    for (const path of paths) {
      test(`${path} renders cleanly`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error' && !IGNORED_CONSOLE.some((r) => r.test(m.text()))) errors.push(m.text());
        });

        await page.goto(path);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await expect(page.getByText(/something went wrong|application error|unhandled runtime error/i)).toHaveCount(0);
        await expectNoHorizontalOverflow(page, path);
        expect(await page.locator('main').innerText(), `${path} shows a dollar amount`).not.toMatch(/\$\s?\d/);
        expect(errors, `${path} console errors`).toEqual([]);
      });
    }
  });
}
