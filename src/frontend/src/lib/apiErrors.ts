// Error bodies come in two shapes: our ApiResponse ({ message, errors: ["…"] }) and ASP.NET model
// validation ({ title, errors: { PhoneNumber: ["…"] } }). These read either.

interface ErrorLike {
  message?: string;
  errors?: unknown;
}

/** First message per field, keyed in camelCase ("PhoneNumber" → "phoneNumber"). */
export function fieldErrors(res: ErrorLike): Record<string, string> {
  const out: Record<string, string> = {};
  const errors = res.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return out;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.find((v) => typeof v === 'string') : typeof value === 'string' ? value : undefined;
    const field = key.replace(/^\$\.?/, '');
    if (message && field) out[field.charAt(0).toLowerCase() + field.slice(1)] = message;
  }
  return out;
}

/** One human-readable message for a failed request. */
export function firstApiError(res: ErrorLike, fallback: string): string {
  const fromFields = Object.values(fieldErrors(res))[0];
  if (fromFields) return fromFields;
  // apiFetch's own "Request failed with status 405" (and the status text it puts in `errors`) means
  // nothing to a customer; our ApiResponse always repeats its first error in `message`.
  const message = res.message?.trim();
  if (message && !/^Request failed with status/i.test(message)) return message;
  return fallback;
}
