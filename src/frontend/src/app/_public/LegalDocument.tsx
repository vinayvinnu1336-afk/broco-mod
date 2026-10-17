import React from 'react';
import Link from 'next/link';
import { ChevronDown, FileText } from 'lucide-react';
import type { LegalBlock, LegalDoc } from '@/content/legal/types';
import { BUSINESS, LEGAL_LINKS } from '@/content/legal/business';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { BusinessValue, RichText, missingField, presentValue } from './legalText';

/** One public legal page (terms, refund policy, privacy, garage terms) from its structured content. */
export function LegalDocument({ doc, path }: { doc: LegalDoc; path: string }) {
  const effectiveDate = BUSINESS[doc.effectiveDateField];
  const lastUpdated = 'date' in doc.lastUpdated ? doc.lastUpdated.date : BUSINESS[doc.lastUpdated.field];
  const toc = (
    <ol className="space-y-0.5 text-sm">
      {doc.sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="flex min-h-[40px] items-start gap-2 rounded-lg px-2 py-2 leading-snug text-navy-600 transition hover:bg-surface-100 hover:text-navy-900 lg:min-h-0 lg:py-1.5"
          >
            <span className="w-5 shrink-0 text-right tabular-nums text-navy-400">{s.number}.</span>
            <span className="min-w-0">{s.heading}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="min-h-screen bg-surface-50 text-navy-900 print:bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 print:max-w-none print:p-0">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 print:hidden">
            <FileText className="h-4 w-4" aria-hidden /> Legal
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">{doc.title}</h1>
          {doc.subtitle && <p className="mt-2 text-[15px] leading-relaxed text-navy-500 sm:text-lg">{doc.subtitle}</p>}
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-navy-600">
            {effectiveDate && (
              <div className="flex flex-wrap items-center gap-x-1.5">
                <dt className="font-semibold text-navy-800">Effective date:</dt>
                <dd>{effectiveDate}</dd>
              </div>
            )}
            {lastUpdated && (
              <div className="flex flex-wrap items-center gap-x-1.5">
                <dt className="font-semibold text-navy-800">Last updated:</dt>
                <dd>{lastUpdated}</dd>
              </div>
            )}
          </dl>
          <p className="mt-1.5 text-sm text-navy-500">
            {BUSINESS.legalName} · <BusinessValue field="website" />
          </p>
        </header>

        {/* Phones and tablets: a collapsible contents list above the text. */}
        <details className="group mt-6 rounded-2xl border border-surface-200 bg-white shadow-card lg:hidden print:hidden">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span>
              On this page <span className="font-normal text-navy-500">· {doc.sections.length} sections</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-navy-400 transition group-open:rotate-180" aria-hidden />
          </summary>
          <nav aria-label="On this page" className="border-t border-surface-200 px-2 py-2">
            {toc}
          </nav>
        </details>

        <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 print:block">
          <nav aria-label="On this page" className="hidden lg:block print:hidden">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-navy-400">On this page</p>
              <div className="mt-2">{toc}</div>
            </div>
          </nav>

          <article className="min-w-0 max-w-3xl rounded-2xl border border-surface-200 bg-white px-4 py-6 shadow-card sm:p-8 lg:p-10 print:max-w-none print:border-0 print:p-0 print:shadow-none">
            {doc.intro?.map((t, i) => (
              <p key={i} className="mb-4 text-[15px] leading-7 text-navy-700 sm:text-base">
                <RichText text={t} />
              </p>
            ))}
            <div className="space-y-9">
              {doc.sections.map((s) => (
                <section key={s.id} aria-labelledby={s.id}>
                  <h2 id={s.id} className="scroll-mt-24 break-after-avoid text-lg font-bold leading-snug tracking-tight text-navy-900 sm:text-xl">
                    <span className="mr-1.5 tabular-nums text-electric-600 print:text-navy-900">{s.number}.</span>
                    {s.heading}
                  </h2>
                  <div className="mt-3 space-y-3 text-[15px] leading-7 text-navy-700 sm:text-base">
                    {s.blocks.map((b, i) => (
                      <Block key={i} block={b} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside aria-label="Related" className="mt-10 border-t border-surface-200 pt-6 print:hidden">
              <p className="text-sm font-semibold text-navy-900">Related</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {LEGAL_LINKS.filter((l) => l.href !== path).map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-surface-200 bg-surface-50 px-3.5 text-sm font-medium text-navy-700 transition hover:border-electric-200 hover:text-electric-700"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

/** Text that needs a business detail which isn't filled in yet is left out. */
function Block({ block }: { block: LegalBlock }) {
  if ((block.type === 'paragraph' || block.type === 'subheading' || block.type === 'note') && missingField(block.text)) return null;
  switch (block.type) {
    case 'paragraph':
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case 'subheading':
      return (
        <h3 className="!mt-6 text-base font-semibold text-navy-900">
          <RichText text={block.text} />
        </h3>
      );
    case 'list':
    case 'ordered': {
      const ListTag = block.type === 'list' ? 'ul' : 'ol';
      return (
        <ListTag className={`space-y-1.5 pl-6 marker:text-navy-400 ${block.type === 'list' ? 'list-disc' : 'list-decimal'}`}>
          {block.items
            .filter((item) => !missingField(item))
            .map((item, i) => (
              <li key={i} className="pl-1">
                <RichText text={item} />
              </li>
            ))}
        </ListTag>
      );
    }
    case 'note':
      return (
        <div className="rounded-xl border border-electric-100 bg-electric-50/60 px-4 py-3 print:border-navy-300 print:bg-transparent">
          <RichText text={block.text} />
        </div>
      );
    case 'table': {
      const last = block.rows.length - 1;
      return (
        <figure className="!my-5">
          <div
            role="region"
            aria-label={block.caption}
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500"
          >
            <table className="w-full min-w-[18rem] border-collapse text-left text-sm">
              <caption className="border-b border-surface-200 bg-surface-50 px-4 py-2.5 text-left font-semibold text-navy-900">
                <RichText text={block.caption} />
              </caption>
              <thead>
                <tr className="border-b border-surface-200 text-navy-500">
                  {block.columns.map((c) => (
                    <th key={c.label} scope="col" className={`px-4 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => {
                  const total = block.totalRow && r === last;
                  return (
                    <tr
                      key={r}
                      className={total ? 'border-t-2 border-surface-300 bg-surface-50 font-semibold text-navy-900' : 'border-t border-surface-100'}
                    >
                      {row.map((cell, c) => (
                        <td
                          key={c}
                          className={`px-4 py-2.5 align-top ${block.columns[c]?.align === 'right' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}
                        >
                          <RichText text={cell} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </figure>
      );
    }
    case 'details': {
      const items = block.items.flatMap((item) => {
        const value = presentValue(item.value);
        return value ? [{ label: item.label, value }] : [];
      });
      if (items.length === 0) return null;
      return (
        <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-4 sm:px-5 print:bg-transparent">
          {block.title && (
            <p className="mb-2">
              <RichText text={block.title} />
            </p>
          )}
          <dl className="space-y-2 sm:grid sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2 sm:space-y-0">
            {items.map((item) => (
              <div key={item.label} className="sm:contents">
                <dt className="text-sm font-semibold text-navy-800 sm:text-[15px]">{item.label}</dt>
                <dd className="min-w-0 break-words">
                  <RichText text={item.value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
  }
}
