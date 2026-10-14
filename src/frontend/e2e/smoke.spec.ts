import { test, expect, Page } from '@playwright/test';
import { signIn, expectNoHorizontalOverflow, expectNothingClipped, apiContext, pickCar, Role } from './helpers';

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
    '/garage/commission',
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
    '/admin/packages',
    '/admin/commissions',
    '/admin/leads',
    '/admin/notifications',
    '/admin/system-health',
    '/admin/audit',
    '/admin/settings',
  ],
};

const PUBLIC_PAGES = ['/', '/services', '/services/car-service', '/track', '/login', '/register', '/register/garage', '/forgot-password'];

const IGNORED_CONSOLE = [/Download the React DevTools/, /\[Fast Refresh\]/, /\[HMR\]/, /favicon/];

/** Toyota's longest model name (with a fuel choice, so the picker asks for it). */
async function longNamedCar() {
  const api = await apiContext();
  const makes = (await (await api.get('vehicle-manufacturers')).json()).data as { id: string; name: string }[];
  const toyota = makes.find((m) => m.name === 'Toyota')!;
  const models = (await (await api.get(`vehicle-manufacturers/${toyota.id}/models`)).json()).data as { id: string; name: string; fuels: string[] }[];
  const longest = models.filter((m) => m.fuels.length > 1).reduce((a, b) => (b.name.length > a.name.length ? b : a));
  await api.dispose();
  return { brandId: toyota.id, brand: toyota.name, modelId: longest.id, model: longest.name, fuel: longest.fuels[0] };
}

/** A car with a long name, picked on the public site, must not push the booking card off a small screen. */
async function rememberLongCarName(page: Page) {
  const car = await longNamedCar();
  await page.addInitScript((intent) => localStorage.setItem('broco_booking_intent', JSON.stringify(intent)), {
    city: 'Hyderabad', manufacturerId: car.brandId, manufacturerName: car.brand, modelId: car.modelId, modelName: car.model, fuelType: car.fuel,
  });
}

for (const path of PUBLIC_PAGES) {
  test(`public ${path} renders cleanly`, async ({ page }) => {
    await rememberLongCarName(page);
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
    await expectNothingClipped(page, path);
    expect(await page.locator('body').innerText()).not.toMatch(/\$\s?\d/);
    expect(errors, `${path} console errors`).toEqual([]);
  });
}

// The home page drops a car remembered from before the load, so pick the long name by hand there.
test('public / fits a long car name and forgets the pick on refresh', async ({ page }) => {
  const car = await longNamedCar();
  await page.goto('/');
  await page.getByLabel('Location').selectOption('Hyderabad');
  await page.getByRole('button', { name: 'Select your car' }).click();
  await pickCar(page, car);
  await expect(page.getByRole('button', { name: `${car.brand} ${car.model}, ${car.fuel}` })).toBeVisible();
  await page.getByLabel('Mobile number').fill('9876543210');
  await expectNoHorizontalOverflow(page, '/ with a long car name');
  await expectNothingClipped(page, '/ with a long car name');

  // The server-rendered card is always empty, so first wait for the page to drop the saved pick.
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('broco_booking_intent'))).toBeNull();
  await expect(page.getByLabel('Location')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Select your car' })).toBeVisible();
  await expect(page.getByLabel('Mobile number')).toHaveValue('');
  await expect(page.getByText(car.model)).toHaveCount(0);
});

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
    await expectNothingClipped(page, path);
        expect(await page.locator('main').innerText(), `${path} shows a dollar amount`).not.toMatch(/\$\s?\d/);
        expect(errors, `${path} console errors`).toEqual([]);
      });
    }
  });
}
