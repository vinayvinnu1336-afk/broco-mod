// Indian mobile numbers: 10 digits starting with 6-9. The API stores them as "+91 98765 43210".

export const INVALID_MOBILE_MESSAGE = 'Enter a valid 10-digit mobile number';

/**
 * Up to 10 national digits from whatever was typed or pasted: drops separators and a leading
 * +91 / 91 / 0, e.g. "+91 98765-43210" → "9876543210".
 */
export function mobileDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  const hasCountryCode = /^\s*(\(\s*)?\+\s*91/.test(raw);
  let digits = raw.replace(/\D/g, '');
  if (hasCountryCode || (digits.length === 12 && digits.startsWith('91'))) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isValidIndianMobile(raw: string | null | undefined): boolean {
  return /^[6-9]\d{9}$/.test(mobileDigits(raw));
}

/** "+91 98765 43210" for the API, or '' when the input is not a valid mobile. */
export function toIndianMobile(raw: string | null | undefined): string {
  const d = mobileDigits(raw);
  return /^[6-9]\d{9}$/.test(d) ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : '';
}

/** Display form "+91 98765 43210"; anything that isn't an Indian mobile is shown as stored. */
export function formatIndianMobile(raw: string | null | undefined): string {
  if (!raw) return '';
  return toIndianMobile(raw) || raw;
}

/** tel: link that dials the full international number. */
export function mobileTelHref(raw: string): string {
  return isValidIndianMobile(raw) ? `tel:+91${mobileDigits(raw)}` : `tel:${raw.replace(/[^\d+]/g, '')}`;
}
