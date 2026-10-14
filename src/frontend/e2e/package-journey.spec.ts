import { test, expect, Page } from '@playwright/test';
import {
  apiContext,
  checkLayout,
  confirmSheet,
  valueOf,
  inr,
  paise,
  phone,
  pickCar,
  pinCarInHyderabad,
  signIn,
  uniqueEmail,
} from './helpers';

/**
 * A fixed-price service package, driven through the UI on a phone-sized screen:
 * visitor checks prices on the home page → signs up → books STANDARD and pays the 10% advance →
 * advisor assigns the garage → garage runs the job to handover and pays BroCo's commission →
 * admin sees the paid commission and the website enquiry.
 *
 * Runs serially; each step uses its own browser context (one per person), like separate phones.
 */
test.describe.configure({ mode: 'serial' });

const CAR = { brand: 'Hyundai', model: 'i20', fuel: 'Petrol' };
const GARAGE = 'Central Metro Motors';
const COMMISSION_RATE = 0.1; // 10% of the service value…
const GST_RATE = 0.18; // …plus 18% GST on the commission

const state: {
  mobile: string;
  email: string;
  password: string;
  modelId?: string;
  /** STANDARD offer for the car, read from GET /service-packages/offers. */
  price?: number;
  advance?: number;
  atGarage?: number;
  requestNumber?: string;
  requestId?: string;
  jobNumber?: string;
} = {
  // A fresh 10-digit Indian mobile each run, so the enquiry is easy to find.
  mobile: `9${String(Date.now()).slice(-9)}`,
  email: uniqueEmail('package'),
  password: 'Package!2026x',
};

const commission = () => {
  const amount = paise(state.price! * COMMISSION_RATE);
  const gst = paise(amount * GST_RATE);
  return { amount, gst, total: paise(amount + gst) };
};

/** "+91 98765 43210", as the admin enquiries list shows a number. */
const displayMobile = (m: string) => `+91 ${m.slice(0, 5)} ${m.slice(5)}`;

/** The last button with this name: on job screens that is the one in the bottom action bar. */
const actionBar = (page: Page, name: RegExp) => page.getByRole('button', { name }).last();

test('1. visitor checks prices, signs up and books the Standard package', async ({ browser }) => {
  const { context, page } = await phone(browser);

  // Home: the card starts empty; choose Hyderabad, pick the car and leave a mobile number.
  await page.goto('/');
  await expect(page.getByLabel('Location')).toHaveValue('');
  await checkLayout(page, 'home');
  await page.getByLabel('Location').selectOption('Hyderabad');
  await page.getByRole('button', { name: 'Select your car' }).click();
  await pickCar(page, CAR);
  await expect(page.getByRole('button', { name: `${CAR.brand} ${CAR.model}, ${CAR.fuel}` })).toBeVisible();
  await page.getByLabel('Mobile number').fill(state.mobile);
  await page.getByRole('button', { name: 'CHECK PRICES FOR FREE' }).click();

  // Packages page for this car.
  await expect(page).toHaveURL(/\/services\/car-service\?model=[^&]+&fuel=Petrol/);
  state.modelId = new URL(page.url()).searchParams.get('model')!;

  // Expected prices come from the API, not from the test.
  const api = await apiContext();
  const offersRes = await api.get(`service-packages/offers?modelId=${state.modelId}&fuelType=${CAR.fuel}`);
  expect(offersRes.ok()).toBeTruthy();
  const offers: { advancePercentage: number; offers: { package: { code: string; name: string }; price: number; advanceAmount: number; payAtGarageAmount: number }[] } =
    (await offersRes.json()).data;
  await api.dispose();
  expect(offers.advancePercentage).toBe(10);
  expect(offers.offers.map((o) => o.package.code)).toEqual(['BASIC', 'STANDARD', 'PREMIUM']);

  for (const offer of offers.offers) {
    const card = page.getByRole('article', { name: offer.package.name });
    await expect(card.getByText(offer.package.code, { exact: true })).toBeVisible();
    await expect(card.getByText(inr(offer.price), { exact: true })).toBeVisible();
    await expect(card).toContainText(`Pay ${inr(offer.advanceAmount)} now · ${inr(offer.payAtGarageAmount)} at the garage`);
    // 10% online, the rest at the garage.
    expect(offer.advanceAmount).toBe(Math.round(offer.price * 0.1));
    expect(offer.advanceAmount + offer.payAtGarageAmount).toBe(offer.price);
  }
  const standard = offers.offers.find((o) => o.package.code === 'STANDARD')!;
  state.price = standard.price;
  state.advance = standard.advanceAmount;
  state.atGarage = standard.payAtGarageAmount;
  await checkLayout(page, 'car service packages');

  // Book now while signed out → sign up first.
  await page.getByRole('article', { name: standard.package.name }).getByRole('button', { name: /Book now/ }).click();
  await expect(page).toHaveURL(/\/register\?next=/);
  await checkLayout(page, 'register');
  await page.getByLabel(/^Full name/).fill('Package Customer');
  await page.getByLabel(/^Email/).fill(state.email);
  await page.getByLabel(/^Mobile number/).fill(`+91 ${state.mobile}`);
  await page.getByLabel(/^Password/).fill(state.password);
  await page.getByRole('button', { name: /Create account/ }).click();

  // Booking (one page): the package and the car are carried over.
  await expect(page).toHaveURL(/\/customer\/requests\/new\?package=STANDARD/);
  await expect(page.getByRole('radio', { name: new RegExp(standard.package.name) })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: new RegExp(`${CAR.brand} ${CAR.model}, ${CAR.fuel}`) })).toBeVisible();
  await expect(valueOf(page, 'Package price')).toHaveText(inr(state.price));
  await checkLayout(page, 'booking: service');
  const payButton = page.getByRole('button', { name: `Pay ${inr(state.advance)} & book` });

  // Your car: add the car (saved when the booking is made).
  await expect(page.getByRole('heading', { name: 'Your car', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add this car' })).toBeVisible();
  await page.getByLabel(/^Registration number/).fill(`TS 09 PK ${Math.floor(1000 + Math.random() * 8999)}`);
  await page.getByLabel(/^Year/).selectOption('2021');
  await page.getByLabel(/^Km driven/).fill('24000');
  await checkLayout(page, 'booking: car');

  // Where is your car: pin the car in Hyderabad and confirm the pin matches the address.
  await pinCarInHyderabad(page, { house: 'Flat 302, Lake View Apartments', area: 'Banjara Hills', pincode: '500034' });
  // Changing the pincode after confirming needs a fresh confirmation.
  await page.getByLabel(/^Pincode/).fill('500033');
  await expect(page.getByText('You changed the address after pinning')).toBeVisible();
  await payButton.click();
  await expect(page.getByRole('alert').filter({ hasText: /confirm your car is still at this pin/ }).first()).toBeVisible();
  await page.getByRole('button', { name: "Yes, it's here" }).click();
  await expect(page.getByText('You confirmed your car is at this pin')).toBeVisible();
  await checkLayout(page, 'booking: location');

  // Pick-up & drop: free pick-up with a note for the driver.
  await page.getByRole('radio', { name: /Yes, pick up my car/ }).click();
  await page.getByLabel(/^Pick-up notes/).fill('Gate 2, call before coming');

  // Check your booking: the price split, then pay 10% and book.
  const review = page.getByRole('region', { name: 'Check your booking' });
  await expect(page.getByRole('heading', { name: 'Check your booking' })).toBeVisible();
  await expect(page.getByText('Pin and address match')).toBeVisible();
  await expect(review.getByText('Yes - Gate 2, call before coming')).toBeVisible();
  await expect(valueOf(page, 'Package price')).toHaveText(inr(state.price));
  await expect(valueOf(page, 'Pay now (10%)')).toHaveText(inr(state.advance));
  await expect(valueOf(page, 'Pay at garage after service')).toHaveText(inr(state.atGarage));
  await checkLayout(page, 'booking: review');
  await payButton.click();

  // Confirmed: the advance is paid, the rest is due at the garage.
  await expect(page.getByRole('heading', { name: 'Booking confirmed!' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`You'll pay the remaining ${inr(state.atGarage)} at the garage`)).toBeVisible();
  await expect(valueOf(page, 'Paid online (10%)')).toHaveText(inr(state.advance));
  await expect(valueOf(page, 'Pay at garage after service')).toHaveText(inr(state.atGarage));
  await expect(valueOf(page, 'Service')).toHaveText(standard.package.name);
  state.requestNumber = (await valueOf(page, 'Booking').innerText()).trim();
  expect(state.requestNumber).toMatch(/^BM-\d+$/);
  const href = await page.getByRole('link', { name: 'View booking' }).getAttribute('href');
  state.requestId = href!.split('/').pop();
  await checkLayout(page, 'booking confirmed');

  // The receipt covers only the advance and says what is left to pay at the garage.
  await page.goto('/customer/invoices');
  await page.getByRole('link', { name: /Booking advance/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Booking advance receipt' })).toBeVisible();
  await expect(valueOf(page, 'Service total')).toHaveText(inr(state.price!, 2));
  await expect(valueOf(page, 'Advance paid to BroCo')).toHaveText(inr(state.advance!, 2));
  await expect(valueOf(page, 'Balance, pay at the garage')).toHaveText(inr(state.atGarage!, 2));
  await checkLayout(page, 'advance receipt');

  await context.close();
});

test('2. advisor assigns Central Metro Motors to the paid booking', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'advisor');

  await page.goto(`/advisor/requests/${state.requestId}`);
  await expect(page.getByText(state.requestNumber!).first()).toBeVisible();
  await expect(valueOf(page, 'Package price').first()).toHaveText(inr(state.price!, 2));
  await expect(valueOf(page, 'BroCo advance (10%)')).toHaveText(inr(state.advance!, 2));
  await expect(valueOf(page, 'Advance status')).toContainText('Paid');
  await expect(valueOf(page, 'Customer pays the garage').first()).toHaveText(inr(state.atGarage!, 2));
  await expect(page.getByRole('heading', { name: 'Assign a garage' })).toBeVisible();
  await checkLayout(page, 'advisor package request');

  await page.getByRole('button', { name: new RegExp(GARAGE) }).click();
  await expect(page.getByRole('heading', { name: `Confirm booking with ${GARAGE}?` })).toBeVisible();
  await checkLayout(page, 'advisor confirm garage sheet');
  await confirmSheet(page, 'Confirm booking');
  await expect(page.getByText(`Booking confirmed with ${GARAGE}`)).toBeVisible();

  await context.close();
});

test('3. garage runs the job to handover and pays the commission', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'garage');

  // Open the new job.
  await page.goto('/garage/jobs');
  await page.getByRole('link', { name: new RegExp(`Request ${state.requestNumber}`) }).click();
  await expect(page).toHaveURL(/\/garage\/jobs\//);
  state.jobNumber = (await page.getByText(/^JOB-\d+$/).first().innerText()).trim();

  // Money: the advance was paid online, the balance is collected at the garage.
  await expect(valueOf(page, 'Service value')).toHaveText(inr(state.price!, 2));
  await expect(valueOf(page, 'Customer pays you at handover')).toHaveText(inr(state.atGarage!, 2));
  await expect(page.getByText(`Customer paid BroCo ${inr(state.advance!, 2)} (10%) online.`)).toBeVisible();
  await checkLayout(page, 'garage job');

  // Schedule: drop-off tomorrow 10:00, ready tomorrow 18:00 (local time).
  await actionBar(page, /^Schedule$/).click();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  await page.getByLabel(/^Drop-off/).fill(`${day}T10:00`);
  await page.getByLabel(/^Ready by/).fill(`${day}T18:00`);
  await confirmSheet(page, 'Save schedule');

  // The advance is paid, so the car can be received.
  await actionBar(page, /^Car received$/).click();
  await page.getByRole('dialog').getByLabel(/^Odometer/).fill('24100');
  await confirmSheet(page, 'Confirm received');
  await actionBar(page, /^Start inspection$/).click();
  await confirmSheet(page, 'Start inspection');
  await actionBar(page, /^Finish inspection$/).click();
  await page.getByRole('dialog').getByLabel(/^Summary for the customer/).fill('Car in good shape. Standard service as booked.');
  await confirmSheet(page, 'Save and finish');
  await actionBar(page, /^Start work$/).click();
  await confirmSheet(page, 'Start work');
  await actionBar(page, /^Work done$/).click();
  await page.getByRole('dialog').getByLabel(/^Note for the customer/).fill('Oil, filters and checks done as per the package.');
  await confirmSheet(page, 'Mark work done');
  await expect(page.getByText(`Collect ${inr(state.atGarage!, 2)} from the customer at handover.`)).toBeVisible();
  await actionBar(page, /^Ready for pickup$/).click();
  await confirmSheet(page, 'Notify customer');

  // Handover: collect the balance; BroCo's commission becomes due.
  await actionBar(page, /^Hand over car$/).click();
  await expect(page.getByRole('dialog')).toContainText(`Collect ${inr(state.atGarage!, 2)} from the customer`);
  await confirmSheet(page, 'Confirm handover');
  const due = commission();
  await expect(page.getByText(/BroCo commission .* is now due/)).toContainText(inr(due.total, 2));
  await checkLayout(page, 'garage job handed over');

  // Pay it from the Commission page.
  await page.getByRole('link', { name: 'Pay commission' }).click();
  await expect(page).toHaveURL(/\/garage\/commission/);
  await checkLayout(page, 'garage commission');
  await page.getByRole('button', { name: new RegExp(state.jobNumber) }).click();
  const sheet = page.getByRole('dialog');
  await expect(valueOf(sheet, 'Service value')).toHaveText(inr(state.price!, 2));
  await expect(valueOf(sheet, 'Advance BroCo collected online')).toHaveText(inr(state.advance!, 2));
  await expect(valueOf(sheet, 'Balance you collected')).toHaveText(inr(state.atGarage!, 2));
  await expect(valueOf(sheet, 'Commission (10% of service value)')).toHaveText(inr(due.amount, 2));
  await expect(valueOf(sheet, 'GST on commission (18%)')).toHaveText(inr(due.gst, 2));
  await expect(valueOf(sheet, 'Total to pay')).toHaveText(inr(due.total, 2));
  await checkLayout(page, 'garage commission sheet');
  await confirmSheet(page, `Pay ${inr(due.total, 2)}`);
  await expect(page.getByRole('status').filter({ hasText: 'Payment received' })).toBeVisible();

  // It now shows as paid.
  await page.getByRole('tab', { name: /^Paid/ }).click();
  await page.getByRole('button', { name: new RegExp(state.jobNumber) }).click();
  await expect(sheet.getByText('Paid', { exact: true })).toBeVisible();
  await expect(valueOf(sheet, 'Total paid')).toHaveText(inr(due.total, 2));

  // Back on the job: close it; the commission is shown as paid.
  await sheet.getByRole('link', { name: `Open job ${state.jobNumber}` }).click();
  await expect(page).toHaveURL(/\/garage\/jobs\//);
  await actionBar(page, /^Close job$/).click();
  await confirmSheet(page, 'Close job');
  await expect(page.getByText('This job is finished. Nothing more to do.')).toBeVisible();
  await expect(page.getByText(`BroCo commission ${inr(due.total, 2)} paid`)).toBeVisible();

  await context.close();
});

test('4. admin sees the paid commission and the website enquiry', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await signIn(page, 'admin');
  const due = commission();

  // Commission: paid, 10% + 18% GST of the package price.
  await page.goto('/admin/commissions');
  await page.getByRole('tab', { name: /^Paid/ }).click();
  await page.getByRole('button', { name: new RegExp(state.jobNumber!) }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Paid', { exact: true })).toBeVisible();
  await expect(valueOf(sheet, 'Request')).toHaveText(state.requestNumber!);
  await expect(valueOf(sheet, 'Service value')).toHaveText(inr(state.price!, 2));
  await expect(valueOf(sheet, 'Commission (10%)')).toHaveText(inr(due.amount, 2));
  await expect(valueOf(sheet, 'GST on commission (18%)')).toHaveText(inr(due.gst, 2));
  await expect(valueOf(sheet, 'Total due from garage')).toHaveText(inr(due.total, 2));
  await checkLayout(page, 'admin commission sheet');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toBeHidden();
  await checkLayout(page, 'admin commissions');

  // Enquiry left on the home page: new, with the car.
  await page.goto('/admin/leads');
  const lead = page.getByRole('button', { name: displayMobile(state.mobile) });
  await expect(lead).toBeVisible();
  await expect(lead).toContainText(`${CAR.brand} ${CAR.model}`);
  await expect(lead).toContainText('New');
  await checkLayout(page, 'admin leads');

  await context.close();
});
