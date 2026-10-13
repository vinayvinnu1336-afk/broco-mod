// Public contact details. Set them at build time; anything left empty is simply not shown.
//   NEXT_PUBLIC_SUPPORT_PHONE=1800-000-0000
//   NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com
//   NEXT_PUBLIC_SUPPORT_WHATSAPP=919000000000   (digits only, with country code)

export const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '').trim();
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '').trim();
export const SUPPORT_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const hasSupportContact = !!(SUPPORT_PHONE || SUPPORT_EMAIL || SUPPORT_WHATSAPP);
