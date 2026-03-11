import { useState } from 'react';

import type { PromoteResponse } from '@/types';

interface PromoteDialogProps {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  promote: PromoteResponse | null;
  onClose: () => void;
}

export function PromoteDialog({
  isOpen,
  loading,
  error,
  promote,
  onClose,
}: PromoteDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleCopy(): Promise<void> {
    if (!promote?.promote_url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(promote.promote_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="land-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="land-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="land-modal-header">
          <div>
            <h2 className="land-modal-title" id="promote-dialog-title">
              Promote This Look
            </h2>
            <p className="land-modal-copy">
              这里展示 Demo 用的带货链接和二维码。没有二维码时只保留链接，不阻断主流程。
            </p>
          </div>
          <button type="button" className="land-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="land-promote-box">
          {loading ? <p>Loading promote payload...</p> : null}
          {error ? <p className="land-error">{error}</p> : null}
          {promote ? (
            <>
              <a
                className="land-promote-url"
                href={promote.promote_url}
                target="_blank"
                rel="noreferrer"
              >
                {promote.promote_url}
              </a>
              {promote.qr_code_url ? (
                <div className="land-promote-qr">
                  <img src={promote.qr_code_url} alt="Promote QR Code" />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="land-modal-actions">
          <button type="button" className="land-button secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="land-button primary"
            onClick={handleCopy}
            disabled={!promote?.promote_url}
          >
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
