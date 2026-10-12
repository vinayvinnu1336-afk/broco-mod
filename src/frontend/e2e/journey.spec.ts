import { test, expect, Page, Browser, BrowserContext, devices } from '@playwright/test';
import { apiContext, apiLogin, signIn, uniqueEmail, expectNoHorizontalOverflow, DEMO } from './helpers';

/**
 * The whole marketplace, driven through the UI on a phone-sized screen:
 * customer signs up → adds a car → books → garage quotes → advisor assigns and sends a quotation →
 * customer accepts and pays → garage runs the job to handover → admin sees the garage payout.
 *
 * Runs serially; each step uses its own browser context (one per person), like separate phones.
 */
test.describe.configure({ mode: 'serial' });

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };
const PHONE = devices['Pixel 7'];

const state: {
  customerEmail: string;
  customerPassword: string;
  requestNumber?: string;
  requestId?: string;
  quotationId?: string;
} = {
  customerEmail: uniqueEmail('journey'),
  customerPassword: 'Journey!2026x',
};

async function phone(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    ...PHONE,
    geolocation: BENGALURU,
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  return { context, page };
}

/** Clicks the primary (last) button in the open bottom sheet. */
async function confirmSheet(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const primary = dialog
    .getByRole('button')
    .filter({ hasNotText: /^(Back|Cancel|Not yet|Close)$/ })
    .and(page.locator(':not([aria-label="Close dialog"])'))
    .last();
  await expect(primary).toBeEnabled();
  await primary.click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

test('1. customer signs up, adds a car and books a service', async ({ browser }) => {
  const { context, page } = await phone(browser);

  await page.goto('/register');
  await page.getByLabel(/^Full name/).fill('Journey Customer');
  await page.getByLabel(/^Email/).fill(state.customerEmail);
  await page.getByLabel(/Mobile number/).fill('+91 90000 54321');
  await page.locator('input[type=password]').fill(state.customerPassword);
  await page.getByRole('button', { name: /Create account/ }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  await expectNoHorizontalOverflow(page, 'new customer dashboard');

  // Add a car
  await page.goto('/customer/vehicles');
  await page.getByRole('button', { name: /Add your vehicle|Add vehicle/ }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(/^Make/).selectOption({ index: 1 });
  await expect(sheet.getByLabel(/^Model/).locator('option')).not.toHaveCount(1);
  await sheet.getByLabel(/^Model/).selectOption({ index: 1 });
  await sheet.getByLabel(/^Year/).selectOption('2022');
  await sheet.getByLabel(/^Number plate/).fill(`KA 05 JR ${Math.floor(1000 + Math.random() * 8999)}`);
  await sheet.getByLabel(/^Odometer/).fill('21000');
  await confirmSheet(page);
  await expect(page.getByText('Primary')).toBeVisible();

  // Book
  await page.goto('/customer/requests/new');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Use my current location/ }).click();
  await expect(page.getByText(/Location pinned|Pinned to your location/).first()).toBeVisible();
  await page.getByLabel(/^Address/).fill('12 Residency Road');
  await page.getByLabel(/^City/).fill('Bengaluru');
  await page.getByLabel(/^State/).fill('Karnataka');
  await page.getByLabel(/^Pincode/).fill('560025');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByText('Brakes & Suspension', { exact: true }).click();
  await page.getByLabel(/^Describe the problem/).fill('Brakes squeal and the pedal feels soft.');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Check and send')).toBeVisible();
  await page.getByRole('button', { name: /Send request/ }).click();

  await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible();
  const number = await page.getByText(/^BM-\d+$/).first().innerText();
  state.requestNumber = number.trim();

  const session = await apiLogin(state.customerEmail, state.customerPassword);
  const api = await apiContext(session.accessToken);
  const list = await (await api.get('customer/requests?page=1&pageSize=20')).json();
  const items = Array.isArray(list.data) ? list.data : list.data.items;
  state.requestId = items.find((r: { requestNumber: string }) => r.requestNumber === state.requestNumber).id;
  await api.dispose();

  await context.close();
});

test('2. garage quotes for the request', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');

  await page.goto('/garage/requests');
  const card = page.locator('article', { hasText: state.requestNumber! });
  await expect(card).toBeVisible();
  await expectNoHorizontalOverflow(page, 'garage requests');
  await card.getByRole('button', { name: /Create quote/ }).click();
  await expect(page).toHaveURL(/\/garage\/quotes\/new/);

  await page.getByRole('radio', { name: 'Part' }).first().click();
  await page.getByLabel(/^Description/).first().fill('Front brake pads (OEM)');
  await page.getByLabel(/^Unit price/).first().fill('2800');
  await page.getByRole('button', { name: /Add item|Add another|Add line/ }).click();
  await page.getByLabel(/^Description/).nth(1).fill('Brake service labour');
  await page.getByLabel(/^Unit price/).nth(1).fill('900');
  // (2800 + 900) + 18% GST
  await expect(page.getByText('₹4,366.00').first()).toBeVisible();
  await expectNoHorizontalOverflow(page, 'quote builder');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Quote submitted')).toBeVisible();

  await context.close();
});

test('3. advisor assigns the garage and sends the customer quotation', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'advisor');

  await page.goto('/advisor/dashboard');
  await expect(page.getByText(state.requestNumber!).first()).toBeVisible();

  await page.goto(`/advisor/requests/${state.requestId}`);
  await page.getByRole('button', { name: /Assign this garage/ }).first().click();
  await confirmSheet(page);
  await expect(page.getByText(/assigned/i).first()).toBeVisible();
  await expect(page.getByText('₹4,366').first()).toBeVisible();

  await page.getByRole('link', { name: /Customer quotation/ }).click();
  await page.getByLabel(/Scope summary/).fill('Front brake pads and brake service');
  await page.getByRole('button', { name: /Save draft/ }).click();
  await expect(page.getByText(/Draft CQ-\d+ created/)).toBeVisible();
  await expectNoHorizontalOverflow(page, 'quotation builder');
  await page.getByRole('button', { name: /^Send$/ }).click();
  await confirmSheet(page);
  await expect(page.getByText('Quotation sent').first()).toBeVisible();

  await context.close();
});

test('4. customer accepts and pays', async ({ browser }) => {
  const { context, page } = await phone(browser);
  const session = await apiLogin(state.customerEmail, state.customerPassword);
  await signIn(page, session);

  await page.goto('/customer/dashboard');
  await expect(page.getByText('Your quote is ready').first()).toBeVisible();
  await page.getByRole('link', { name: /Review quote/ }).first().click();
  await expect(page).toHaveURL(/\/customer\/quotes\//);
  const quoteUrl = page.url();
  await expectNoHorizontalOverflow(page, 'customer quote');

  await page.getByRole('button', { name: /^Accept$/ }).click();
  await confirmSheet(page);
  await expect(page.getByText('Booking confirmed').first()).toBeVisible();

  await page.getByRole('button', { name: /Pay now/ }).click();
  await expect(page.getByText('Payment received').first()).toBeVisible();
  expect(page.url(), 'stays on the quote after paying').toBe(quoteUrl);
  await expect(page.getByRole('button', { name: /Pay now/ })).toHaveCount(0);

  // Reloading must not offer to pay again.
  await page.reload();
  await expect(page.getByText('Payment received').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay now/ })).toHaveCount(0);

  await page.goto('/customer/invoices');
  await expect(page.getByText(/INV-\d+/).first()).toBeVisible();

  await context.close();
});

test('5. garage runs the job from schedule to close', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');

  await page.goto('/garage/jobs');
  await page.getByText(`Request ${state.requestNumber}`).click();
  await expect(page).toHaveURL(/\/garage\/jobs\//);
  await expectNoHorizontalOverflow(page, 'job detail');

  const actionBar = (name: RegExp) => page.getByRole('button', { name }).last();

  // Schedule: drop-off tomorrow 10:00, ready tomorrow 18:00 (local time)
  await actionBar(/^Schedule$/).click();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  await page.locator('#schedule-start').fill(`${day}T10:00`);
  await page.locator('#schedule-ready').fill(`${day}T18:00`);
  await confirmSheet(page);

  for (const step of [/^Car received$/, /^Start inspection$/, /^Finish inspection$/, /^Start work$/]) {
    await actionBar(step).click();
    await confirmSheet(page);
  }

  await actionBar(/^Work done$/).click();
  await page.getByRole('dialog').getByLabel(/Note for the customer/).fill('Pads replaced, brakes bled, road tested.');
  await confirmSheet(page);

  for (const step of [/^Ready for pickup$/, /^Hand over car$/, /^Close job$/]) {
    await actionBar(step).click();
    await confirmSheet(page);
  }

  await expect(page.getByText('Closed').first()).toBeVisible();
  await context.close();
});

test('6. admin sees the settlement based on the garage quote', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'admin');

  await page.goto('/admin/finance');
  await expectNoHorizontalOverflow(page, 'admin finance');
  // Garage quote ₹4,366 − 10% fee (₹436.60) − 18% GST on fee (₹78.59) = ₹3,850.81
  await expect(page.getByText(/₹3,85(0\.81|1)(?![\d.])/).locator('visible=true').first()).toBeVisible();

  // Customer sees their request completed
  const customerCtx = await phone(browser);
  await signIn(customerCtx.page, await apiLogin(state.customerEmail, state.customerPassword));
  await customerCtx.page.goto(`/customer/requests/${state.requestId}`);
  await expect(customerCtx.page.getByText(/Handed over|Closed|Completed/).first()).toBeVisible();
  await customerCtx.context.close();

  await context.close();
});

// Demo accounts must exist for this suite.
test.beforeAll(async () => {
  await apiLogin(DEMO.garage.email, DEMO.garage.password);
});
