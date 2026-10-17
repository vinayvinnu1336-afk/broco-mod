import React from 'react';
import Link from 'next/link';
import { BUSINESS, BusinessField } from '@/content/legal/business';
import { telHref } from '@/lib/site';

const linkClass = 'break-words font-medium text-electric-700 underline decoration-electric-200 underline-offset-2 hover:decoration-electric-600';

/** A business detail, linked where that helps (email, phone, website). */
export function BusinessValue({ field }: { field: BusinessField }) {
  const value = BUSINESS[field];
  if (!value) return null;
  if (field === 'website') {
    return (
      <a href={value} className={linkClass}>
        {value}
      </a>
    );
  }
  if (field.toLowerCase().endsWith('email')) {
    return (
      <a href={`mailto:${value}`} className={linkClass}>
        {value}
      </a>
    );
  }
  if (field === 'supportPhone') {
    return (
      <a href={telHref(value)} className={`${linkClass} whitespace-nowrap`}>
        {value}
      </a>
    );
  }
  return <>{value}</>;
}

const TOKEN = /(\*\*.+?\*\*|\[[^\]]+\]\([^)\s]+\)|\{\{\w+\}\})/g;
const FIELD = /\{\{(\w+)\}\}/g;

function renderInline(text: string): React.ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-navy-900">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <Link key={i} href={link[2]} className={linkClass}>
          {renderInline(link[1])}
        </Link>
      );
    }
    const field = /^\{\{(\w+)\}\}$/.exec(part);
    if (field && field[1] in BUSINESS) return <BusinessValue key={i} field={field[1] as BusinessField} />;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

/** True when the text refers to a business detail that hasn't been filled in. */
export function missingField(text: string) {
  return Array.from(text.matchAll(FIELD), (m) => m[1] as BusinessField).some((f) => !BUSINESS[f]);
}

/**
 * For label/value lines: drops empty business details (and the comma next to them).
 * Returns null when nothing is left, so the whole line can be left out.
 */
export function presentValue(text: string): string | null {
  const fields = Array.from(text.matchAll(FIELD), (m) => m[1] as BusinessField);
  if (fields.length === 0) return text;
  if (fields.every((f) => !BUSINESS[f])) return null;
  return text
    .replace(FIELD, (token, f: BusinessField) => (BUSINESS[f] ? token : ''))
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/,\s*,/g, ',');
}

/**
 * Legal text with **bold**, [links](/path) and {{businessField}} markers.
 * Callers leave out text whose details are missing (see missingField / presentValue).
 */
export function RichText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}
