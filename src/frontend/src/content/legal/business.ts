import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP } from '@/lib/site';

/** Owner's contact address; also used for grievances and privacy requests. */
const OWNER_EMAIL = 'support@brocomob.com';

/**
 * Business details used by the legal pages and /contact. This is the ONE place to fill them in.
 * Anything left empty is simply left off the pages (the line that would show it is omitted).
 * Support phone, email and WhatsApp come from NEXT_PUBLIC_SUPPORT_* (see src/lib/site.ts) when set.
 */
export const BUSINESS = {
  legalName: 'BRO Co Mobility Solutions',
  /** Shown after the name on /contact. */
  businessType: 'Proprietorship',
  website: 'https://brocomob.com',

  supportEmail: SUPPORT_EMAIL || OWNER_EMAIL,
  supportPhone: SUPPORT_PHONE,
  /** Digits only, with country code, e.g. 919000000000. */
  supportWhatsapp: SUPPORT_WHATSAPP,
  /** e.g. "Mon–Sat, 9 am – 7 pm". */
  supportHours: '',

  /** Registered or principal business address. */
  address: 'Hyderabad, Telangana, India',

  grievanceOfficerName: '',
  grievanceOfficerDesignation: '',
  grievanceEmail: OWNER_EMAIL,

  /** Where privacy requests go (Privacy Policy section 10). */
  privacyEmail: OWNER_EMAIL,

  /** Effective date of the Customer Terms, Cancellation & Refund Policy and Privacy Policy, e.g. "1 November 2026". */
  customerPoliciesEffectiveDate: '17 October 2026',
  /** Effective date of the Garage Partner Terms & Conditions. */
  garageTermsEffectiveDate: '17 October 2026',
  /** The supplied Garage Partner Terms carry no "last updated" date. */
  garageTermsLastUpdated: '',
};

export type BusinessField = keyof typeof BUSINESS;

export const SERVICE_CITIES = ['Hyderabad', 'Bengaluru', 'Mancherial'];

export const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/refund-policy', label: 'Cancellation & Refund Policy' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/garage-terms', label: 'Garage Partner Terms' },
  { href: '/contact', label: 'Contact Us' },
];
