import type { BusinessField } from './business';

/**
 * Text in a legal document. Plain strings with three small markers:
 *   **bold**              bold, as in the source document
 *   [label](/path)        a link
 *   {{field}}             a value from business.ts (text using an empty one is left out)
 */
export type Text = string;

export type LegalBlock =
  | { type: 'paragraph'; text: Text }
  | { type: 'list'; items: Text[] }
  | { type: 'ordered'; items: Text[] }
  | { type: 'subheading'; text: Text }
  | { type: 'note'; text: Text }
  | {
      type: 'table';
      caption: Text;
      columns: { label: string; align?: 'left' | 'right' }[];
      rows: Text[][];
      /** Style the last row as the result line. */
      totalRow?: boolean;
    }
  /** Label/value lines such as contact details. */
  | { type: 'details'; title?: Text; items: { label: string; value: Text }[] };

export interface LegalSection {
  id: string;
  number: number;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  /** Field in business.ts holding the effective date. */
  effectiveDateField: BusinessField;
  /** A fixed date, or a business.ts field when the source has none. */
  lastUpdated: { date: string } | { field: BusinessField };
  intro?: Text[];
  sections: LegalSection[];
}

// Shorthands that keep the document files close to plain text.
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const section = (number: number, heading: string, ...blocks: LegalBlock[]): LegalSection => ({
  id: slug(heading),
  number,
  heading,
  blocks,
});
export const p = (text: Text): LegalBlock => ({ type: 'paragraph', text });
export const ul = (...items: Text[]): LegalBlock => ({ type: 'list', items });
export const ol = (...items: Text[]): LegalBlock => ({ type: 'ordered', items });
export const h = (text: Text): LegalBlock => ({ type: 'subheading', text });
export const note = (text: Text): LegalBlock => ({ type: 'note', text });
