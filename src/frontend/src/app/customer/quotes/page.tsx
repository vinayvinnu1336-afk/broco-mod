'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { CustomerFacingQuotationDto } from '@/types/customerQuotation';
import {
  BadgeDollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car,
  ChevronRight,
  FileText,
  Calendar,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CustomerQuotesPage() {
  const [quotes, setQuotes] = useState<CustomerFacingQuotationDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      setLoading(true);
      try {
        const res = await apiFetch<CustomerFacingQuotationDto[]>('/customer/quotes');
        if (res.success && res.data) {
          setQuotes(res.data);
        }
      } catch (err) {
        console.error('Error loading quotations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadQuotes();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2.5">
            <BadgeDollarSign className="w-6 h-6 text-amber-500" />
            <span>Approved Quotations</span>
          </h1>
          <p className="text-xs text-navy-500 mt-1">
            Curated proposals approved by your dedicated automotive advisor with guaranteed fixed pricing.
          </p>
        </div>
      </div>

      {/* Pricing Isolation Banner */}
      <div className="p-4 bg-white rounded-2xl border border-surface-200 shadow-card flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-electric-600 shrink-0 mt-0.5" />
        <div className="text-xs text-navy-600 leading-relaxed">
          <strong className="text-navy-900 block font-bold mb-0.5">BroCo Mod Pricing Integrity Guarantee</strong>
          Every price listed here is an all-inclusive, fixed customer proposal vetted by certified BroCo Mod Technical Advisors.
          Workshop internal parts cost breakdown and commercial negotiations are securely segregated on the server.
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading approved quotations..." />
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<BadgeDollarSign className="w-7 h-7 text-navy-400" />}
          title="No Quotations Awaiting Review"
          description="When garages submit bids for your service requests and our advisors finalize your proposal, it will appear here."
          action={
            <Link href="/customer/requests/new">
              <Button size="sm" variant="primary">
                Book a Service
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => (
            <Card key={q.id} hoverEffect className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-electric-50 text-electric-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy-900 bg-surface-100 px-2 py-0.5 rounded-lg border border-surface-200">
                        {q.quotationNumber}
                      </span>
                      <StatusBadge status={q.status} />
                    </div>
                    <div className="text-xs text-navy-500 mt-1">
                      Request #{q.requestNumber} • Sent {q.sentAtUtc ? new Date(q.sentAtUtc).toLocaleDateString() : 'Recently'}
                    </div>
                  </div>
                </div>

                <div className="text-left md:text-right">
                  <div className="text-[11px] font-bold text-navy-400 uppercase tracking-wider">
                    Fixed Customer Price
                  </div>
                  <div className="text-2xl font-black text-navy-900">
                    ₹{q.customerTotal.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mt-0.5">
                    All-Inclusive (Parts + Labour + GST)
                  </span>
                </div>
              </div>

              <div className="py-4 space-y-2">
                <div className="text-xs font-bold text-navy-800 uppercase tracking-wider">
                  Scope of Work
                </div>
                <p className="text-xs text-navy-600 leading-relaxed bg-surface-50 p-3 rounded-xl border border-surface-200">
                  {q.scopeSummary || 'Standard service scope audited and approved by technical advisor.'}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-navy-500">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>
                    Valid until:{' '}
                    <strong className="text-navy-800">
                      {q.validUntilUtc ? new Date(q.validUntilUtc).toLocaleDateString() : 'N/A'}
                    </strong>
                  </span>
                </div>

                <Link href={`/customer/quotes/${q.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Review & Decide
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
