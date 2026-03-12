import { useEffect, useMemo, useState } from 'react';
import type { Asset, Look } from '../../types';
import './GenerationActionDialog.css';

type GenerationAction = 'change_model' | 'change_background' | 'tryon';

interface GenerationActionDialogProps {
  open: boolean;
  look: Look | null;
  action: GenerationAction | null;
  defaultMode?: string;
  assets: Asset[];
  busy: boolean;
  onClose: () => void;
  onUploadReference: (files: File[]) => Promise<Asset[]>;
  onSubmit: (payload: {
    presetId?: string;
    customPrompt?: string;
    referenceImageUrl?: string;
    parameters: Record<string, string>;
  }) => Promise<void>;
}

const MODEL_PRESETS = [
  { id: 'model_01', title: 'Model 01', copy: '亚洲女性模特，利落短发，都市感。' },
  { id: 'model_02', title: 'Model 02', copy: '欧洲男性模特，商业时装风格。' },
  { id: 'model_03', title: 'Model 03', copy: '中性模特，极简高级感。' },
];

const BACKGROUND_PRESETS = [
  { id: 'scene_01', title: '街拍-行走', copy: '城市街拍，自然光，轻微动态。' },
  { id: 'scene_02', title: '棚拍-站姿', copy: '白色摄影棚，柔光，电商主图。' },
  { id: 'scene_03', title: '生活方式', copy: '室内暖光，内容社区分发感。' },
];

export function GenerationActionDialog({
  open,
  look,
  action,
  defaultMode,
  assets,
  busy,
  onClose,
  onUploadReference,
  onSubmit,
}: GenerationActionDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState('');
  const [mode, setMode] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedReferenceAssetId, setSelectedReferenceAssetId] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const presets = useMemo(
    () => (action === 'change_model' ? MODEL_PRESETS : action === 'change_background' ? BACKGROUND_PRESETS : []),
    [action]
  );
  const referenceAssets = useMemo(
    () => assets.filter((asset) => asset.category === 'model'),
    [assets]
  );

  useEffect(() => {
    if (!open || !action) return;
    setSelectedPreset(presets[0]?.id ?? '');
    if (defaultMode) {
      setMode(defaultMode);
    } else {
      setMode(action === 'change_model' ? 'replicate' : action === 'change_background' ? 'blend' : '');
    }
    setCustomPrompt('');
    setSelectedReferenceAssetId(referenceAssets[0]?.id ?? '');
    setUploadError(null);
  }, [action, open, presets, referenceAssets, defaultMode]);

  if (!open || !action || !look) return null;

  const selectedReferenceAsset =
    referenceAssets.find((asset) => asset.id === selectedReferenceAssetId) ?? null;
  const dialogTitle =
    action === 'change_model' ? '换模特配置' : action === 'change_background' ? '换背景配置' : 'TryOn 配置';
  const modeOptions =
    action === 'change_model'
      ? [
          { value: 'replicate', label: '真人复刻', copy: '保留服装与构图，重绘成目标模特。' },
          { value: 'swap_face', label: '原图换脸', copy: '更贴近原图，只替换面部特征。' },
        ]
      : action === 'change_background'
        ? [
          { value: 'blend', label: '氛围融合', copy: '以背景氛围驱动整体重绘。' },
          { value: 'replace', label: '精准替换', copy: '更偏硬替换，保留背景结构。' },
          ]
        : [];

  const canSubmit =
    !busy &&
    (action === 'tryon'
      ? Boolean(selectedReferenceAsset?.url)
      : Boolean(selectedPreset) && Boolean(mode));

  async function handleReferenceUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingReference(true);
    setUploadError(null);
    try {
      const uploadedAssets = await onUploadReference(Array.from(files));
      if (uploadedAssets[0]) {
        setSelectedReferenceAssetId(uploadedAssets[0].id);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '参考图上传失败');
    } finally {
      setUploadingReference(false);
    }
  }

  return (
    <div className="generation-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="generation-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="generation-dialog-header">
          <div>
            <span className="generation-dialog-kicker">Spark Action</span>
            <h2>{dialogTitle}</h2>
            <p>{look.name}</p>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        {action !== 'tryon' ? (
          <section className="generation-dialog-section">
            <h3>预设选择</h3>
            <div className="generation-preset-grid">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`generation-preset-card ${selectedPreset === preset.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedPreset(preset.id)}
                >
                  <strong>{preset.title}</strong>
                  <span>{preset.copy}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {action !== 'tryon' ? (
          <section className="generation-dialog-section">
            <h3>处理模式</h3>
            <div className="generation-mode-grid">
              {modeOptions.map((option) => (
                <label key={option.value} className={`generation-mode-card ${mode === option.value ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="generation-mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={(event) => setMode(event.target.value)}
                  />
                  <strong>{option.label}</strong>
                  <span>{option.copy}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {action === 'tryon' ? (
          <section className="generation-dialog-section">
            <h3>参考人物</h3>
            <div className="generation-reference-grid">
              {referenceAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`generation-reference-card ${selectedReferenceAssetId === asset.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedReferenceAssetId(asset.id)}
                >
                  <img src={asset.thumbnail_url ?? asset.url} alt={asset.original_filename ?? asset.id} />
                  <span>{asset.original_filename ?? '素材库参考图'}</span>
                </button>
              ))}
              {referenceAssets.length === 0 ? (
                <div className="generation-reference-empty">
                  当前没有 `model` 类素材，请上传一张真人参考图。
                </div>
              ) : null}
            </div>
            <label className="generation-upload-button">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  void handleReferenceUpload(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              {uploadingReference ? '上传中...' : '上传本地参考图'}
            </label>
            {uploadError ? <p className="generation-upload-error">{uploadError}</p> : null}
          </section>
        ) : null}

        <section className="generation-dialog-section">
          <h3>补充指令</h3>
          <textarea
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder={
              action === 'tryon'
                ? '可选：补充试穿效果、镜头感、场景氛围等细节。'
                : '可选：补充姿势、光线、氛围、镜头感等细节。'
            }
            rows={4}
          />
        </section>

        <footer className="generation-dialog-footer">
          <button type="button" className="secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSubmit}
            onClick={() =>
              void onSubmit({
                presetId: selectedPreset || undefined,
                customPrompt: customPrompt.trim() || undefined,
                referenceImageUrl: selectedReferenceAsset?.url,
                parameters: mode ? { mode } : {},
              })
            }
          >
            {busy ? '生成中...' : '开始生成'}
          </button>
        </footer>
      </div>
    </div>
  );
}
