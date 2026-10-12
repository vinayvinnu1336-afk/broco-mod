import { APIRequestContext, Browser, BrowserContext, Locator, Page, devices, expect, request } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000/api/v1';

export const DEMO = {
  customer: { email: 'customer@brocomod.com', password: 'Password123!' },
  garage: { email: 'garage.owner@centralmetro.com', password: 'Password123!' },
  advisor: { email: 'advisor@brocomod.com', password: 'Password123!' },
  admin: { email: 'admin@brocomod.com', password: 'Password123!' },
} as const;

export type Role = keyof typeof DEMO;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; roles: string[]; permissions: string[] };
}

export async function apiContext(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL.endsWith('/') ? API_URL : `${API_URL}/`,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiLogin(email: string, password: string): Promise<Session> {
  const api = await apiContext();
  const res = await api.post('auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email}: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  await api.dispose();
  return body.data as Session;
}

/** Signs a page in by seeding the same localStorage keys the app's AuthContext uses. */
export async function signIn(page: Page, who: Role | Session) {
  const session = typeof who === 'string' ? await apiLogin(DEMO[who].email, DEMO[who].password) : who;
  await page.goto('/login');
  await page.evaluate((s) => {
    localStorage.setItem('broco_access_token', s.accessToken);
    localStorage.setItem('broco_refresh_token', s.refreshToken);
    localStorage.setItem('broco_user', JSON.stringify(s.user));
  }, session);
  return session;
}

/** Fails if the page can be scrolled sideways (the most common mobile layout bug). */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth, `${label}: page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

/**
 * Fails if visible text or a form control sticks out past the right edge of the screen. This catches
 * content clipped by an `overflow-hidden` parent, which the page-width check above can't see.
 * Things inside sideways-scrollable strips (tables, chip rows) are allowed to extend.
 */
export async function expectNothingClipped(page: Page, label: string) {
  const clipped = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsSideways = (el: Element | null): boolean => {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    const found: string[] = [];
    document.querySelectorAll('h1,h2,h3,p,label,button,a,input,select,textarea,li,span').forEach((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) return;
      if (r.right > vw + 1 && r.left < vw && !scrollsSideways(el)) {
        found.push(`${el.tagName.toLowerCase()} "${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 40)}" ends at ${Math.round(r.right)}px`);
      }
    });
    return { vw, found: found.slice(0, 5) };
  });
  expect(clipped.found, `${label}: content wider than the ${clipped.vw}px screen`).toEqual([]);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.brocomod.com`;
}

// ---------------------------------------------------------------------------------------------
// Shared steps for the serial journeys (package-journey, quote-journey).

/** The pin the journeys book from: Banjara Hills, Hyderabad — where the demo garage is. */
export const BANJARA_HILLS = { latitude: 17.4126, longitude: 78.4482 };

/** A fresh phone-sized browser context per person (like separate phones), located in Banjara Hills. */
export async function phone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    geolocation: BANJARA_HILLS,
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  return { context, page };
}

/** Clicks `button` in the open bottom sheet and waits for the sheet to close. */
export async function confirmSheet(page: Page, button: string | RegExp) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const primary = dialog.getByRole('button', { name: button });
  await expect(primary).toBeEnabled();
  await primary.click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** No sideways scrolling and nothing cut off at the right edge. */
export async function checkLayout(page: Page, label: string) {
  await expectNoHorizontalOverflow(page, label);
  await expectNothingClipped(page, label);
}

/** ₹3,499 (whole rupees) or ₹3,499.00 — the same formatting the app uses. */
export function inr(amount: number, decimals: 0 | 2 = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(decimals === 0 ? Math.round(amount) : amount);
}

/** Rounds to paise. */
export function paise(amount: number) {
  return Math.round(amount * 100) / 100;
}

/** The value shown right after a label, e.g. the <dd> after a <dt>, in summary rows. */
export function valueOf(scope: Page | Locator, label: string) {
  return scope.getByText(label, { exact: true }).locator('xpath=following-sibling::*[1]');
}

/** Picks brand → model → fuel in the CarPicker bottom sheet that is already open. */
export async function pickCar(page: Page, car: { brand: string; model: string; fuel: string }) {
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Select your car brand' })).toBeVisible();
  // Popular brands come first, as a logo grid.
  await sheet.getByRole('button', { name: car.brand }).first().click();
  await expect(sheet.getByRole('heading', { name: `Select your ${car.brand} model` })).toBeVisible();
  await sheet.getByPlaceholder(/Search model/).fill(car.model);
  await sheet.getByRole('button').filter({ has: page.getByText(car.model, { exact: true }) }).click();
  await expect(sheet.getByRole('heading', { name: `Fuel type of your ${car.model}` })).toBeVisible();
  await sheet.getByRole('button', { name: car.fuel }).click();
  await expect(sheet).toBeHidden();
}

/** Booking step 3 without a Maps key: GPS pin + typed address, then "Is your car at this pin?". */
export async function pinCarInHyderabad(page: Page, address: { house: string; area: string; pincode: string }) {
  await expect(page.getByRole('heading', { name: 'Where is your car?' })).toBeVisible();
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.getByText('Location pinned')).toBeVisible();
  await page.getByLabel(/^House \/ flat \/ building/).fill(address.house);
  await page.getByLabel(/^Area \/ locality/).fill(address.area);
  await page.getByLabel(/^Pincode/).fill(address.pincode);
  await expect(page.getByText('Is your car at this pin?')).toBeVisible();
  await page.getByRole('button', { name: "Yes, it's here" }).click();
  await expect(page.getByText('You confirmed your car is at this pin')).toBeVisible();
}
