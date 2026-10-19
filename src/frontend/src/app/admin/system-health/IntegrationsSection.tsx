'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CreditCard,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Plug,
  Send,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/Alert';
import { Badge, BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconTile } from '@/components/ui/ListItem';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { INVALID_MOBILE_MESSAGE, isValidIndianMobile, toIndianMobile } from '@/lib/phone';

// GET /admin/integrations. Only "set / not set" per setting; the API never returns a secret.
interface IntegrationCheck {
  label: string;
  ok: boolean;
  note?: string | null;
}

interface Integration {
  key: string;
  name: string;
  status: 'Configured' | 'Partial' | 'NotConfigured' | 'Error' | string;
  summary: string;
  checks: IntegrationCheck[];
  mode?: string | null;
}

interface IntegrationsStatus {
  checkedAtUtc: string;
  integrations: Integration[];
}

interface TestResult {
  success: boolean;
  channel: string;
  provider: string;
  configured: boolean;
  recipient: string;
  detail: string;
  providerMessageId?: string | null;
  httpStatus?: number | null;
}

type Tone = 'green' | 'amber' | 'red' | 'neutral';

const STATUS: Record<string, { label: string; tone: Tone; badge: BadgeVariant }> = {
  Configured: { label: 'Configured', tone: 'green', badge: 'green' },
  Partial: { label: 'Partly configured', tone: 'amber', badge: 'amber' },
  NotConfigured: { label: 'Not configured', tone: 'neutral', badge: 'neutral' },
  Error: { label: 'Error', tone: 'red', badge: 'red' },
};

const ICONS: Record<string, React.ElementType> = {
  googleMaps: MapPin,
  razorpay: CreditCard,
  email: Mail,
  sms: MessageSquareText,
  whatsapp: MessageCircle,
};

function IntegrationRow({ item }: { item: Integration }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[item.status] ?? STATUS.NotConfigured;
  const panelId = `integration-${item.key}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-50 focus-visible:bg-surface-50"
      >
        <IconTile icon={ICONS[item.key] ?? Plug} tone={status.tone} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-navy-900">{item.name}</span>
            {item.mode && (
              <Badge variant={item.mode === 'Live' ? 'blue' : 'neutral'} className="text-[11px]">
                {item.mode === 'Live' ? 'Live mode' : item.mode === 'Test' ? 'Test mode' : item.mode}
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-navy-500">{item.summary}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Badge variant={status.badge}>{status.label}</Badge>
          <ChevronDown className={`h-4 w-4 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {open && (
        <ul id={panelId} className="space-y-2 bg-surface-50 px-4 py-3 sm:pl-[68px]">
          {item.checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2 text-sm">
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Set" />
              ) : (
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" aria-label="Not set" />
              )}
              <span className="min-w-0">
                <span className="break-words text-navy-800">{check.label}</span>
                {check.note && <span className="block break-words text-xs text-navy-500">{check.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultAlert({ result, onClose }: { result: TestResult; onClose: () => void }) {
  const what = result.channel === 'Email' ? 'Email' : result.channel === 'WhatsApp' ? 'WhatsApp message' : 'SMS';
  return (
    <Alert type={result.success ? 'success' : result.configured ? 'error' : 'warning'} onClose={onClose}>
      <span className="block font-semibold">
        {result.success ? `${what} accepted by ${result.provider}` : `${what} not sent`}
      </span>
      <span className="block break-words">
        To {result.recipient}. {result.detail}
        {result.providerMessageId ? ` Reference: ${result.providerMessageId}.` : ''}
      </span>
      {result.success && (
        <span className="mt-1 block text-xs">
          Accepted means the provider took it; it should arrive within a minute.
        </span>
      )}
    </Alert>
  );
}

export function IntegrationsSection() {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [busy, setBusy] = useState<'email' | 'Sms' | 'WhatsApp' | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<IntegrationsStatus>('/admin/integrations');
    if (res.success && res.data) {
      setStatus(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.message || 'Could not load the integrations.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const finish = (res: { success: boolean; message: string; data?: TestResult }) => {
    if (res.data) {
      setResult(res.data);
      setSendError(null);
    } else {
      setResult(null);
      setSendError(res.message || 'The test could not be sent.');
    }
  };

  const sendEmail = async () => {
    setBusy('email');
    setResult(null);
    try {
      finish(await apiFetch<TestResult>('/admin/integrations/test-email', { method: 'POST' }));
    } finally {
      setBusy(null);
    }
  };

  const sendMobile = async (channel: 'Sms' | 'WhatsApp') => {
    if (!isValidIndianMobile(mobile)) {
      setMobileError(INVALID_MOBILE_MESSAGE);
      return;
    }
    setBusy(channel);
    setResult(null);
    try {
      finish(
        await apiFetch<TestResult>('/admin/integrations/test-mobile', {
          method: 'POST',
          body: JSON.stringify({ mobileNumber: toIndianMobile(mobile), channel }),
        })
      );
    } finally {
      setBusy(null);
    }
  };

  const byKey = (key: string) => status?.integrations.find((i) => i.key === key);
  const configured = (key: string) => {
    const s = byKey(key)?.status;
    return s === 'Configured' || s === 'Partial';
  };

  return (
    <section aria-labelledby="integrations-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 id="integrations-title" className="text-sm font-semibold text-navy-700">
            Integrations
          </h2>
          <p className="text-xs text-navy-500">
            Keys are set on the server with <code className="font-mono">set-keys.sh</code>. Only whether each one is set is shown here.
          </p>
        </div>
      </div>

      {!status && !loadError && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-[260px] rounded-2xl" />
        </div>
      )}

      {loadError && !status && (
        <Alert type="error">{loadError}</Alert>
      )}

      {status && (
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card divide-y divide-surface-200/80">
          {status.integrations.map((item) => (
            <IntegrationRow key={item.key} item={item} />
          ))}
        </div>
      )}

      {status && (
        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="text-base font-semibold text-navy-900">Send a test</h3>
            <p className="mt-0.5 text-sm text-navy-500">
              Check new keys right after pasting them. Each test is a real message (limit 10 per 10 minutes).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy-700">Email to your own admin address</p>
            <Button
              variant="outline"
              onClick={sendEmail}
              isLoading={busy === 'email'}
              disabled={busy !== null}
              leftIcon={<Mail className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Send test email
            </Button>
          </div>

          <div className="border-t border-surface-200 pt-4">
            <PhoneInput
              id="testMobile"
              label="Mobile for the test SMS / WhatsApp"
              value={mobile}
              onChange={(digits) => {
                setMobile(digits);
                setMobileError(undefined);
              }}
              error={mobileError}
              helperText="Sends the verification-code message with a random code."
            />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button
                variant="outline"
                onClick={() => sendMobile('Sms')}
                isLoading={busy === 'Sms'}
                disabled={busy !== null}
                leftIcon={<Send className="h-4 w-4" />}
              >
                Send test SMS
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMobile('WhatsApp')}
                isLoading={busy === 'WhatsApp'}
                disabled={busy !== null}
                leftIcon={<MessageCircle className="h-4 w-4" />}
              >
                Send test WhatsApp
              </Button>
            </div>
            {(!configured('sms') || !configured('whatsapp')) && (
              <p className="mt-2 text-xs text-navy-500">
                {!configured('sms') && !configured('whatsapp')
                  ? 'SMS and WhatsApp are not set up yet; the test will say what is missing.'
                  : !configured('sms')
                    ? 'SMS is not set up yet.'
                    : 'WhatsApp is optional and not set up.'}
              </p>
            )}
          </div>

          <div aria-live="polite">
            {result && <ResultAlert result={result} onClose={() => setResult(null)} />}
            {sendError && (
              <Alert type="error" onClose={() => setSendError(null)}>
                {sendError}
              </Alert>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
