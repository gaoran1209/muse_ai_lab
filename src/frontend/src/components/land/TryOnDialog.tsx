import { useEffect, useState } from 'react';

const PRESET_AVATARS = [
  { id: 'avatar_01', label: 'Model A', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop' },
  { id: 'avatar_02', label: 'Model B', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop' },
  { id: 'avatar_03', label: 'Model C', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop' },
  { id: 'avatar_04', label: 'Model D', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop' },
];

interface TryOnDialogProps {
  isOpen: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
  onSubmitUrl?: (url: string) => Promise<void>;
}

export function TryOnDialog({
  isOpen,
  submitting,
  error,
  onClose,
  onSubmit,
  onSubmitUrl,
}: TryOnDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

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
      setSelectedPresetId(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const selectedPreset = PRESET_AVATARS.find((a) => a.id === selectedPresetId);
  const canSubmit = (file || selectedPreset) && !submitting;

  function handleSelectPreset(presetId: string) {
    setSelectedPresetId(presetId === selectedPresetId ? null : presetId);
    setFile(null);
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setSelectedPresetId(null);
  }

  async function handleSubmit() {
    if (selectedPreset && onSubmitUrl) {
      await onSubmitUrl(selectedPreset.url);
    } else if (file) {
      await onSubmit(file);
    }
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
              选择预设头像或上传正面照，体验虚拟试穿效果。
            </p>
          </div>
          <button type="button" className="land-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tryon-preset-section">
          <p className="tryon-preset-label">选择预设头像</p>
          <div className="tryon-preset-grid">
            {PRESET_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                className={`tryon-preset-card ${selectedPresetId === avatar.id ? 'is-selected' : ''}`}
                onClick={() => handleSelectPreset(avatar.id)}
              >
                <img src={avatar.url} alt={avatar.label} />
                <span>{avatar.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tryon-divider">
          <span>或上传照片</span>
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
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
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
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Submitting...' : 'Start TryOn'}
          </button>
        </div>
      </div>
    </div>
  );
}
