import { test, expect, Page } from '@playwright/test';
import {
  checkLayout,
  confirmSheet,
  inr,
  paise,
  phone,
  pickCar,
  pinCarInHyderabad,
  signIn,
  apiLogin,
  uniqueEmail,
  valueOf,
} from './helpers';

/**
 * A quote-based repair, driven through the UI on a phone-sized screen:
 * customer signs up and asks for AC repair in Hyderabad → garage quotes → advisor assigns the garage and
 * sends the customer quotation built from the garage's items (no markup) → customer accepts →
 * the garage can't receive the car until the customer pays the 10% advance → customer pays → garage receives it.
 *
 * Runs serially; each step uses its own browser context (one per person), like separate phones.
 */
test.describe.configure({ mode: 'serial' });

const CAR = { brand: 'Maruti Suzuki', model: 'Swift', fuel: 'Petrol' };
const SERVICE = 'AC Service & Repair';
const GARAGE = 'Central Metro Motors';
// Garage quote: two lines at 18% GST.
const ITEMS = [
  { type: 'Part', description: 'AC gas refill (R134a)', price: 1800 },
  { type: 'Labour', description: 'AC service and leak test', price: 1200 },
];
const QUOTE_TOTAL = paise(ITEMS.reduce((sum, i) => sum + i.price, 0) * 1.18);
const ADVANCE = Math.round(QUOTE_TOTAL * 0.1);

const state: {
  email: string;
  password: string;
  requestNumber?: string;
  requestId?: string;
  quoteUrl?: string;
} = {
  email: uniqueEmail('quote'),
  password: 'Quote!2026x',
};

/** The last button with this name: on job screens that is the one in the bottom action bar. */
const actionBar = (page: Page, name: RegExp) => page.getByRole('button', { name }).last();

async function signInCustomer(page: Page) {
  await signIn(page, await apiLogin(state.email, state.password));
}

/** Opens the garage's job for this request. */
async function openGarageJob(page: Page) {
  await page.goto('/garage/jobs');
  await page.getByRole('link', { name: `Request ${state.requestNumber}` }).click();
  await expect(page).toHaveURL(/\/garage\/jobs\//);
}

test('1. customer signs up and asks for an AC repair quote', async ({ browser }) => {
  const { context, page } = await phone(browser);

  // Sign up.
  await page.goto('/register');
  await page.getByLabel(/^Full name/).fill('Quote Customer');
  await page.getByLabel(/^Email/).fill(state.email);
  await page.getByLabel(/^Mobile number/).fill('+91 90000 65432');
  await page.getByLabel(/^Password/).fill(state.password);
  await page.getByRole('button', { name: /Create account/ }).click();
  await expect(page).toHaveURL(/\/customer\/dashboard/);
  await checkLayout(page, 'new customer dashboard');

  // Booking (one page). Service: other services → AC, describe the problem.
  await page.goto('/customer/requests/new');
  await page.getByRole('tab', { name: 'Other services' }).click();
  await page.getByRole('checkbox', { name: SERVICE }).click();
  await page.getByLabel(/^Describe the problem/).fill('AC blows warm air and makes a rattling noise when switched on.');
  await checkLayout(page, 'booking: other services');

  // Your car: add the car (saved when the request is sent).
  await expect(page.getByRole('heading', { name: 'Add your car' })).toBeVisible();
  await page.getByRole('button', { name: 'Select your car' }).click();
  await pickCar(page, CAR);
  await page.getByLabel(/^Registration number/).fill(`TS 07 QT ${Math.floor(1000 + Math.random() * 8999)}`);
  await page.getByLabel(/^Year/).selectOption('2020');

  // Where is your car: pin the car in Hyderabad.
  await pinCarInHyderabad(page, { house: '8-2-293, Road No. 12', area: 'Banjara Hills', pincode: '500034' });

  // Pick-up & drop: the customer drives in.
  await page.getByRole('radio', { name: /No, I'll drive to the garage/ }).click();

  // Check your booking: nothing to pay yet; garages will quote.
  const review = page.getByRole('region', { name: 'Check your booking' });
  await expect(page.getByRole('heading', { name: 'Check your booking' })).toBeVisible();
  await expect(page.getByText('Nothing to pay now')).toBeVisible();
  await expect(review.getByText(SERVICE, { exact: true })).toBeVisible();
  await expect(review.getByText("No, I'll drive to the garage")).toBeVisible();
  await checkLayout(page, 'booking: review (quote)');
  await page.getByRole('button', { name: 'Get quotes from garages' }).click();

  await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible({ timeout: 20_000 });
  state.requestNumber = (await valueOf(page, 'Booking').innerText()).trim();
  expect(state.requestNumber).toMatch(/^BM-\d+$/);
  const href = await page.getByRole('link', { name: 'Track this request' }).getAttribute('href');
  state.requestId = href!.split('/').pop();
  await checkLayout(page, 'request sent');

  await context.close();
});

test('2. garage sends a quote', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');

  await page.goto('/garage/requests');
  const card = page.getByRole('article').filter({ hasText: state.requestNumber! });
  await expect(card).toBeVisible();
  await checkLayout(page, 'garage requests');
  await card.getByRole('button', { name: /Create quote/ }).click();
  await expect(page).toHaveURL(/\/garage\/quotes\/new/);

  for (const [i, item] of Array.from(ITEMS.entries())) {
    if (i > 0) await page.getByRole('button', { name: 'Add item' }).click();
    await page.getByRole('radiogroup', { name: `Item ${i + 1} type` }).getByRole('radio', { name: item.type }).click();
    await page.getByLabel(/^Description/).nth(i).fill(item.description);
    await page.getByLabel(/^Unit price/).nth(i).fill(String(item.price));
  }
  await expect(page.getByText(inr(QUOTE_TOTAL, 2)).first()).toBeVisible();
  await checkLayout(page, 'garage quote builder');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Quote submitted' })).toBeVisible();

  await context.close();
});

test('3. advisor assigns the garage and sends the quotation built from its items', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'advisor');

  // Assign the garage that quoted.
  await page.goto(`/advisor/requests/${state.requestId}`);
  await expect(page.getByRole('heading', { name: GARAGE })).toBeVisible();
  await expect(page.getByText(inr(QUOTE_TOTAL, 2)).first()).toBeVisible();
  await checkLayout(page, 'advisor quote comparison');
  await page.getByRole('button', { name: 'Assign this garage' }).click();
  await confirmSheet(page, 'Assign garage');
  await expect(page.getByText(`Assigned to ${GARAGE}`)).toBeVisible();

  // Customer quotation: starts from the garage's own lines at the garage's prices.
  await page.getByRole('link', { name: /Customer quotation/ }).click();
  await expect(page.getByRole('heading', { name: 'Customer quotation' })).toBeVisible();
  for (const [i, item] of Array.from(ITEMS.entries())) {
    await expect(page.getByLabel(/^Description/).nth(i)).toHaveValue(item.description);
    await expect(page.getByLabel(/^Customer price/).nth(i)).toHaveValue(String(item.price));
  }
  await expect(valueOf(page, 'Difference')).toHaveText('Matches');
  await page.getByLabel(/^Scope summary/).fill('AC gas refill and service with leak test');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Draft CQ-\d+ created/ })).toBeVisible();
  await checkLayout(page, 'customer quotation builder');

  // A markup is not allowed: Send is disabled until the totals match the garage quote again.
  await page.getByLabel(/^Customer price/).first().fill(String(ITEMS[0].price + 200));
  await expect(page.getByRole('alert').filter({ hasText: /doesn't add a markup/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Use garage quote items' }).click();
  await confirmSheet(page, 'Use garage items');
  await expect(valueOf(page, 'Difference')).toHaveText('Matches');
  await expect(valueOf(page, 'Customer pays')).toHaveText(inr(QUOTE_TOTAL, 2));

  // Send it.
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(inr(QUOTE_TOTAL, 2));
  await confirmSheet(page, 'Send to customer');
  await expect(page.getByRole('status').filter({ hasText: 'Quotation sent' })).toBeVisible();

  await context.close();
});

test('4. customer accepts the quote', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signInCustomer(page);

  await page.goto('/customer/dashboard');
  await expect(page.getByText('Your quote is ready').first()).toBeVisible();
  await page.getByRole('link', { name: /Review quote/ }).first().click();
  await expect(page).toHaveURL(/\/customer\/quotes\//);
  state.quoteUrl = page.url();

  // Nothing is payable before accepting: 10% online after accepting, the rest at the garage.
  // The split is shown in whole rupees.
  await expect(valueOf(page, 'Quote total')).toHaveText(inr(QUOTE_TOTAL));
  await expect(valueOf(page, 'Online after you accept (10%)')).toHaveText(inr(ADVANCE));
  await expect(valueOf(page, 'Pay at garage after service')).toHaveText(inr(QUOTE_TOTAL - ADVANCE));
  for (const item of ITEMS) await expect(page.getByText(item.description).first()).toBeVisible();
  await checkLayout(page, 'customer quote');
  await expect(page.getByRole('button', { name: /^Pay / })).toHaveCount(0);

  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await checkLayout(page, 'accept quote sheet');
  await confirmSheet(page, 'Accept and book');
  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  // Not paid yet: the pay bar asks for the 10% advance.
  await expect(page.getByRole('button', { name: `Pay ${inr(ADVANCE, 2)}` })).toBeVisible();

  await context.close();
});

test('5. garage cannot receive the car before the advance is paid', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');
  await openGarageJob(page);

  await expect(page.getByText('Waiting for the customer’s 10% advance. You can’t receive the car until it’s paid.')).toBeVisible();

  // Scheduling is allowed…
  await actionBar(page, /^Schedule$/).click();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  await page.getByLabel(/^Drop-off/).fill(`${day}T10:00`);
  await page.getByLabel(/^Ready by/).fill(`${day}T18:00`);
  await confirmSheet(page, 'Save schedule');

  // …but receiving the car is not.
  await expect(actionBar(page, /^Car received$/)).toBeDisabled();
  await expect(page.getByText(/Waiting for the customer to pay the 10% BroCo booking advance/)).toBeVisible();
  await checkLayout(page, 'garage job awaiting advance');

  await context.close();
});

test('6. customer pays the 10% advance', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signInCustomer(page);

  await page.goto(state.quoteUrl!);
  await page.getByRole('button', { name: `Pay ${inr(ADVANCE, 2)}` }).click();
  await expect(page.getByRole('heading', { name: 'Booking advance received' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`${inr(ADVANCE, 2)} paid online. Pay the remaining ${inr(QUOTE_TOTAL - ADVANCE, 2)}`)).toBeVisible();
  await expect(valueOf(page, 'Paid online (10%)')).toHaveText(inr(ADVANCE));

  // Reloading must not offer to pay again.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Booking advance received' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pay ₹/ })).toHaveCount(0);
  await checkLayout(page, 'customer quote paid');

  await context.close();
});

test('7. garage can now receive the car', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');
  await openGarageJob(page);

  await expect(page.getByText(`Customer paid BroCo ${inr(ADVANCE, 2)} (10%) online.`)).toBeVisible();
  await expect(valueOf(page, 'Customer pays you at handover')).toHaveText(inr(QUOTE_TOTAL - ADVANCE, 2));
  await actionBar(page, /^Car received$/).click();
  await page.getByRole('dialog').getByLabel(/^Odometer/).fill('41200');
  await confirmSheet(page, 'Confirm received');
  await expect(page.getByText('Car received', { exact: true }).first()).toBeVisible();
  await expect(actionBar(page, /^Start inspection$/)).toBeEnabled();
  await checkLayout(page, 'garage job car received');

  await context.close();
});
