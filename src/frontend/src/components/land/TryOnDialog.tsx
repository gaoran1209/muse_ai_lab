import { useEffect, useState } from 'react';

interface TryOnDialogProps {
  isOpen: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
}

export function TryOnDialog({
  isOpen,
  submitting,
  error,
  onClose,
  onSubmit,
}: TryOnDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="land-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="land-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tryon-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="land-modal-header">
          <div>
            <h2 className="land-modal-title" id="tryon-dialog-title">
              TryOn Me
            </h2>
            <p className="land-modal-copy">
              上传一张正面照，前端会先把图片上传到 OSS，再按 Land 正式契约发起 TryOn 任务。
            </p>
          </div>
          <button type="button" className="land-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="land-upload-box">
          {previewUrl ? (
            <div className="land-upload-preview">
              <img src={previewUrl} alt="TryOn upload preview" />
            </div>
          ) : null}

          <input
            className="land-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />

          {file ? <span>{file.name}</span> : <span>支持 jpg / png / webp，建议使用清晰正面照。</span>}
          {error ? <p className="land-error">{error}</p> : null}
        </div>

        <div className="land-modal-actions">
          <button type="button" className="land-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="land-button primary"
            disabled={!file || submitting}
            onClick={async () => {
              if (!file) {
                return;
              }
              await onSubmit(file);
            }}
          >
            {submitting ? 'Submitting...' : 'Start TryOn'}
          </button>
        </div>
      </div>
    </div>
  );
}
