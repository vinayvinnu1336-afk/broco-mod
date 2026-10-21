'use client';

import React, { useEffect, useState } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export interface ShareJobSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Built with buildJobShareText (src/lib/jobShare.ts). */
  text: string;
  title?: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the old way (http pages, older browsers).
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Preview of the job details a garage sends to its driver or mechanic, with Share, WhatsApp and Copy. */
export function ShareJobSheet({ isOpen, onClose, text, title = 'Share job details' }: ShareJobSheetProps) {
  const toast = useToast();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  async function share() {
    try {
      await navigator.share({ text });
    } catch (err) {
      // Closing the share sheet is not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error('Could not open sharing', 'Use WhatsApp or Copy instead.');
    }
  }

  async function copy() {
    if (await copyText(text)) toast.success('Copied', 'Paste it in any chat.');
    else toast.error('Could not copy', 'Select the text and copy it by hand.');
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description="Send the customer location and service details to your pick-up driver or mechanic."
      footer={
        <div className={`grid gap-2 ${canShare ? 'grid-cols-3' : 'grid-cols-2'} sm:flex sm:justify-end`}>
          {canShare && (
            <Button onClick={share} leftIcon={<Share2 className="h-4 w-4" />} className="sm:w-auto">
              Share
            </Button>
          )}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              canShare
                ? 'border border-surface-300 bg-white text-navy-800 hover:bg-surface-50 focus-visible:ring-electric-600'
                : 'bg-[#1f9d55] text-white shadow-sm hover:bg-[#188a49] focus-visible:ring-[#1f9d55]'
            }`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
          <Button variant="outline" onClick={copy} leftIcon={<Copy className="h-4 w-4" />} className="sm:w-auto">
            Copy
          </Button>
        </div>
      }
    >
      <div
        className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-surface-200 bg-surface-50 p-3 text-sm leading-relaxed text-navy-900 sm:max-h-[60vh]"
        aria-label="Message preview"
        tabIndex={0}
      >
        {text}
      </div>
    </Modal>
  );
}
